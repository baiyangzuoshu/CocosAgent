import assert from 'node:assert/strict';
import test from 'node:test';
import { CreatorTaskSystem, evaluateGoalEvidence } from '../dist/task-system.js';

function persistence() {
    let saved = [];
    return { load: () => saved, save: (value) => { saved = structuredClone(value); }, read: () => structuredClone(saved) };
}

function receipt(toolName, callId, success = true, role = 'task') {
    return { toolName, callId, access: 'read', role, result: { structuredContent: { success } } };
}

test('persistent task graph assigns IDs, tracks dependencies, rejects cycles, and completes only from successful receipts', async () => {
    const store = persistence();
    const system = new CreatorTaskSystem(store);
    const parent = await system.create({ subject: 'Inspect', description: 'Inspect Creator state', acceptanceCriteria: [
        { id: 'readback', description: 'Read the saved scene', requiredTools: ['cocos_2x_scene_snapshot'] },
    ] });
    const child = await system.create({ subject: 'Preview', description: 'Preview the result', blockedBy: [parent.id], acceptanceCriteria: [
        { id: 'visual', description: 'Observe the preview', requiredTools: ['cocos_2x_runtime_observe'] },
    ] });
    await assert.rejects(system.update(parent.id, { blockedBy: [child.id] }), /TASK_DEPENDENCY_CYCLE/);
    await assert.rejects(system.claim(child.id), /TASK_BLOCKED_BY/);
    assert.equal((await system.claim(parent.id)).status, 'in_progress');
    let progress = await system.recordReceipts(parent.id, [receipt('cocos_2x_scene_snapshot', 'bad', false)]);
    assert.equal(progress.task.status, 'in_progress');
    assert.equal(progress.outstanding[0].id, 'readback');
    progress = await system.recordReceipts(parent.id, [receipt('cocos_2x_scene_snapshot', 'good')], false);
    assert.equal(progress.task.status, 'in_progress', 'receipt evidence alone does not bypass the run policy terminal gate');
    progress = await system.recordReceipts(parent.id, [receipt('cocos_2x_scene_snapshot', 'good')]);
    assert.equal(progress.task.status, 'completed');
    assert.equal((await system.claim(child.id)).status, 'in_progress');
    const restored = new CreatorTaskSystem(store);
    assert.equal((await restored.get(parent.id)).status, 'completed');
    assert.equal((await restored.get(child.id)).blockedBy[0], parent.id);
    assert.equal((await restored.tools()).some((tool) => tool.name === 'agent_task_complete'), false,
        'the model has no direct completion setter');
});

test('task tools are local metadata and never carry Creator write access', async () => {
    const system = new CreatorTaskSystem(persistence());
    const tools = system.tools();
    assert.ok(tools.length >= 5);
    assert.ok(tools.every((tool) => tool.access === 'read' && tool.role === 'task-system'));
    const result = await system.invoke('agent_task_create', { subject: 'A', description: 'B',
        acceptanceCriteria: [{ id: 'c', description: 'Use evidence', requiredTools: ['tool.one'] }] });
    assert.equal(result.structuredContent.success, true);
});

test('explicit goal evidence ignores model prose and requires every declared successful tool receipt', () => {
    const goal = { taskId: 'task_1234abcd', criteria: [
        { id: 'saved', description: 'Saved scene readback', requiredTools: ['scene.readback'] },
        { id: 'preview', description: 'Preview accepted', requiredTools: ['preview.accept'] },
    ] };
    const partial = evaluateGoalEvidence(goal, [receipt('scene.readback', 'one')]);
    assert.equal(partial.satisfied, false);
    assert.deepEqual(partial.outstanding.map((item) => item.id), ['preview']);
    assert.deepEqual(partial.outstanding[0].missingTools, ['preview.accept']);
    assert.equal(evaluateGoalEvidence(goal, [receipt('scene.readback', 'one'), receipt('preview.accept', 'two')]).satisfied, true);
});
