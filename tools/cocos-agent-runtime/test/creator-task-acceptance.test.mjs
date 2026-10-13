import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorTaskCriteria, verifyCreatorTaskReceipt } from '../dist/creator-task-acceptance.js';
import { CreatorTaskSystem, evaluateGoalEvidence } from '../dist/task-system.js';

const operation = '11111111-1111-4111-8111-111111111111';
const sceneUuid = '22222222-2222-4222-8222-222222222222';
let call = 0;
const receipt = (toolName, structuredContent, access = 'read') => ({ toolName, callId: `call-${++call}`, access,
    role: toolName.includes('operation_get') ? 'recovery' : 'task', result: { structuredContent } });
const inspect = (uuid = 'node-1', x = 20) => receipt('cocos_2x_scene_node_inspect', { success: true, result: { node: {
    status: 'found', uuid, name: 'TestNode', transform: { position: { x, y: 0 } }, componentDetails: [],
} } });
const write = (id = operation, x = 20) => receipt('cocos_2x_command_execute', { success: true, outcome: 'completed', command: 'scene.node.patch',
    operationId: id, instance: { activeSceneUuid: sceneUuid }, phases: { editor: 'passed', disk: 'passed', preview: 'passed' },
    result: { action: 'apply', targetNodeUuid: 'node-1', expectedDiff: [{ path: 'node.position.x', before: 0, after: x }] },
}, 'write');
const ledger = (change) => receipt('cocos_2x_operation_get', change.result.structuredContent);
const observe = (errors = [], uuid = sceneUuid) => receipt('cocos_2x_runtime_observe', { success: true, outcome: 'observed',
    scene: { uuid, matchesExpected: true }, runtime: { status: errors.length ? 'runtime-error' : 'running', frameDelta: 10, capturedErrorCount: errors.length },
    diagnostics: { errors }, targetNode: { uuid: 'node-1' }, screenshot: { available: true },
});
function evaluate(task, receipts) {
    return evaluateGoalEvidence({ taskId: 'task_1234abcd', criteria: creatorTaskCriteria(task) }, receipts, verifyCreatorTaskReceipt);
}

test('scene inspection and starting preview cannot complete a requested network dialog', () => {
    const snapshot = receipt('cocos_2x_scene_snapshot', { success: true, scene: { uuid: sceneUuid } });
    const preview = receipt('cocos_2x_command_execute', { success: true, command: 'runtime.preview.start', outcome: 'completed' }, 'write');
    for (const task of ['创建一个网络连接弹窗', '分析场景，创建网络连接弹窗', '记住项目约定，然后创建网络连接弹窗', 'Inspect the scene and create a network connection dialog']) {
        const result = evaluate(task, [snapshot, preview]);
        assert.equal(result.satisfied, false);
        assert.ok(result.outstanding.some((item) => item.id === 'content-written'));
        assert.ok(result.outstanding.some((item) => item.id === 'interaction-verified'));
        assert.ok(creatorTaskCriteria(task).every((item) => !item.requiredTools.includes('*')));
    }
});

test('a genuine read-only task still completes from a content receipt, but task metadata and skills do not', () => {
    assert.equal(evaluate('Read the scene', [receipt('cocos_2x_scene_snapshot', { success: true })]).satisfied, true);
    assert.equal(evaluate('不要修改项目，只读查看场景', [inspect()]).satisfied, true);
    for (const task of [
        '只读检查场景。禁止任何写入、补偿、重放。',
        'After restart, run a strictly read-only acceptance. No writes, approvals, preview, build, compensation, replay, or memory changes. Finally read the current scene.',
        'Please inspect the current scene. Do not write, compensate, replay, preview, or build.',
    ]) {
        const criteria = creatorTaskCriteria(task);
        assert.deepEqual(criteria.map((item) => item.id), ['requested-read'], task);
        assert.equal(evaluate(task, [receipt('cocos_2x_scene_snapshot', { success: true })]).satisfied, true, task);
    }
    assert.ok(creatorTaskCriteria('分析场景，然后创建节点').some((item) => item.id === 'content-written'),
        'a positive write request remains in scope when paired with a read request');
    assert.ok(creatorTaskCriteria('补偿恢复该节点').some((item) => item.id === 'content-written'),
        'a positive restoration request remains in scope');
    assert.equal(evaluate('分析场景', [receipt('agent_task_list', { success: true })]).satisfied, false);
    assert.equal(evaluate('检查场景', [receipt('cocos_2x_skills_list', { success: true })]).satisfied, false);
    assert.equal(evaluate('Do it', [inspect()]).satisfied, false, 'ambiguous tasks cannot silently become read-only');
});

test('an explicit multi-step read-only checklist requires a receipt for every requested verification', () => {
    const task = 'Run a strictly read-only acceptance. Verify the registered instance root and Creator version; read the live capability catalog; read the installed skills index; read cocos2-mcp-tools and its declared contract reference; finally call the dedicated scene snapshot for helloworld. No writes, approvals, preview, build, compensation, replay, or memory changes.';
    const criteria = creatorTaskCriteria(task);
    assert.deepEqual(criteria.map((item) => item.id), [
        'requested-instance', 'requested-capabilities', 'requested-skills-index', 'requested-skill-body',
        'requested-skill-reference', 'requested-scene-snapshot',
    ]);
    const tools = criteria.map((item) => receipt(item.requiredTools[0], { success: true }));
    assert.equal(evaluate(task, tools).satisfied, true);
    const setupTools = tools.map((item) => ({ ...item, role: 'setup' }));
    assert.equal(evaluate(task, setupTools).satisfied, true, 'explicit setup/read receipts satisfy requested read criteria');
    const writeTool = { ...setupTools[3], access: 'write' };
    assert.equal(evaluate(task, [...setupTools.slice(0, 3), writeTool, ...setupTools.slice(4)]).satisfied, false);
    assert.equal(evaluate(task, tools.slice(0, -1)).satisfied, false, 'the checklist remains open when its final snapshot is missing');
    const failedReference = structuredClone(tools[4]);
    failedReference.result.structuredContent.success = false;
    assert.equal(evaluate(task, [...tools.slice(0, 4), failedReference, tools[5]]).satisfied, false);
});

test('a scene edit requires its operation ledger and matching fresh UUID and expected fields', () => {
    const change = write();
    assert.equal(evaluate('Move the node', [change]).satisfied, false);
    assert.equal(evaluate('Move the node', [inspect(), change, ledger(change)]).satisfied, false, 'pre-write reads are stale');
    assert.equal(evaluate('Move the node', [change, ledger(change), inspect('another-node')]).satisfied, false);
    assert.equal(evaluate('Move the node', [change, ledger(change), inspect('node-1', 999)]).satisfied, false);
    assert.equal(evaluate('Move the node', [change, ledger(write('other-operation')), inspect()]).satisfied, false);
    assert.equal(evaluate('Move the node', [change, ledger(change), inspect()]).satisfied, true);
});

test('preview startup, memory writes, and unrelated successful tools cannot substitute for content writes', () => {
    const unrelated = receipt('cocos_2x_memory_remember', { success: true, outcome: 'remembered', operationId: operation }, 'write');
    assert.equal(evaluate('Create an empty node', [unrelated, inspect()]).satisfied, false);
    const fake = receipt('cocos_2x_command_execute', { success: true, command: 'scene.snapshot', operationId: operation,
        phases: { editor: 'passed', disk: 'passed' } }, 'write');
    assert.equal(evaluate('Create an empty node', [fake, inspect()]).satisfied, false);
});

test('initial runtime screenshots never prove button or network behavior, even with fabricated interaction fields', () => {
    const change = write(), runtime = observe();
    runtime.result.structuredContent.runtime.interactionVerified = true;
    const result = evaluate('创建网络连接弹窗', [change, ledger(change), inspect(), runtime]);
    assert.deepEqual(result.outstanding.map((item) => item.id), ['interaction-verified']);
});

test('runtime checks reject wrong scenes, runtime errors, stale observations, and mismatched nodes', () => {
    const change = write();
    const base = [change, ledger(change), inspect()];
    assert.equal(evaluate('Modify the UI', [...base, observe([], 'other-scene')]).satisfied, false);
    assert.equal(evaluate('Modify the UI', [...base, observe([{ message: 'TypeError' }])]).satisfied, false);
    assert.equal(evaluate('Modify the UI', [observe(), ...base]).satisfied, false);
    const wrongNode = observe(); wrongNode.result.structuredContent.targetNode.uuid = 'another-node';
    assert.equal(evaluate('Modify the UI', [...base, wrongNode]).satisfied, false);
    const missingImage = observe(); missingImage.result.structuredContent.screenshot.available = false;
    assert.equal(evaluate('Modify the UI', [...base, missingImage]).satisfied, false);
    assert.equal(evaluate('Modify the UI', [...base, observe()]).satisfied, true);
});

test('preview-required writes require matching post-observation operation acceptance', () => {
    const change = write(); change.result.structuredContent.phases.preview = 'pending';
    const accepted = receipt('cocos_2x_operation_preview_accept', { success: true, operationId: operation, phases: { preview: 'passed' } }, 'write');
    const base = [change, ledger(change), inspect()];
    assert.equal(evaluate('Modify the UI', [...base, observe()]).satisfied, false);
    assert.equal(evaluate('Modify the UI', [...base, accepted, observe()]).satisfied, false);
    assert.equal(evaluate('Modify the UI', [...base, observe(), accepted]).satisfied, true);
});

test('a later edit invalidates prior target readback and checks the latest target state', () => {
    const first = write(), second = write('33333333-3333-4333-8333-333333333333', 30);
    const oldEvidence = [first, ledger(first), inspect()];
    assert.equal(evaluate('Move the node', oldEvidence).satisfied, true);
    assert.equal(evaluate('Move the node', [...oldEvidence, second]).satisfied, false);
    assert.equal(evaluate('Move the node', [...oldEvidence, second, ledger(first), ledger(second), inspect('node-1', 30)]).satisfied, true);
});

test('script modifications require exact current source/metadata and successful Creator compilation', () => {
    const source = { state: 'completed', operationId: operation, scriptUuid: 'script-1', metaSha256: 'meta', beforeSha256: 'before', afterSha256: 'after',
        compilation: { status: 'compiled' } };
    const payload = { success: true, outcome: 'needs-runtime', operationId: operation, record: source,
        current: { scriptUuid: 'script-1', metaSha256: 'meta', sourceSha256: 'after' } };
    const change = receipt('cocos_2x_script_patch', { success: true, outcome: 'needs-runtime', command: 'script.patch', operationId: operation, result: payload }, 'write');
    const saved = receipt('cocos_2x_script_operation_get', { success: true, command: 'script.operation.get', operationId: operation, result: payload });
    assert.equal(evaluate('修改脚本，仅编译', [change, saved]).satisfied, true);
    const failedCompile = structuredClone(change); failedCompile.result.structuredContent.result.record.compilation.status = 'failed';
    assert.equal(evaluate('修改脚本，仅编译', [failedCompile, saved]).satisfied, false);
    const stale = structuredClone(saved); stale.result.structuredContent.result.current.sourceSha256 = 'before';
    assert.equal(evaluate('修改脚本，仅编译', [change, stale]).satisfied, false);
});

test('semantic criteria persist and cannot complete when their verifier is unavailable after restore', async () => {
    let saved = [];
    const store = { load: () => saved, save: (tasks) => { saved = structuredClone(tasks); } };
    const system = new CreatorTaskSystem(store, verifyCreatorTaskReceipt);
    const task = await system.create({ subject: 'Move node', description: 'Move node', acceptanceCriteria: creatorTaskCriteria('Move the node') });
    await system.claim(task.id);
    const change = write();
    assert.equal((await system.recordReceipts(task.id, [change, ledger(change), inspect()])).task.status, 'completed');
    const restored = new CreatorTaskSystem(store);
    assert.equal((await restored.recordReceipts(task.id, [inspect()])).task.status, 'in_progress');
    assert.ok(saved[0].acceptanceCriteria.every((item) => item.receiptRequirement));
});
