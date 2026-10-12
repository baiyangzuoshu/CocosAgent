import type { AgentTool, AgentToolResult, JsonObject, ToolRegistry } from './contracts.js';

const INSTANCE_LIST = 'cocos_2x_instances_list';
const CAPABILITIES_LIST = 'cocos_2x_capabilities_list';
const SKILL_TOOLS = new Set(['cocos_2x_skills_list', 'cocos_2x_skill_read', 'cocos_2x_skill_reference_read']);
const SETUP_TOOLS = new Set([INSTANCE_LIST, CAPABILITIES_LIST, ...SKILL_TOOLS]);
const RECOVERY_TOOLS = new Set([
    'cocos_2x_operation_get', 'cocos_2x_operation_reconcile', 'cocos_2x_script_operation_get',
    'cocos_2x_script_patch', 'cocos_2x_workflow_get', 'cocos_2x_workflow_compensate',
    'cocos_2x_assets_scene_get', 'cocos_2x_assets_scene_validate', 'cocos_2x_assets_scene_compensate',
    'cocos_2x_content_build_get', 'cocos_2x_content_build_reconcile', 'cocos_2x_content_preview_get',
    'cocos_2x_content_get', 'cocos_2x_bundle_dependencies_get',
]);
const MAX_TOOL_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOOL_IMAGE_BASE64_CHARS = Math.ceil(MAX_TOOL_IMAGE_BYTES * 4 / 3) + 8;

function isAbsoluteCreatorProjectRoot(projectRoot: string): boolean {
    return projectRoot.startsWith('/') || /^[A-Za-z]:[\\/]/.test(projectRoot)
        || /^\\\\[^\\/]+[\\/][^\\/]+/.test(projectRoot);
}

export interface CocosReadOnlyToolDefinition {
    name: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: unknown;
}

export interface CocosReadOnlyMcpClient {
    callTool(input: { name: string; arguments: JsonObject }): Promise<unknown>;
}

export type CocosSkillToolCall = (name: string, args: JsonObject) => Promise<unknown>;

export interface CocosProjectInstructionsRequirement {
    required: boolean;
    expectedSha256?: string;
}

export interface CocosReadOnlyPreflightReceipt {
    name: string;
    arguments: JsonObject;
    result: AgentToolResult;
}

export interface CocosReadOnlyPreflightResult {
    ready: boolean;
    reason: string | null;
    receipts: CocosReadOnlyPreflightReceipt[];
}

type PreflightState = 'instances' | 'capabilities' | 'ready' | 'blocked';

export class CocosReadOnlyToolRegistry implements ToolRegistry {
    private state: PreflightState = 'instances';
    private readonly tools: AgentTool[];
    private readonly byName = new Map<string, AgentTool>();
    private readonly offered = new Set<string>();
    private readonly capabilities = new Map<string, string>();
    private instructionsVerified: boolean;

    constructor(
        private readonly client: CocosReadOnlyMcpClient,
        definitions: CocosReadOnlyToolDefinition[],
        private readonly projectRoot: string,
        private readonly requiredCommands: Record<string, string>,
        private readonly callSkillTool?: CocosSkillToolCall,
        private readonly allowWrites = false,
        private readonly projectInstructions: CocosProjectInstructionsRequirement = { required: false },
    ) {
        this.instructionsVerified = !projectInstructions.required;
        if (!projectRoot || !isAbsoluteCreatorProjectRoot(projectRoot)) {
            throw new TypeError('A canonical absolute Creator project root is required.');
        }
        const seen = new Set<string>();
        this.tools = definitions.map((definition) => {
            if (!definition || typeof definition.name !== 'string' || !definition.name
                || typeof definition.description !== 'string' || !isRecord(definition.inputSchema)) {
                throw new TypeError('CocosAgent tool definition is incomplete.');
            }
            if (seen.has(definition.name)) throw new TypeError(`Duplicate CocosAgent tool: ${definition.name}`);
            seen.add(definition.name);
            const annotations = isRecord(definition.annotations) ? definition.annotations : {};
            const access = annotations.readOnlyHint === true ? 'read' : 'write';
            const role = SETUP_TOOLS.has(definition.name) ? 'setup'
                : RECOVERY_TOOLS.has(definition.name) ? 'recovery' : 'task';
            const tool: AgentTool = {
                name: definition.name,
                description: definition.description,
                inputSchema: definition.inputSchema,
                access,
                role,
            };
            this.byName.set(tool.name, tool);
            return tool;
        });
        if (!this.byName.has(INSTANCE_LIST) || !this.byName.has(CAPABILITIES_LIST)) {
            throw new Error('Creator instance and capability tools are required for Ask mode.');
        }
    }

    get isReady(): boolean { return this.state === 'ready'; }

    get canWrite(): boolean {
        return this.allowWrites && this.state === 'ready'
            && (!this.projectInstructions.required || this.instructionsVerified);
    }

    async verifyCreator(): Promise<CocosReadOnlyPreflightResult> {
        const receipts: CocosReadOnlyPreflightReceipt[] = [];
        const instances = await this.listTools();
        if (!instances.some((tool) => tool.name === INSTANCE_LIST)) {
            return { ready: false, reason: 'CREATOR_INSTANCE_PREFLIGHT_UNAVAILABLE', receipts };
        }
        const instanceArgs = {};
        let instanceResult: AgentToolResult;
        try {
            instanceResult = await this.callTool({ name: INSTANCE_LIST, arguments: instanceArgs });
        } catch {
            this.state = 'blocked';
            return { ready: false, reason: 'CREATOR_INSTANCE_PREFLIGHT_FAILED', receipts };
        }
        receipts.push({ name: INSTANCE_LIST, arguments: instanceArgs, result: instanceResult });
        if (this.state !== 'capabilities') {
            return { ready: false, reason: 'CREATOR_INSTANCE_NOT_READY', receipts };
        }

        const capabilities = await this.listTools();
        if (!capabilities.some((tool) => tool.name === CAPABILITIES_LIST)) {
            this.state = 'blocked';
            return { ready: false, reason: 'CREATOR_CAPABILITIES_PREFLIGHT_UNAVAILABLE', receipts };
        }
        const capabilityArgs = { projectRoot: this.projectRoot };
        let capabilityResult: AgentToolResult;
        try {
            capabilityResult = await this.callTool({ name: CAPABILITIES_LIST, arguments: capabilityArgs });
        } catch {
            this.state = 'blocked';
            return { ready: false, reason: 'CREATOR_CAPABILITIES_PREFLIGHT_FAILED', receipts };
        }
        receipts.push({ name: CAPABILITIES_LIST, arguments: capabilityArgs, result: capabilityResult });
        return this.isReady
            ? { ready: true, reason: null, receipts }
            : { ready: false, reason: 'CREATOR_CAPABILITIES_NOT_READY', receipts };
    }

    async listTools(): Promise<AgentTool[]> {
        const candidates = this.state === 'instances'
            ? [this.byName.get(INSTANCE_LIST)]
            : this.state === 'capabilities'
                ? [this.byName.get(CAPABILITIES_LIST)]
                : this.state === 'ready'
                    ? this.tools.filter((tool) => (this.allowWrites || tool.access === 'read')
                        && tool.name !== INSTANCE_LIST && tool.name !== CAPABILITIES_LIST)
                    : [];
        this.offered.clear();
        const result = candidates.filter((tool): tool is AgentTool => Boolean(tool));
        for (const tool of result) this.offered.add(tool.name);
        return result;
    }

    async callTool(input: { name: string; arguments: JsonObject; callId?: string }): Promise<AgentToolResult> {
        if (!this.offered.has(input.name)) return failure('TOOL_NOT_OFFERED');
        const tool = this.byName.get(input.name);
        if (!tool || (tool.access !== 'read' && !this.allowWrites)) return failure('READ_ONLY_TOOL_REQUIRED');

        if (SKILL_TOOLS.has(input.name)) {
            if (!this.callSkillTool) return failure('SKILL_READER_UNAVAILABLE');
            return normalizeResult(await this.callSkillTool(input.name, input.arguments));
        }
        if (input.name === CAPABILITIES_LIST && input.arguments.projectRoot !== this.projectRoot) {
            this.state = 'blocked';
            return failure('PROJECT_ROOT_MISMATCH');
        }
        if (this.state === 'ready' && input.name !== INSTANCE_LIST) {
            if (input.name !== CAPABILITIES_LIST && input.arguments.projectRoot !== this.projectRoot) {
                this.state = 'blocked';
                return failure('PROJECT_ROOT_MISMATCH');
            }
            const command = input.name === 'cocos_2x_command_execute'
                ? input.arguments.command
                : this.requiredCommands[input.name];
            if (typeof command === 'string' && this.capabilities.get(command) !== 'available') {
                return failure('COMMAND_NOT_AVAILABLE');
            }
        }

        if (this.allowWrites && tool.access === 'write' && this.projectInstructions.required && !this.instructionsVerified) {
            return failure('PROJECT_INSTRUCTIONS_REQUIRED');
        }

        const result = normalizeResult(await this.client.callTool({ name: input.name, arguments: input.arguments }));
        if (input.name === INSTANCE_LIST) this.acceptInstances(result);
        else if (input.name === CAPABILITIES_LIST) this.acceptCapabilities(result);
        else if (this.allowWrites && input.name === 'cocos_2x_project_instructions_read'
            && this.projectInstructions.required) {
            const receipt = result.structuredContent;
            if (receipt?.success === true && receipt.found === true
                && typeof this.projectInstructions.expectedSha256 === 'string'
                && receipt.sha256 === this.projectInstructions.expectedSha256) {
                this.instructionsVerified = true;
            } else {
                return failure('PROJECT_CONTEXT_STALE');
            }
        }
        return result;
    }

    private acceptInstances(result: AgentToolResult): void {
        const data = result.structuredContent?.data;
        if (result.isError || result.structuredContent?.success !== true || !Array.isArray(data)) {
            this.state = 'blocked';
            return;
        }
        const matches = data.filter((value) => isRecord(value) && value.projectRoot === this.projectRoot);
        if (matches.length !== 1 || matches[0]?.creatorVersion !== '2.4.15' || matches[0]?.state !== 'ready') {
            this.state = 'blocked';
            return;
        }
        this.state = 'capabilities';
    }

    private acceptCapabilities(result: AgentToolResult): void {
        const data = result.structuredContent?.data;
        const instance = isRecord(data) && isRecord(data.instance) ? data.instance : null;
        const commands = isRecord(data) && Array.isArray(data.commands) ? data.commands : null;
        if (result.isError || result.structuredContent?.success !== true || !instance || !commands
            || instance.projectRoot !== this.projectRoot || instance.creatorVersion !== '2.4.15' || instance.state !== 'ready') {
            this.state = 'blocked';
            return;
        }
        this.capabilities.clear();
        for (const value of commands) {
            if (isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string') {
                this.capabilities.set(value.id, value.status);
            }
        }
        this.state = 'ready';
    }
}

function normalizeResult(value: unknown): AgentToolResult {
    if (!isRecord(value)) return failure('INVALID_MCP_RESULT');
    const result: AgentToolResult = {};
    if (value.isError === true) result.isError = true;
    if (isRecord(value.structuredContent)) result.structuredContent = value.structuredContent;
    if (Array.isArray(value.content)) {
        const content = [];
        for (const block of value.content) {
            if (!isRecord(block)) continue;
            if (block.type === 'text' && typeof block.text === 'string') content.push({ type: 'text' as const, text: block.text });
            else if (block.type === 'image' && typeof block.mimeType === 'string' && typeof block.data === 'string'
                && validImage(block.mimeType, block.data)) content.push({ type: 'image' as const, mimeType: block.mimeType, data: block.data });
        }
        result.content = content;
    }
    return result;
}

function validImage(mimeType: string, data: string): boolean {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)
        || data.length === 0 || data.length > MAX_TOOL_IMAGE_BASE64_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return false;
    try { return atob(data).length <= MAX_TOOL_IMAGE_BYTES; } catch { return false; }
}

function failure(code: string): AgentToolResult {
    return { isError: true, structuredContent: { success: false, error: { code } } };
}

function isRecord(value: unknown): value is JsonObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
