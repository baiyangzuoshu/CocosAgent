'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execute, plan, compensate, replay, get } = require('./scene-composition');

function fixture(failOn = null) {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-composition-'));
    const creatorVersion = '2.4.15';
    const targets = [{ projectRoot, creatorVersion }];
    const instance = { instanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', activeScene: 'helloworld' };
    const parentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const steps = [{ id: 'root', name: 'AgentRoot', parent: { path: 'helloworld/Canvas', uuid: parentUuid } },
        { id: 'child', name: 'AgentChild', parent: { ref: 'root' } }];
    const calls = [];
    const nodes = new Map([['helloworld/Canvas', parentUuid]]);
    const operations = new Map();
    const run = (request) => {
        calls.push(request);
        if (request.command === 'scene.node.inspect') return { success: true, instance, result: {
            node: nodes.has(request.input.nodePath)
                ? { status: 'found', uuid: nodes.get(request.input.nodePath) } : { status: 'not-found' } } };
        if (request.operationGetId) return operations.get(request.operationGetId) || { success: false };
        const { input } = request;
        if (input.action === 'apply' && input.nodeName === failOn) return { success: false, outcome: 'failed',
            error: { code: 'SCENE_NODE_CONFLICT', sideEffect: 'none' } };
        const nodePath = `${input.parentPath}/${input.nodeName}`;
        if (input.action === 'compensate') nodes.delete(nodePath);
        else nodes.set(nodePath, input.nodeName === 'AgentRoot'
            ? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' : 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
        const result = { success: true, outcome: 'completed', instance, phases: { disk: 'passed' },
            result: { nodeUuid: nodes.get(nodePath) || 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' } };
        operations.set(input.operationId, result);
        return result;
    };
    const params = { projectRoot, creatorVersion, targets, steps };
    return { params, run, calls, nodes, cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }) };
}

test('ordered node plan creates hierarchy, compensates in reverse order and replays', () => {
    const f = fixture();
    try {
        assert.equal(plan(f.params, f.run).outcome, 'ready');
        const applied = execute(f.params, f.run);
        assert.equal(applied.outcome, 'completed');
        assert.equal(applied.steps[1].parent.ref, 'root');
        assert.equal(f.nodes.has('helloworld/Canvas/AgentRoot/AgentChild'), true);
        assert.equal(get({ ...f.params, workflowId: applied.workflowId }).outcome, 'completed');
        const undone = compensate({ ...f.params, workflowId: applied.workflowId }, f.run);
        assert.equal(undone.outcome, 'compensated');
        assert.equal(f.nodes.has('helloworld/Canvas/AgentRoot'), false);
        assert.deepEqual(f.calls.filter((call) => call.input && call.input.action === 'compensate')
            .map((call) => call.input.nodeName), ['AgentChild', 'AgentRoot']);
        const again = replay({ ...f.params, sourceWorkflowId: applied.workflowId }, f.run);
        assert.equal(again.outcome, 'completed');
        assert.equal(again.replayedFrom, applied.workflowId);
    } finally { f.cleanup(); }
});

test('definite child rejection rolls back created parent', () => {
    const f = fixture('AgentChild');
    try {
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'failed');
        assert.equal(result.error.code, 'STEP_REJECTED');
        assert.equal(f.nodes.has('helloworld/Canvas/AgentRoot'), false);
    } finally { f.cleanup(); }
});

test('nested path length is checked before writes', () => {
    const f = fixture();
    try {
        f.params.steps[0].parent.path = `helloworld/${'a'.repeat(159)}`;
        f.nodes.set(f.params.steps[0].parent.path, f.params.steps[0].parent.uuid);
        f.params.steps[0].name = 'b'.repeat(64);
        f.params.steps[1].name = 'c'.repeat(64);
        const result = plan(f.params, f.run);
        assert.equal(result.error.code, 'NODE_PATH_TOO_LONG');
        assert.equal(f.calls.some((call) => call.input && call.input.action === 'apply'), false);
    } finally { f.cleanup(); }
});
