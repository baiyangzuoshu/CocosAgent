import crypto from 'node:crypto';
import { planStepTask } from './structured-plan.mjs';

const REQUIRED_PLAN_SETUP_TOOLS = new Set(['cocos_2x_instances_list', 'cocos_2x_capabilities_list']);
const AGENT_SETUP_TOOLS = new Set(['cocos_2x_instances_list', 'cocos_2x_instances_get', 'cocos_2x_capabilities_list']);

function successfulTaskReceipt(receipt) {
    const value = receipt?.structuredContent;
    return !AGENT_SETUP_TOOLS.has(receipt?.name)
        && value?.success === true
        && !['needs-review', 'in-progress', 'needs-preview'].includes(value.outcome);
}

function uncertainWriteReceipt(receipt) {
    const value = receipt?.structuredContent;
    return receipt?.access !== 'read' && !AGENT_SETUP_TOOLS.has(receipt?.name)
        && (value?.outcome === 'needs-review'
            || value?.error?.sideEffect === 'possible'
            || value?.error?.sideEffect === 'unknown');
}

function unresolvedWriteReceipt(receipt) {
    const value = receipt?.structuredContent;
    if (AGENT_SETUP_TOOLS.has(receipt?.name) || receipt?.access === 'read') return false;
    if (receipt?.access === undefined) return true;
    return value?.success === true && !['completed', 'already-terminal', 'no-effect'].includes(value.outcome);
}

function successfulWriteReceipt(receipt) {
    return receipt?.access !== 'read' && !AGENT_SETUP_TOOLS.has(receipt?.name)
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
        conversationId,
        userTask,
        title: data.title,
        summary: data.summary,
        steps: data.steps,
        nextStepIndex: 0,
        completedSteps: 0,
        status: 'proposed',
    };
}

export function beginPlanStep(plan, { conversationId, planId, stepIndex }) {
    if (!plan || plan.id !== planId || plan.conversationId !== conversationId) throw new Error('PLAN_NOT_FOUND');
    if (!Number.isInteger(stepIndex) || stepIndex !== plan.nextStepIndex || stepIndex >= plan.steps.length) {
        throw new Error('PLAN_STEP_OUT_OF_ORDER');
    }
    if (!['proposed', 'waiting-next', 'paused'].includes(plan.status)) throw new Error('PLAN_NOT_READY');
    plan.status = 'running';
    return planStepTask(plan, stepIndex, plan.stepEvidence || []);
}

export function finishPlanStep(plan, result) {
    if (!plan || plan.status !== 'running') return plan;
    const allReceipts = Array.isArray(result.receipts) ? result.receipts : [];
    const requiredTools = plan.steps[plan.nextStepIndex]?.requiredTools || [];
    const successfulNames = new Set(allReceipts.filter(successfulTaskReceipt).map((receipt) => receipt.name));
    const requiredToolsSatisfied = requiredTools.length > 0 && requiredTools.every((name) => successfulNames.has(name));
    const hasTaskReceipt = allReceipts.some(successfulTaskReceipt);
    const hasUncertainWrite = result.status === 'needs-review' || allReceipts.some(uncertainWriteReceipt);
    const hasUnresolvedWrite = allReceipts.some(unresolvedWriteReceipt)
        || (result.status !== 'completed' && allReceipts.some(successfulWriteReceipt));
    const hasSuccessfulWrite = allReceipts.some(successfulWriteReceipt);
    if (hasUncertainWrite) {
        plan.status = 'needs-review';
    } else if (result.status === 'completed' && requiredToolsSatisfied && hasTaskReceipt && !hasUnresolvedWrite) {
        const receipts = allReceipts.filter(successfulTaskReceipt)
            .map((receipt) => {
                const source = receipt.structuredContent;
                const observation = { name: receipt.name, ...(receipt.access ? { access: receipt.access } : {}) };
                for (const key of ['outcome', 'command', 'operationId', 'status', 'instance', 'createdNodeUuid',
                    'targetNodeUuid', 'parentUuid', 'node', 'result', 'phases', 'reconciliation']) {
                    if (source[key] !== undefined) observation[key] = source[key];
                }
                return observation;
            });
        plan.stepEvidence = [...(plan.stepEvidence || []), { stepIndex: plan.nextStepIndex, receipts }].slice(-8);
        plan.completedSteps += 1;
        plan.nextStepIndex = plan.completedSteps;
        plan.status = plan.completedSteps === plan.steps.length ? 'completed' : 'waiting-next';
    } else if (hasUnresolvedWrite || (hasSuccessfulWrite && !requiredToolsSatisfied)) {
        plan.status = 'needs-review';
    } else {
        // Setup/read-only calls and rejected approvals have no project side effect, so retry is safe.
        plan.status = 'paused';
    }
    return plan;
}

export function planView(plan) {
    const { id, conversationId, title, summary, steps, nextStepIndex, completedSteps, status } = plan;
    return { id, conversationId, title, summary, steps, nextStepIndex, completedSteps, status };
}
