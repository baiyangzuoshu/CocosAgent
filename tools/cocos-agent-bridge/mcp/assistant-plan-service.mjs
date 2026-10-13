import crypto from 'node:crypto';
import { planStepTask } from './structured-plan.mjs';

const REQUIRED_PLAN_SETUP_TOOLS = new Set(['cocos_2x_instances_list', 'cocos_2x_capabilities_list']);
const AGENT_SETUP_TOOLS = new Set(['cocos_2x_instances_list', 'cocos_2x_instances_get', 'cocos_2x_capabilities_list']);
const READ_COMMANDS = new Set(['scene.snapshot', 'scene.node.inspect', 'asset.searchPng', 'asset.validatePng',
    'prefab.source.inspect', 'script.read', 'script.patch.plan', 'script.operation.get', 'content.stress.run']);

function writeReceipt(receipt) {
    return receipt?.access !== 'read' && !AGENT_SETUP_TOOLS.has(receipt?.name)
        && !(receipt?.name === 'cocos_2x_command_execute' && READ_COMMANDS.has(receipt?.structuredContent?.command));
}

function successfulTaskReceipt(receipt) {
    const value = receipt?.structuredContent;
    return !AGENT_SETUP_TOOLS.has(receipt?.name)
        && value?.success === true
        && !['needs-review', 'in-progress', 'needs-preview'].includes(value.outcome);
}

function uncertainWriteReceipt(receipt) {
    const value = receipt?.structuredContent;
    return writeReceipt(receipt)
        && (value?.outcome === 'needs-review'
            || value?.error?.sideEffect === 'possible'
            || value?.error?.sideEffect === 'unknown');
}

function unresolvedWriteReceipt(receipt) {
    const value = receipt?.structuredContent;
    if (!writeReceipt(receipt)) return false;
    if (receipt?.access === undefined) return true;
    return value?.success === true && !['completed', 'already-terminal', 'no-effect', 'remembered', 'corrected', 'deleted'].includes(value.outcome);
}

function successfulWriteReceipt(receipt) {
    return writeReceipt(receipt)
        && receipt?.structuredContent?.success === true;
}

export function hasPlanSetupReceipts(receipts) {
    if (!Array.isArray(receipts)) return false;
    const successfulNames = new Set(receipts
        .filter((receipt) => receipt?.structuredContent?.success === true)
        .map((receipt) => receipt.name));
    return [...REQUIRED_PLAN_SETUP_TOOLS].every((name) => successfulNames.has(name));
}

export function createPlan({ conversationId, userTask, data }) {
    return {
        id: crypto.randomUUID(),
        schemaVersion: data.version,
        conversationId,
        userTask,
        title: data.title,
        summary: data.summary,
        steps: data.steps,
        nextStepIndex: 0,
        completedSteps: 0,
        status: 'proposed',
        evidenceSteps: [],
    };
}

export function beginPlanStep(plan, { conversationId, planId, stepIndex }) {
    if (!plan || plan.id !== planId || plan.conversationId !== conversationId) throw new Error('PLAN_NOT_FOUND');
    if (plan.schemaVersion !== 2) throw new Error('PLAN_REGENERATION_REQUIRED');
    if (!Number.isInteger(stepIndex) || stepIndex !== plan.nextStepIndex || stepIndex >= plan.steps.length) {
        throw new Error('PLAN_STEP_OUT_OF_ORDER');
    }
    if (!['proposed', 'waiting-next', 'paused'].includes(plan.status)) throw new Error('PLAN_NOT_READY');
    planAcceptanceContext(plan);
    plan.status = 'running';
    return planStepTask(plan, stepIndex, plan.stepEvidence || []);
}

export function finishPlanStep(plan, result, business) {
    if (!plan || plan.status !== 'running') return plan;
    const allReceipts = Array.isArray(result.receipts) ? result.receipts : [];
    const requiredTools = plan.steps[plan.nextStepIndex]?.requiredTools || [];
    const successfulNames = new Set(allReceipts.filter((receipt) => successfulTaskReceipt(receipt)
        || business?.satisfied === true && receipt?.structuredContent?.success === true && !receipt.isError
            && receipt.structuredContent.outcome === 'needs-preview').map((receipt) => receipt.name));
    const requiredToolsSatisfied = requiredTools.length > 0 && requiredTools.every((name) => successfulNames.has(name));
    const hasTaskReceipt = allReceipts.some(successfulTaskReceipt);
    const hasUncertainWrite = result.status === 'needs-review' || allReceipts.some(uncertainWriteReceipt);
    const hasUnresolvedWrite = allReceipts.some((receipt) => unresolvedWriteReceipt(receipt)
        && !(business?.satisfied === true && receipt?.structuredContent?.outcome === 'needs-preview'))
        || (result.status !== 'completed' && allReceipts.some(successfulWriteReceipt));
    const hasSuccessfulWrite = allReceipts.some(successfulWriteReceipt);
    if (hasUncertainWrite) {
        plan.status = 'needs-review';
    } else if (result.status === 'completed' && result.goalEvaluation?.satisfied === true && business?.satisfied === true
        && requiredToolsSatisfied && hasTaskReceipt && !hasUnresolvedWrite) {
        if (!Array.isArray(business.evidence) || business.evidence.length > 32) throw new Error('PLAN_EVIDENCE_LIMIT');
        const receipts = business.evidence.filter((receipt) => receipt.payload?.success === true && !receipt.isError)
            .map((receipt) => ({ name: receipt.name, access: receipt.access, ...receipt.payload }));
        plan.stepEvidence = [...(plan.stepEvidence || []), { stepIndex: plan.nextStepIndex, receipts }].slice(-8);
        plan.evidenceSteps.push({ stepIndex: plan.nextStepIndex, receipts: business.evidence });
        plan.completedSteps += 1;
        plan.nextStepIndex = plan.completedSteps;
        plan.status = plan.completedSteps === plan.steps.length ? 'completed' : 'waiting-next';
    } else if (hasUnresolvedWrite || (hasSuccessfulWrite && !requiredToolsSatisfied)) {
        plan.status = 'needs-review';
    } else {
        // Setup/read-only calls and rejected approvals have no project side effect, so retry is safe.
        plan.status = 'paused';
    }
    plan.businessEvaluation = business ? { satisfied: business.satisfied, outstanding: business.outstanding } : {
        satisfied: false, outstanding: [{ id: 'plan-evidence-unavailable', description: '缺少可执行的计划业务验收结果', missingTools: [] }],
    };
    return plan;
}

export function planAcceptanceContext(plan) {
    const step = plan?.steps?.[plan.nextStepIndex];
    if (plan?.schemaVersion !== 2 || !step?.acceptance?.kind) throw new Error('PLAN_REGENERATION_REQUIRED');
    if (!Array.isArray(plan.evidenceSteps) || plan.evidenceSteps.length !== plan.nextStepIndex
        || plan.evidenceSteps.some((entry, index) => entry.stepIndex !== index || !Array.isArray(entry.receipts) || entry.receipts.length > 32)) {
        throw new Error('PLAN_PRIOR_EVIDENCE_UNAVAILABLE');
    }
    return { version: 2, kind: step.acceptance.kind, userTask: plan.userTask, requiredTools: [...step.requiredTools],
        finalStep: plan.nextStepIndex === plan.steps.length - 1,
        priorEvidence: plan.evidenceSteps.flatMap((entry) => entry.receipts) };
}

export function planView(plan) {
    const { id, conversationId, title, summary, steps, nextStepIndex, completedSteps, status, stepEvidence, businessEvaluation, schemaVersion } = plan;
    return { id, conversationId, title, summary, steps, nextStepIndex, completedSteps,
        status: schemaVersion === 2 ? status : 'needs-regeneration', schemaVersion,
        ...(businessEvaluation ? { businessEvaluation } : {}),
        ...(Array.isArray(stepEvidence) ? { stepEvidence: stepEvidence.slice(-8) } : {}) };
}
