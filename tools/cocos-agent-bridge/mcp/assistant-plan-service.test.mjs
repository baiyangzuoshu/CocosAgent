import test from 'node:test';
import assert from 'node:assert/strict';
import { beginPlanStep, createPlan, finishPlanStep, hasPlanSetupReceipts, planView } from './assistant-plan-service.mjs';

const data = { title: 'Two steps', summary: 'Check, then act.', steps: [
    { title: 'Read', description: 'Inspect.', preconditions: [], requiredTools: ['cocos_2x_operation_get'], validation: 'Receipt.', recovery: 'Stop.' },
    { title: 'Write', description: 'Make the approved change.', preconditions: ['Fresh state'],
        requiredTools: ['cocos_2x_scene_node_inspect'], validation: 'Read back.', recovery: 'Compensate.' },
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
    finishPlanStep(plan, { status: 'completed', receipts: [{ name: 'cocos_2x_operation_get', access: 'read', structuredContent: {
        success: true, outcome: 'completed', operationId: 'verified-source-operation',
    } }] });
    assert.equal(plan.status, 'waiting-next');
    assert.equal(plan.completedSteps, 1);
    const nextTask = beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 1 });
    assert.match(nextTask, /verified-source-operation/);
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 }), /PLAN_STEP_OUT_OF_ORDER/);
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 1 }), /PLAN_NOT_READY/);
    finishPlanStep(plan, { status: 'completed', receipts: [{ name: 'cocos_2x_scene_node_inspect', access: 'read', structuredContent: {
        success: true, outcome: 'completed', result: { node: { status: 'not-found' } },
    } }] });
    assert.equal(plan.status, 'completed');
    assert.equal(planView(plan).completedSteps, 2);
});

test('rejected and read-only incomplete steps can be retried; uncertain writes lock the plan', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Do task.', data });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'awaiting-approval', toolCalls: 1 });
    assert.equal(plan.status, 'paused');
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'stopped', toolCalls: 2, receipts: [
        { name: 'cocos_2x_instances_list', access: 'read', structuredContent: { success: true } },
        { name: 'cocos_2x_capabilities_list', access: 'read', structuredContent: { success: true } },
    ] });
    assert.equal(plan.status, 'paused');
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'needs-review', toolCalls: 3, receipts: [{ name: 'cocos_2x_command_execute', access: 'write-approved', structuredContent: {
        success: false, outcome: 'needs-review', error: { sideEffect: 'unknown' },
    } }] });
    assert.equal(plan.status, 'needs-review');
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 }), /PLAN_NOT_READY/);
});

test('setup-only completed runs never complete a plan step', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Do task.', data });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'completed', receipts: [
        { name: 'cocos_2x_instances_list', access: 'read', structuredContent: { success: true } },
        { name: 'cocos_2x_capabilities_list', access: 'read', structuredContent: { success: true } },
    ] });
    assert.equal(plan.status, 'paused');
    assert.equal(plan.completedSteps, 0);
    assert.equal(plan.nextStepIndex, 0);
});

test('a step stays retryable when preflight reads succeed but its required task tool was never called', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Compensate the temporary node.', data: {
        ...data, steps: [{ title: 'Compensate and verify', description: 'Remove the temporary node and read back.',
            preconditions: [], requiredTools: ['cocos_2x_command_execute', 'cocos_2x_operation_get', 'cocos_2x_scene_node_inspect'],
            validation: 'The source operation is compensated and the node is absent.', recovery: 'Stop if any identity differs.' }],
    } });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'completed', receipts: [
        { name: 'cocos_2x_operation_get', access: 'read', structuredContent: { success: true, outcome: 'completed' } },
        { name: 'cocos_2x_scene_node_inspect', access: 'read', structuredContent: { success: true, outcome: 'completed' } },
    ] });
    assert.equal(plan.status, 'paused');
    assert.equal(plan.completedSteps, 0);
    assert.equal(plan.nextStepIndex, 0);
});

test('a successful write with missing required readback stays locked for review', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Create a node.', data: {
        ...data, steps: [{ title: 'Create and verify', description: 'Create the node and read it back.', preconditions: [],
            requiredTools: ['cocos_2x_command_execute', 'cocos_2x_scene_node_inspect'],
            validation: 'The node is present in the scene.', recovery: 'Compensate by operation ID.' }],
    } });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'completed', receipts: [{ name: 'cocos_2x_command_execute', access: 'write-approved',
        structuredContent: { success: true, outcome: 'completed', operationId: 'write-operation' } }] });
    assert.equal(plan.status, 'needs-review');
    assert.equal(plan.completedSteps, 0);
});

test('a required write receipt without access classification cannot complete a step', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Create a node.', data: {
        ...data, steps: [{ title: 'Create', description: 'Create the node.', preconditions: [],
            requiredTools: ['cocos_2x_command_execute'], validation: 'Read back the write.', recovery: 'Review the operation receipt.' }],
    } });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'completed', receipts: [{ name: 'cocos_2x_command_execute', structuredContent: {
        success: true, outcome: 'completed', operationId: 'write-operation',
    } }] });
    assert.equal(plan.status, 'needs-review');
    assert.equal(plan.completedSteps, 0);
});

test('an executed write without a completed step stays locked for receipt review', () => {
    const plan = createPlan({ conversationId: 'conversation-a', userTask: 'Do task.', data });
    beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 });
    finishPlanStep(plan, { status: 'stopped', toolCalls: 1, receipts: [{ name: 'cocos_2x_command_execute', access: 'write-approved', structuredContent: {
        success: true, outcome: 'completed', operationId: 'completed-but-not-validated',
    } }] });
    assert.equal(plan.status, 'needs-review');
    assert.throws(() => beginPlanStep(plan, { conversationId: 'conversation-a', planId: plan.id, stepIndex: 0 }), /PLAN_NOT_READY/);
});
