import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorTaskCriteria, verifyCreatorTaskReceipt } from '../dist/creator-task-acceptance.js';
import { evaluateGoalEvidence } from '../dist/task-system.js';

// Contract behavior remains independent of the model/parser implementation.
const target = { target: 'Canvas/Foo', field: 'node.position.x', equals: 200 };
const scenarios = [
    { id: 'INT-01', task: '把 Canvas/Foo 的 x 改为 200', kind: 'write', target },
    { id: 'INT-02', task: '将 Canvas/Foo 的 x 设置为 200', kind: 'write', target },
    { id: 'INT-03', task: '解释如何创建一个按钮', kind: 'explain' },
    { id: 'INT-04', task: '只读检查场景，不写入、不审批、不预览', kind: 'read' },
    { id: 'INT-05', task: '读取场景快照，然后把 Canvas/Foo 的 x 改为 200', kind: 'mixed', target,
        readTools: ['cocos_2x_scene_snapshot'] },
    { id: 'INT-06', task: 'Inspect without changing existing nodes, then create a node', kind: 'write',
        needsReviewedTargets: true },
    { id: 'INT-07', task: '读取 HelloWorld.js，解释如何修改按钮逻辑', kind: 'read',
        readTools: ['cocos_2x_script_read'], scriptPath: 'HelloWorld.js' },
    { id: 'INT-08', task: '读取场景快照，并读取 HelloWorld.js 检查脚本内容', kind: 'read',
        readTools: ['cocos_2x_scene_snapshot', 'cocos_2x_script_read'], scriptPath: 'HelloWorld.js' },
    { id: 'INT-10', task: '我只想知道如何创建一个按钮，请解释步骤，不要修改工程', kind: 'explain', intent: true },
];
const mutationRequirements = new Set(['creator-content-write', 'creator-restoration-write', 'creator-memory-write']);

for (const scenario of scenarios) {
    test(`${scenario.id}: ${scenario.task}`, () => {
        const intent = scenario.intent ? { version: 1, task: scenario.task, kind: scenario.kind,
            sourceQuotes: [scenario.task], reads: [], targets: [], verification: 'none', question: '' } : undefined;
        const criteria = creatorTaskCriteria(scenario.task, undefined, intent);
        if (['write', 'mixed'].includes(scenario.kind)) {
            assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-content-write'),
                'an explicit modification must retain its write evidence requirement');
            assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-ledger'));
            assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-readback'));
        } else {
            assert.equal(criteria.filter((item) => mutationRequirements.has(item.receiptRequirement)).length, 0,
                'reading or explaining a method must not require a mutation');
            assert.equal(criteria.some((item) => ['creator-runtime', 'creator-interaction'].includes(item.receiptRequirement)), false,
                'reading or explaining a method must not require executing its example');
        }
        if (scenario.needsReviewedTargets) {
            assert.ok(criteria.some((item) => item.id === 'requested-target-unbound'),
                'a new node without a bound final target still needs a reviewable Plan');
        } else {
            assert.equal(criteria.some((item) => item.receiptRequirement === 'creator-scope-unknown'), false,
                'an unambiguous request must not be treated as an unknown task');
        }
        if (scenario.target) {
            assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-user-target'
                && item.expectation?.target === scenario.target.target && item.expectation?.field === scenario.target.field
                && item.expectation?.equals === scenario.target.equals), 'the user value must be bound independently of write receipts');
        }
        if (scenario.kind === 'read' || scenario.kind === 'mixed') {
            assert.ok(criteria.some((item) => ['creator-read', 'creator-requested-read', 'creator-requested-script'].includes(item.receiptRequirement)));
        }
        for (const name of scenario.readTools || []) {
            assert.ok(criteria.some((item) => item.requiredTools.includes(name)), `the requested ${name} evidence cannot disappear`);
        }
        if (scenario.scriptPath) {
            assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-requested-script'
                && item.expectation?.scriptPath === scenario.scriptPath), 'a different script or a scene read cannot substitute');
        }
    });
}

test('read-only operation ledger evidence satisfies the exact requested read regardless of tool role', () => {
    const task = 'Read-only: inspect the compensation operation ledger';
    const intent = { version: 1, task, kind: 'read', sourceQuotes: [task], reads: ['cocos_2x_operation_get'],
        targets: [], verification: 'none', question: '' };
    const [criterion] = creatorTaskCriteria(task, undefined, intent);
    const receipt = { callId: 'operation-read', toolName: 'cocos_2x_operation_get', access: 'read', role: 'recovery',
        result: { isError: false, structuredContent: { success: true, outcome: 'completed', operationId: 'op-1' } } };
    assert.equal(verifyCreatorTaskReceipt(criterion, receipt, [receipt]), true);
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...receipt, role: 'context' }, [receipt]), true);
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...receipt, access: 'write' }, [receipt]), false);
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...receipt, toolName: 'cocos_2x_scene_node_inspect' }, [receipt]), false);
});

test('INT-11: a Button node name does not request interaction proof for a position-only change', () => {
    const task = '将 Canvas/Button 的 x 改为 200，仅修改位置。';
    const target = { target: 'Canvas/Button', field: 'node.position.x', equals: 200 };
    const intent = { version: 1, task, kind: 'write', sourceQuotes: [task], reads: [], targets: [target],
        verification: 'runtime', question: '' };
    const criteria = creatorTaskCriteria(task, [target], intent);
    assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-content-write'));
    assert.ok(criteria.some((item) => item.receiptRequirement === 'creator-user-target'
        && item.expectation?.target === target.target && item.expectation?.equals === target.equals));
    assert.equal(criteria.some((item) => item.receiptRequirement === 'creator-interaction'), false,
        'interaction proof requires an interaction request, not the word Button in a node path');
});

test('English set/change intent variants bind the same user target and acceptance', () => {
    const expected = { target: 'Canvas/Foo', field: 'node.position.x', equals: 200 };
    const tasks = [
        'Set Canvas/Foo x to 200',
        'Change Canvas/Foo x to 200',
        'Set the local x position of Canvas/Foo to 200',
        'Change the local x position of Canvas/Foo to 200',
    ];
    const bound = tasks.map((task) => creatorTaskCriteria(task, [expected], {
        version: 1, task, kind: 'write', sourceQuotes: [task], reads: [], targets: [expected], verification: 'runtime', question: '',
    }).filter((item) => item.receiptRequirement === 'creator-user-target').map((item) => item.expectation));
    assert.ok(bound.every((targets) => targets.length === 1 && targets[0].target === expected.target
        && targets[0].field === expected.field && targets[0].equals === expected.equals));
});

test('INT-12: a requested operation ledger read must match the exact operation ID', () => {
    const operationId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const task = `只读读取 operation ${operationId} 的账本。`;
    const intent = { version: 1, task, kind: 'read', sourceQuotes: [task], reads: ['cocos_2x_operation_get'],
        targets: [], verification: 'none', question: '' };
    const [criterion] = creatorTaskCriteria(task, undefined, intent);
    const [withoutIntent] = creatorTaskCriteria(task);
    const [misclassifiedIntent] = creatorTaskCriteria(task, undefined,
        { ...intent, kind: 'explain', reads: [] });
    assert.equal(criterion.expectation?.operationId, operationId,
        'the requested ledger identity must survive intent-to-acceptance mapping');
    assert.equal(withoutIntent.expectation?.operationId, operationId,
        'the exact target comes from the user request, not from a model-proposed target');
    assert.equal(misclassifiedIntent.expectation?.operationId, operationId,
        'a lower-confidence explanation proposal cannot erase an explicit ledger read');
    const receipt = (id) => ({ callId: `read-${id}`, toolName: 'cocos_2x_operation_get', access: 'read', role: 'recovery',
        result: { isError: false, structuredContent: { success: true, outcome: 'completed', operationId: id } } });
    assert.equal(verifyCreatorTaskReceipt(criterion, receipt('bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
        [receipt('bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee')]), false,
    'a successful receipt for a different operation cannot satisfy this read');
    const wrongReceipt = receipt('bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    const evaluation = evaluateGoalEvidence({ taskId: 'task_exact_operation', criteria: [criterion] }, [wrongReceipt], verifyCreatorTaskReceipt);
    assert.equal(evaluation.satisfied, false);
    assert.deepEqual(evaluation.outstanding.map((item) => item.id), [criterion.id],
        'a mismatched receipt leaves the requested read incomplete');
    const matchingReceipt = receipt(operationId);
    assert.equal(verifyCreatorTaskReceipt(criterion, matchingReceipt, [matchingReceipt]), true);
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...matchingReceipt, callId: '' }, [matchingReceipt]), false,
        'a receipt without a tool call ID is not valid evidence');
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...matchingReceipt, access: 'write' }, [matchingReceipt]), false,
        'a write receipt cannot satisfy a read request');
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...matchingReceipt, toolName: 'cocos_2x_script_operation_get' }, [matchingReceipt]), false,
        'the wrong ledger tool cannot satisfy the request');
});

test('a requested script operation ID binds to the script ledger tool and exact receipt ID', () => {
    const operationId = 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const task = `只读读取脚本操作账本 operation ID ${operationId}。`;
    const intent = { version: 1, task, kind: 'read', sourceQuotes: [task], reads: ['cocos_2x_script_operation_get'],
        targets: [], verification: 'none', question: '' };
    const [criterion] = creatorTaskCriteria(task, undefined, intent);
    assert.deepEqual(criterion.requiredTools, ['cocos_2x_script_operation_get']);
    assert.equal(criterion.expectation?.operationId, operationId);
    const receipt = { callId: 'script-ledger-read', toolName: 'cocos_2x_script_operation_get', access: 'read', role: 'recovery',
        result: { isError: false, structuredContent: { success: true, outcome: 'completed', operationId } } };
    assert.equal(verifyCreatorTaskReceipt(criterion, receipt, [receipt]), true);
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...receipt,
        result: { ...receipt.result, structuredContent: { ...receipt.result.structuredContent, operationId: 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee' } },
    }, [receipt]), false);
});

test('a requested project-memory operation ID binds to the memory ledger tool', () => {
    const operationId = 'eeeeeeee-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    const task = `只读读取记忆操作账本 operation ID ${operationId}。`;
    const [criterion] = creatorTaskCriteria(task);
    assert.deepEqual(criterion.requiredTools, ['cocos_2x_memory_operation_get']);
    assert.equal(criterion.expectation?.operationId, operationId);
    const receipt = { callId: 'memory-ledger-read', toolName: 'cocos_2x_memory_operation_get', access: 'read', role: 'recovery',
        result: { isError: false, structuredContent: { success: true, outcome: 'completed', operationId } } };
    assert.equal(verifyCreatorTaskReceipt(criterion, receipt, [receipt]), true);
    assert.equal(verifyCreatorTaskReceipt(criterion, { ...receipt, toolName: 'cocos_2x_operation_get' }, [receipt]), false);
});
