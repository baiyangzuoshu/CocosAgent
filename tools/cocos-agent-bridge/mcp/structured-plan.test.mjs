import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredPlan, planStepTask } from './structured-plan.mjs';

const valid = { version: 2, title: 'Create a node', summary: 'Create a temporary node after verifying its parent.', steps: [
    { title: 'Inspect parent', description: 'Read the Canvas identity.', preconditions: ['helloworld scene is open'],
        requiredTools: ['cocos_2x_scene_snapshot', 'cocos_2x_scene_node_inspect'],
        validation: 'Parent UUID matches the live receipt.', recovery: 'Stop if the scene changed.', acceptance: { kind: 'read' } },
    { title: 'Create node', description: 'Add an empty node with the approved name.', preconditions: [],
        requiredTools: ['cocos_2x_command_execute', 'cocos_2x_operation_get', 'cocos_2x_scene_node_inspect'],
        validation: 'Read the node and operation receipt.', recovery: 'Compensate by source operation ID.',
        acceptance: { kind: 'write', targets: [{ target: 'helloworld/Canvas/Temp', field: 'node.name', equals: 'Temp' }] } },
] };

test('structured plans parse plain JSON and fenced JSON into a bounded schema', () => {
    assert.deepEqual(parseStructuredPlan(JSON.stringify(valid)), valid);
    assert.deepEqual(parseStructuredPlan(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``), valid);
    assert.deepEqual(parseStructuredPlan(`Here is the reviewable plan:\n${JSON.stringify(valid)}`), valid);
    assert.throws(() => parseStructuredPlan(`${JSON.stringify(valid)}\nA second claim follows.`), /INVALID_PLAN_TRAILING_TEXT/);
});

test('structured plans repair only unescaped quotes inside text values before strict schema validation', () => {
    const expected = structuredClone(valid);
    expected.steps[0].description = 'Read the "Canvas" identity.';
    const malformed = JSON.stringify(valid).replace('Read the Canvas identity.', 'Read the "Canvas" identity.');
    assert.deepEqual(parseStructuredPlan(malformed), expected);
    assert.throws(() => parseStructuredPlan('{"version":1,"title":"broken" "summary":"missing comma"}'));
});

test('structured plans reject tools absent from the current Creator MCP catalog', () => {
    const allowedToolNames = [
        'cocos_2x_scene_snapshot',
        'cocos_2x_scene_node_inspect',
        'cocos_2x_command_execute',
        'cocos_2x_operation_get',
    ];
    assert.deepEqual(parseStructuredPlan(JSON.stringify(valid), { availableToolNames: allowedToolNames }), valid);
    const unknownToolPlan = structuredClone(valid);
    unknownToolPlan.steps[0].requiredTools[0] = 'cocos_2x_nonexistent_tool';
    assert.throws(() => parseStructuredPlan(JSON.stringify(unknownToolPlan), { availableToolNames: allowedToolNames }),
        /INVALID_PLAN_UNKNOWN_TOOL/);
    const setupToolPlan = structuredClone(valid);
    setupToolPlan.steps[0].requiredTools[0] = 'cocos_2x_capabilities_list';
    assert.throws(() => parseStructuredPlan(JSON.stringify(setupToolPlan), { availableToolNames: [
        ...allowedToolNames, 'cocos_2x_capabilities_list',
    ] }), /INVALID_PLAN_REQUIRED_TOOLS/);
});

test('read-only Plan mode can name registered writer tools for later separately approved steps', () => {
    assert.deepEqual(parseStructuredPlan(JSON.stringify(valid), { availableToolNames: [
        'cocos_2x_scene_snapshot', 'cocos_2x_scene_node_inspect', 'cocos_2x_operation_get',
    ] }), valid);
});

test('a read step may mention an available future write command without requiring writer tools', () => {
    const plan = structuredClone(valid);
    plan.steps[0].preconditions.push('scene.node.patch reports available for this project');
    assert.deepEqual(parseStructuredPlan(JSON.stringify(plan), { availableToolNames: [
        'cocos_2x_scene_snapshot', 'cocos_2x_scene_node_inspect', 'cocos_2x_operation_get',
    ] }), plan);
});

test('structured plans require tools explicitly named by the step contract', () => {
    const covered = structuredClone(valid);
    covered.steps[1].description = 'Apply scene.node.create and inspect its operation.get receipt.';
    covered.steps[1].requiredTools = [
        'cocos_2x_command_execute', 'cocos_2x_operation_get', 'cocos_2x_scene_node_inspect',
    ];
    assert.deepEqual(parseStructuredPlan(JSON.stringify(covered)), covered);

    const missingOperation = structuredClone(covered);
    missingOperation.steps[1].requiredTools = ['cocos_2x_command_execute', 'cocos_2x_scene_node_inspect'];
    assert.throws(() => parseStructuredPlan(JSON.stringify(missingOperation)), /INVALID_PLAN_TOOL_COVERAGE:cocos_2x_operation_get/);

    const preview = structuredClone(valid);
    preview.steps[0].description = 'Record operation.preview.accept after runtime.observe.';
    preview.steps[0].requiredTools.push('cocos_2x_operation_preview_accept', 'cocos_2x_runtime_observe');
    assert.deepEqual(parseStructuredPlan(JSON.stringify(preview)), preview);
    preview.steps[0].requiredTools = ['cocos_2x_scene_snapshot', 'cocos_2x_scene_node_inspect'];
    assert.throws(() => parseStructuredPlan(JSON.stringify(preview)), /INVALID_PLAN_TOOL_COVERAGE/);
});

test('structured plans reject executable fields, empty plans, long text, and oversized plans', () => {
    for (const candidate of [
        { ...valid, extraTool: 'run-script' }, { ...valid, steps: [] },
        { ...valid, steps: Array.from({ length: 9 }, () => valid.steps[0]) },
        { ...valid, steps: [{ ...valid.steps[0], tool: 'cocos_2x_command_execute' }] },
        { ...valid, steps: [{ ...valid.steps[0], requiredTools: undefined }] },
        { ...valid, steps: [{ ...valid.steps[0], requiredTools: ['cocos_2x_command_execute', 'cocos_2x_command_execute'] }] },
        { ...valid, steps: [{ ...valid.steps[0], requiredTools: ['cocos_2x_capabilities_list'] }] },
        { ...valid, steps: [{ ...valid.steps[0], requiredTools: ['node.inspect'] }] },
        { ...valid, title: 'x'.repeat(121) },
    ]) assert.throws(() => parseStructuredPlan(JSON.stringify(candidate)));
    assert.throws(() => parseStructuredPlan('x'.repeat(12_001)));
});

test('write plans require reviewed targets with typed values and reject old v1 plans', () => {
    const missing = structuredClone(valid); delete missing.steps[1].acceptance.targets;
    assert.throws(() => parseStructuredPlan(JSON.stringify(missing)), /INVALID_PLAN_TARGETS_REQUIRED/);
    const wrong = structuredClone(valid); wrong.steps[1].acceptance.targets[0] = { target: 'node-1', field: 'node.active', equals: 'yes' };
    assert.throws(() => parseStructuredPlan(JSON.stringify(wrong)), /CREATOR_TARGET_VALUE_INVALID/);
    assert.throws(() => parseStructuredPlan(JSON.stringify({ ...valid, version: 1 })), /INVALID_PLAN_VERSION_OR_STEPS/);
});

test('step task contains only one plan step and forbids later or unrelated changes', () => {
    const plan = { ...valid, userTask: 'Create the requested node.' };
    const task = planStepTask(plan, 1);
    assert.match(task, /exactly the currently approved Plan step/);
    assert.match(task, /Current step 2\/2: Create node/);
    assert.match(task, /Do not execute, preview, or claim later steps/);
    assert.match(task, /cocos_2x_command_execute, cocos_2x_operation_get, cocos_2x_scene_node_inspect/);
    assert.throws(() => planStepTask(plan, 2), /PLAN_STEP_OUT_OF_RANGE/);
});
