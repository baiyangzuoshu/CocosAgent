import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStructuredPlan, planStepTask } from './structured-plan.mjs';

const valid = { version: 1, title: 'Create a node', summary: 'Create a temporary node after verifying its parent.', steps: [
    { title: 'Inspect parent', description: 'Read the Canvas identity.', preconditions: ['helloworld scene is open'],
        validation: 'Parent UUID matches the live receipt.', recovery: 'Stop if the scene changed.' },
    { title: 'Create node', description: 'Add an empty node with the approved name.', preconditions: [],
        validation: 'Read the node and operation receipt.', recovery: 'Compensate by source operation ID.' },
] };

test('structured plans parse plain JSON and fenced JSON into a bounded schema', () => {
    assert.deepEqual(parseStructuredPlan(JSON.stringify(valid)), valid);
    assert.deepEqual(parseStructuredPlan(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``), valid);
});

test('structured plans reject executable fields, empty plans, long text, and oversized plans', () => {
    for (const candidate of [
        { ...valid, extraTool: 'run-script' }, { ...valid, steps: [] },
        { ...valid, steps: Array.from({ length: 9 }, () => valid.steps[0]) },
        { ...valid, steps: [{ ...valid.steps[0], tool: 'cocos_2x_command_execute' }] },
        { ...valid, title: 'x'.repeat(121) },
    ]) assert.throws(() => parseStructuredPlan(JSON.stringify(candidate)));
    assert.throws(() => parseStructuredPlan('x'.repeat(12_001)));
});

test('step task contains only one plan step and forbids later or unrelated changes', () => {
    const plan = { ...valid, userTask: 'Create the requested node.' };
    const task = planStepTask(plan, 1);
    assert.match(task, /exactly the currently approved Plan step/);
    assert.match(task, /Current step 2\/2: Create node/);
    assert.match(task, /Do not execute, preview, or claim later steps/);
    assert.throws(() => planStepTask(plan, 2), /PLAN_STEP_OUT_OF_RANGE/);
});
