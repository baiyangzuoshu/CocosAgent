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
        else nodes.set(nodePath, input.nodeName === 'AgentRoot' || input.nodeName === 'AgentCharacter'
            ? 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            : input.nodeName === 'Sprite' ? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' : 'ffffffff-ffff-4fff-8fff-ffffffffffff');
        const result = { success: true, outcome: 'completed', instance, phases: { disk: 'passed',
            ...(Array.isArray(input.components) && input.components.length ? { preview: 'passed' } : {}) },
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

test('2.4 composition preserves Sprite and Label child specifications through compensation and replay', () => {
    const f = fixture();
    try {
        const sprite = { classId: 'cc.Sprite', spriteFrameUuid: '12121212-1212-4212-8212-121212121212' };
        const label = { classId: 'cc.Label', text: 'Hero' };
        f.params.steps = [
            { id: 'root', name: 'AgentCharacter', parent: { path: 'helloworld/Canvas', uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
            { id: 'sprite', name: 'Sprite', parent: { ref: 'root' }, components: [sprite], transform: { position: { x: 0, y: 0 }, scale: { x: 2, y: 2 } } },
            { id: 'label', name: 'Label', parent: { ref: 'root' }, components: [label], transform: { position: { x: 0, y: -40 } } },
        ];
        const applied = execute(f.params, f.run);
        assert.equal(applied.outcome, 'completed');
        assert.deepEqual(applied.steps[1].components, [sprite]);
        assert.deepEqual(applied.steps[2].components, [label]);
        assert.equal(f.nodes.has('helloworld/Canvas/AgentCharacter/Sprite'), true);
        assert.equal(f.nodes.has('helloworld/Canvas/AgentCharacter/Label'), true);
        const writes = f.calls.filter((call) => call.input && call.input.action === 'apply');
        assert.deepEqual(writes[1].input.components, [sprite]);
        assert.deepEqual(writes[1].input.transform.scale, { x: 2, y: 2 });
        assert.deepEqual(writes[2].input.components, [label]);
        const undone = compensate({ ...f.params, workflowId: applied.workflowId }, f.run);
        assert.equal(undone.outcome, 'compensated');
        const replayed = replay({ ...f.params, sourceWorkflowId: applied.workflowId }, f.run);
        assert.equal(replayed.outcome, 'completed');
        assert.deepEqual(replayed.steps[1].components, [sprite]);
        assert.deepEqual(replayed.steps[2].components, [label]);
    } finally { f.cleanup(); }
});

test('3.8 composition rejects component and transform steps before editor access', () => {
    const f = fixture();
    try {
        f.params.creatorVersion = '3.8.7';
        f.params.steps[1].components = [{ classId: 'cc.Label', text: 'Unsupported' }];
        assert.equal(plan(f.params, f.run).error.code, 'INVALID_PLAN');
        assert.equal(f.calls.length, 0);
    } finally { f.cleanup(); }
});

test('component composition does not complete a step before its runtime preview passes', () => {
    const f = fixture();
    try {
        f.params.steps[0].name = 'AgentCharacter';
        f.params.steps[1].components = [{ classId: 'cc.Label', text: 'Pending preview' }];
        f.params.steps.push({ id: 'later', name: 'Later', parent: { ref: 'root' } });
        const baseRun = f.run;
        const run = (request) => {
            const result = baseRun(request);
            if (request.command === 'scene.node.create' && request.input.nodeName === 'AgentChild') {
                result.outcome = 'needs-preview'; result.phases.preview = 'pending';
            }
            return result;
        };
        const result = execute(f.params, run);
        assert.equal(result.outcome, 'needs-review');
        assert.equal(result.steps[0].status, 'applied');
        assert.equal(result.steps[1].status, 'applying');
        assert.equal(result.steps[2].status, 'pending');
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
