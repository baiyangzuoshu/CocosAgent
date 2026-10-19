import type { AgentToolResult, JsonObject, ToolRegistry } from './contracts.js';

export interface CreatorPendingRecovery { field: string; value: string; toolName: string; command?: string }
export interface CreatorRecoveryPersistence {
    load(): Promise<{ revision: number; pending: CreatorPendingRecovery | null }>;
    save(pending: CreatorPendingRecovery | null, expectedRevision: number): Promise<void>;
}
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const FIELDS = ['operationId', 'pipelineId', 'workflowId', 'buildId', 'batchId', 'releaseId'];
export function creatorRecoveryIdentity(args: JsonObject): { field: string; value: string } | null {
    for (const data of [args, object(args.input)]) for (const field of FIELDS) {
        if (typeof data[field] === 'string' && data[field]) return { field, value: data[field] as string };
    }
    return null;
}
export function ensureCreatorOperationIdentity(name: string, args: JsonObject): void {
    if (name === 'cocos_2x_command_execute' && ['scene.node.create', 'scene.node.patch', 'scene.pngSprite', 'prefab.source.patch', 'script.patch', 'script.create'].includes(String(args.command))) {
        const input = object(args.input);
        if (!input.operationId) input.operationId = globalThis.crypto.randomUUID();
        args.input = input;
    }
}
export function isCreatorScriptCreateReconcile(name: string, args: JsonObject, pending: CreatorPendingRecovery): boolean {
    if (name !== 'cocos_2x_command_execute' || pending.toolName !== name || pending.field !== 'operationId'
        || (pending.command !== undefined && pending.command !== 'script.create') || args.command !== 'script.create') return false;
    const argumentKeys = Object.keys(args);
    if (argumentKeys.length !== 3 || !argumentKeys.includes('projectRoot') || !argumentKeys.includes('command')
        || !argumentKeys.includes('input') || typeof args.projectRoot !== 'string') return false;
    const input = args.input;
    if (input === null || typeof input !== 'object' || Array.isArray(input)) return false;
    const data = input as JsonObject;
    const keys = Object.keys(data);
    return keys.length === 2 && keys.includes('action') && keys.includes('operationId')
        && data.action === 'reconcile' && data.operationId === pending.value;
}
export function creatorRecoveryResolved(result: AgentToolResult): boolean {
    const data = object(result.structuredContent);
    if (result.isError || data.success !== true || data.error) return false;
    if (['needs-review', 'pending', 'in-progress', 'running', 'compensating'].includes(String(data.outcome || data.status))) return false;
    const phases = object(data.phases);
    if (data.outcome === 'needs-preview') return phases.editor === 'passed' && phases.disk === 'passed';
    if (data.outcome === 'needs-runtime') {
        const detail = object(data.result || data), record = object(detail.record), current = object(detail.current);
        return ['completed', 'compensated'].includes(String(record.state)) && current.scriptUuid === record.scriptUuid
            && current.metaSha256 === record.metaSha256 && typeof current.sourceSha256 === 'string'
            && current.sourceSha256 === (record.state === 'compensated' ? record.beforeSha256 : record.afterSha256);
    }
    if (Object.keys(phases).length && !(phases.editor === 'passed' && phases.disk === 'passed')
        && phases.recovery !== 'passed') return false;
    return ['completed', 'already-terminal', 'no-effect', 'verified', 'reconciled', 'compensated', 'remembered', 'corrected', 'deleted', 'compacted']
        .includes(String(data.outcome || data.status));
}
export function uncertainCreatorResult(result: AgentToolResult): boolean {
    const data = object(result.structuredContent), error = object(data.error);
    return ['needs-review', 'pending', 'in-progress', 'running', 'compensating'].includes(String(data.outcome || data.status))
        || ['possible', 'unknown'].includes(String(error.sideEffect))
        || (result.isError === true || data.success !== true) && error.sideEffect !== 'none';
}

/** The dispatch boundary records intent after approval and before sending a write. */
export class CreatorRecoveryRegistry implements ToolRegistry {
    private state: { revision: number; pending: CreatorPendingRecovery | null };
    private constructor(private readonly inner: ToolRegistry, private readonly persistence: CreatorRecoveryPersistence,
        state: { revision: number; pending: CreatorPendingRecovery | null }) { this.state = state; }
    static async open(inner: ToolRegistry, persistence: CreatorRecoveryPersistence): Promise<CreatorRecoveryRegistry> {
        return new CreatorRecoveryRegistry(inner, persistence, await persistence.load());
    }
    pending(): CreatorPendingRecovery | null { return this.state.pending; }
    async listTools() {
        this.state = await this.persistence.load();
        const pending = this.state.pending;
        const tools = await this.inner.listTools();
        if (!pending || pending.toolName !== 'cocos_2x_command_execute' || pending.field !== 'operationId'
            || (pending.command !== undefined && pending.command !== 'script.create')) return tools;
        return tools.map((tool) => tool.name === 'cocos_2x_command_execute' ? { ...tool, role: 'recovery' as const } : tool);
    }
    async callTool(input: { name: string; arguments: JsonObject; callId?: string }): Promise<AgentToolResult> {
        this.state = await this.persistence.load();
        const pending = this.state.pending;
        const tool = (await this.listTools()).find((item) => item.name === input.name);
        if (!tool) throw new Error('RECOVERY_TOOL_UNKNOWN');
        const requested = creatorRecoveryIdentity(input.arguments);
        const matchingRecovery = pending && tool.role === 'recovery' && requested?.field === pending.field
            && requested.value === pending.value
            && (input.name !== 'cocos_2x_command_execute' || isCreatorScriptCreateReconcile(input.name, input.arguments, pending));
        if (pending && !matchingRecovery) return { isError: true, structuredContent: { success: false,
            error: { code: 'PROJECT_RECOVERY_REQUIRED', sideEffect: 'none' }, pending } };
        if (tool.access === 'write' && !pending) {
            ensureCreatorOperationIdentity(input.name, input.arguments);
            const identity = creatorRecoveryIdentity(input.arguments)
                || { field: input.name.startsWith('cocos_2x_memory_') ? 'operationId' : 'callId', value: input.callId || globalThis.crypto.randomUUID() };
            const command = input.name === 'cocos_2x_command_execute' && typeof input.arguments.command === 'string'
                ? { command: input.arguments.command } : {};
            await this.persistence.save({ ...identity, toolName: input.name, ...command }, this.state.revision);
            this.state = await this.persistence.load();
        }
        const result = await this.inner.callTool(input);
        const returned = creatorRecoveryIdentity(object(result.structuredContent)) || creatorRecoveryIdentity(object(object(result.structuredContent).data));
        if (matchingRecovery && creatorRecoveryResolved(result)) {
            if (returned?.field === pending.field && returned.value === pending.value) await this.clear();
        } else if (!pending && tool.access === 'write' && !uncertainCreatorResult(result)) {
            const recorded = this.state.pending;
            if (recorded && recorded.field !== 'callId' && object(object(result.structuredContent).error).sideEffect !== 'none'
                && (returned?.field !== recorded.field || returned.value !== recorded.value)) {
                return { isError: true, structuredContent: { success: false, outcome: 'needs-review',
                    [recorded.field]: recorded.value, error: { code: 'WRITE_RECEIPT_IDENTITY_MISMATCH', sideEffect: 'unknown' } } };
            }
            await this.clear();
        }
        return result;
    }
    private async clear() {
        await this.persistence.save(null, this.state.revision);
        this.state = await this.persistence.load();
    }
}
