import test from 'node:test';
import assert from 'node:assert/strict';
import { beginPlanStep, createPlan, finishPlanStep, hasPlanSetupReceipts, planView } from './assistant-plan-service.mjs';

const data = { title: 'Two steps', summary: 'Check, then act.', steps: [
    { title: 'Read', description: 'Inspect.', preconditions: [], validation: 'Receipt.', recovery: 'Stop.' },
    { title: 'Write', description: 'Make the approved change.', preconditions: ['Fresh state'], validation: 'Read back.', recovery: 'Compensate.' },
] };

test('plan setup accepts successful receipts in the tool result shape', () => {
    assert.equal(hasPlanSetupReceipts([
        { name: 'cocos_2x_instances_list', structuredContent: { success: true, instances: [] } },
        { name: 'cocos_2x_capabilities_list', structuredContent: { success: true, commands: [] } },
    ]), true);
    assert.equal(hasPlanSetupReceipts([
        { name: 'cocos_2x_instances_list', structuredContent: { success: true } },
        { name: 'cocos_2x_capabilities_list', structuredContent: { success: false } },
    ]), false);
    assert.equal(hasPlanSetupReceipts([{ name: 'cocos_2x_instances_list', structuredContent: { success: true } }]), false);
    assert.equal(hasPlanSetupReceipts(undefined), false);
});

test('plan steps require explicit click, correct conversation, and strict order', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Do task.', data });
    assert.equal(plan.status, 'proposed');
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-b', planId: plan.id, stepIndex: 0 }), /PLAN_NOT_FOUND/);
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    assert.equal(plan.status, 'running');
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 1 }), /PLAN_STEP_OUT_OF_ORDER/);
    finishPlanStep(plan, { status: 'completed', receipts: [{ name: 'cocos_2x_operation_get', structuredContent: {
        success: true, outcome: 'completed', operationId: 'verified-source-operation',
    } }] });
    assert.equal(plan.status, 'waiting-next');
    assert.equal(plan.completedSteps, 1);
    const nextTask = beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 1 });
    assert.match(nextTask, /verified-source-operation/);
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 }), /PLAN_STEP_OUT_OF_ORDER/);
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 1 }), /PLAN_NOT_READY/);
    finishPlanStep(plan, { status: 'completed', receipts: [] });
    assert.equal(plan.status, 'completed');
    assert.equal(planView(plan).completedSteps, 2);
});

test('rejected unexecuted steps can be retried but uncertain results lock the plan', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Do task.', data });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'awaiting-approval', toolCalls: 1 });
    assert.equal(plan.status, 'paused');
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'needs-review', toolCalls: 2 });
    assert.equal(plan.status, 'needs-review');
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 }), /PLAN_NOT_READY/);
});
