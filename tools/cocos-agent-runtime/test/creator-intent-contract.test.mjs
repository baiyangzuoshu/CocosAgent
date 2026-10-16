import assert from 'node:assert/strict';
import test from 'node:test';
import { creatorTaskCriteria, verifyCreatorTaskReceipt } from '../dist/creator-task-acceptance.js';

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
];
const mutationRequirements = new Set(['creator-content-write', 'creator-restoration-write', 'creator-memory-write']);

for (const scenario of scenarios) {
    test(`${scenario.id}: ${scenario.task}`, () => {
        const criteria = creatorTaskCriteria(scenario.task);
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
