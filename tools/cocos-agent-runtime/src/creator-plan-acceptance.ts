import type { AgentGoalCriterion, AgentReceipt, AgentPolicyToolContext, JsonObject } from './contracts.js';
import { creatorTaskCriteria, verifyCreatorTaskReceipt } from './creator-task-acceptance.js';
import { evaluateGoalEvidence } from './task-system.js';

export type CreatorPlanStepKind = 'read' | 'write' | 'restore' | 'runtime' | 'interaction' | 'memory';
export interface CreatorPlanAcceptanceContext {
    version: 2;
    kind: CreatorPlanStepKind;
    userTask: string;
    requiredTools: string[];
    finalStep: boolean;
    priorEvidence: CreatorPlanEvidence[];
}
export interface CreatorPlanEvidence {
    callId: string;
    name: string;
    access: AgentReceipt['access'];
    role: AgentReceipt['role'];
    isError: boolean;
    payload: JsonObject;
}

const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
const pick = (value: unknown, keys: string[]): JsonObject => {
    const source = object(value), selected: JsonObject = {};
    for (const key of keys) if (source[key] !== undefined) selected[key] = source[key];
    return selected;
};
const IDENTITY_FIELDS = ['operationId', 'action', 'prefabUuid', 'scriptUuid', 'nodeUuid', 'targetNodeUuid', 'nodeName',
    'sourceSha256', 'beforeSha256', 'afterSha256', 'metaSha256', 'state', 'status'];
function nodeProof(value: unknown): JsonObject {
    const result = pick(value, ['status', 'path', 'uuid', 'name', 'active']);
    const source = object(value);
    if (source.transform) result.transform = {
        position: pick(object(source.transform).position, ['x', 'y']), scale: pick(object(source.transform).scale, ['x', 'y']),
    };
    if (Array.isArray(source.componentDetails)) result.componentDetails = source.componentDetails.slice(0, 16)
        .map((item) => pick(item, ['classId', 'enabled', 'text', 'spriteFrameUuid']));
    return result;
}
function detailProof(value: unknown): JsonObject {
    const result = pick(value, IDENTITY_FIELDS);
    const source = object(value);
    if (Array.isArray(source.expectedDiff)) result.expectedDiff = source.expectedDiff.slice(0, 16)
        .map((item) => pick(item, ['path', 'before', 'after']));
    if (Array.isArray(source.components)) result.components = source.components.slice(0, 16)
        .map((item) => pick(item, ['classId', 'text', 'spriteFrameUuid']));
    if (source.transform) result.transform = nodeProof({ transform: source.transform }).transform;
    if (source.node) result.node = nodeProof(source.node);
    if (source.record) {
        result.record = pick(source.record, IDENTITY_FIELDS);
        if (object(source.record).compilation) object(result.record).compilation = pick(object(source.record).compilation, ['status']);
    }
    if (source.current) result.current = pick(source.current, IDENTITY_FIELDS);
    return result;
}

/** Persist only evidence fields used by product validators, never source text or image bytes. */
export function projectCreatorPlanEvidence(receipt: unknown): CreatorPlanEvidence {
    const wire = object(receipt);
    const raw = object(wire.result);
    const source = object(wire.structuredContent || raw.structuredContent);
    const payload: JsonObject = { ...detailProof(source), ...pick(source, ['success', 'command', 'outcome']) };
    if (source.phases) payload.phases = pick(source.phases, ['capability', 'preflight', 'editor', 'disk', 'preview', 'runtime', 'recovery']);
    if (source.error) payload.error = pick(source.error, ['code', 'sideEffect']);
    if (source.instance) payload.instance = pick(source.instance, ['instanceId', 'creatorVersion', 'activeScene', 'activeSceneUuid']);
    if (source.result) payload.result = detailProof(source.result);
    if (source.scene) payload.scene = pick(source.scene, ['name', 'uuid', 'matchesExpected']);
    if (source.runtime) payload.runtime = pick(source.runtime, ['status', 'frameCount', 'frameDelta', 'paused', 'capturedErrorCount', 'pageErrorCount']);
    if (source.diagnostics) payload.diagnostics = {
        errors: Array.isArray(object(source.diagnostics).errors) ? (object(source.diagnostics).errors as unknown[])
            .slice(0, 24).map(() => ({ captured: true })) : null,
    };
    if (source.targetNode) payload.targetNode = nodeProof(source.targetNode);
    if (source.screenshot) payload.imageAvailable = object(source.screenshot).available === true;
    return {
        callId: typeof wire.callId === 'string' ? wire.callId : '',
        name: String(wire.name || wire.toolName || ''),
        access: wire.access as AgentReceipt['access'], role: wire.role as AgentReceipt['role'],
        isError: wire.isError === true || raw.isError === true, payload,
    };
}
function hydrate(proof: CreatorPlanEvidence): AgentReceipt {
    return { callId: proof.callId, toolName: proof.name, access: proof.access, role: proof.role,
        result: { isError: proof.isError, structuredContent: { ...proof.payload,
            ...(proof.payload.imageAvailable !== undefined ? { screenshot: { available: proof.payload.imageAvailable === true } } : {}) } } };
}

export function createCreatorPlanAcceptance(context: CreatorPlanAcceptanceContext) {
    if (context.version !== 2 || !['read', 'write', 'restore', 'runtime', 'interaction', 'memory'].includes(context.kind)
        || !context.userTask || !Array.isArray(context.requiredTools) || !context.requiredTools.length
        || !Array.isArray(context.priorEvidence) || context.priorEvidence.length > 256
        || context.priorEvidence.some((proof) => !proof || typeof proof.callId !== 'string' || !proof.callId
            || typeof proof.name !== 'string' || !proof.name || !['read', 'write'].includes(proof.access)
            || typeof proof.isError !== 'boolean' || !proof.payload || typeof proof.payload !== 'object' || Array.isArray(proof.payload))) {
        throw new Error('PLAN_BUSINESS_CONTRACT_INVALID');
    }
    const prior = context.priorEvidence.map(hydrate);
    const priorSet = new Set(prior);
    const business: AgentGoalCriterion[] = context.kind === 'read' ? creatorTaskCriteria('只读检查')
        : context.kind === 'write' ? creatorTaskCriteria('修改内容，仅编译')
        : context.kind === 'restore' ? creatorTaskCriteria('恢复内容')
        : context.kind === 'memory' ? creatorTaskCriteria('记住项目约定')
        : [{ id: context.kind, description: context.kind === 'runtime' ? '取得本步骤对前序目标的实时运行观察与适用的预览验收'
            : '交互功能仍缺原生可执行结果断言，不能以截图或模型声明完成',
        requiredTools: ['cocos_2x_runtime_observe'], toolMatch: 'any',
        receiptRequirement: context.kind === 'runtime' ? 'creator-runtime' : 'creator-interaction' }];
    const criteria: AgentGoalCriterion[] = [
        ...context.requiredTools.map((name, index) => ({ id: `plan-tool-${index + 1}`, description: `本步骤取得 ${name} 的成功回执`,
            requiredTools: [name], receiptRequirement: 'creator-plan-current-tool' })),
        ...business.map((item) => ({ ...item, id: `plan-step-${item.id}` })),
        ...(context.finalStep ? creatorTaskCriteria(context.userTask).map((item) => ({ ...item, id: `plan-root-${item.id}`,
            description: `整项计划：${item.description}` })) : []),
    ];
    const verify = (criterion: AgentGoalCriterion, receipt: AgentReceipt, receipts: AgentReceipt[]): boolean => {
        const current = receipts.filter((item) => !priorSet.has(item));
        if (criterion.receiptRequirement === 'creator-plan-current-tool') {
            const result = object(receipt.result.structuredContent);
            const operationId = result.operationId || object(result.result).operationId;
            const previewResolved = result.outcome === 'needs-preview' && typeof operationId === 'string'
                && current.some((item) => item.toolName === 'cocos_2x_operation_preview_accept' && !item.result.isError
                    && object(item.result.structuredContent).success === true
                    && object(item.result.structuredContent).operationId === operationId
                    && object(object(item.result.structuredContent).phases).preview === 'passed'
                    && current.indexOf(item) > current.indexOf(receipt));
            return current.includes(receipt) && !receipt.result.isError && result.success === true && !result.error
                && !['needs-review', 'failed', 'in-progress', 'pending'].includes(String(result.outcome || result.status || ''))
                && (result.outcome !== 'needs-preview' || previewResolved);
        }
        if (criterion.id.startsWith('plan-root-')) {
            // Preserve prior writes, but require fresh final-step reads of their present state.
            const finalEvidence = [...prior.filter((item) => item.access === 'write'), ...current];
            if (!finalEvidence.includes(receipt)) return false;
            return verifyCreatorTaskReceipt(criterion, receipt, finalEvidence);
        }
        if (!current.includes(receipt)) return false;
        // Runtime verification may refer to prior writes; other step conditions require fresh local evidence.
        return verifyCreatorTaskReceipt(criterion, receipt, context.kind === 'runtime' ? receipts : current);
    };
    return { criteria, prior, verify, receipts: (current: AgentReceipt[]) => [...prior, ...current] };
}

export function creatorPlanToolAllowed(plan: CreatorPlanAcceptanceContext, context: AgentPolicyToolContext): boolean {
    // The base policy has already restricted this window to the pending operation identity.
    const recovering = context.availableTools.length > 0 && context.availableTools.every((tool) => tool.role === 'recovery');
    if (context.tool.role === 'recovery' && (context.tool.access === 'read' || recovering)) return true;
    if (context.tool.access === 'read' && ['cocos_2x_project_instructions_read', 'cocos_2x_instances_get'].includes(context.tool.name)) return true;
    if (['task', 'recovery'].includes(context.tool.role) && !plan.requiredTools.includes(context.tool.name)) return false;
    if (context.tool.access !== 'write') return true;
    const command = String(context.arguments.command || '');
    const readCommand = context.tool.name === 'cocos_2x_command_execute'
        && ['scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.validatePng', 'prefab.source.inspect',
            'script.read', 'script.patch.plan', 'script.operation.get', 'content.stress.run'].includes(command);
    if (plan.kind === 'read') return readCommand;
    if (['runtime', 'interaction'].includes(plan.kind)) return readCommand
        || context.tool.name === 'cocos_2x_operation_preview_accept'
        || context.tool.name === 'cocos_2x_command_execute' && command === 'runtime.preview.start';
    if (plan.kind === 'memory') return /^cocos_2x_memory_(remember|correct|delete)$/.test(context.tool.name);
    if (context.tool.name === 'cocos_2x_operation_preview_accept') return true;
    if (context.tool.name === 'cocos_2x_script_patch') {
        const action = String(object(context.arguments.input).action || context.arguments.action || 'apply');
        return plan.kind === 'restore' ? action === 'compensate' : ['apply', 'replay'].includes(action);
    }
    if (context.tool.name !== 'cocos_2x_command_execute') return false;
    if (readCommand || command === 'runtime.preview.start') return true;
    if (!['scene.node.create', 'scene.node.patch', 'scene.pngSprite', 'prefab.source.patch', 'script.patch'].includes(command)) return false;
    const action = String(object(context.arguments.input).action || 'apply');
    return plan.kind === 'restore' ? action === 'compensate' : ['apply', 'replay'].includes(action);
}

export function evaluateCreatorPlanAcceptance(context: CreatorPlanAcceptanceContext, wireReceipts: unknown[]) {
    const policy = createCreatorPlanAcceptance(context);
    const evidence = wireReceipts.map(projectCreatorPlanEvidence);
    const receipts = policy.receipts(evidence.map(hydrate));
    return { ...evaluateGoalEvidence({ taskId: 'approved-plan', criteria: policy.criteria }, receipts, policy.verify), evidence };
}
