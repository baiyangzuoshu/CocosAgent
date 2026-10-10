import crypto from 'node:crypto';
import { planStepTask } from './structured-plan.mjs';

const REQUIRED_PLAN_SETUP_TOOLS = new Set(['cocos_2x_instances_list', 'cocos_2x_capabilities_list']);

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
    if (result.status === 'completed') {
        const receipts = (result.receipts || []).filter((receipt) => receipt.structuredContent?.success === true)
            .map((receipt) => {
                const source = receipt.structuredContent;
                const observation = { name: receipt.name };
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
    } else if (result.status === 'awaiting-approval' || (result.status === 'stopped' && result.toolCalls === 0)) {
        plan.status = 'paused';
    } else {
        // A dispatched step may have changed the editor even when the turn lacks a terminal receipt.
        plan.status = 'needs-review';
    }
    return plan;
}

export function planView(plan) {
    const { id, conversationId, title, summary, steps, nextStepIndex, completedSteps, status } = plan;
    return { id, conversationId, title, summary, steps, nextStepIndex, completedSteps, status };
}
