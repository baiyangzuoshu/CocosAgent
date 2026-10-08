'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const store = require('./operation-store');
const { reconcileNoEffect } = require('./operation-reconcile');
const { dispatch } = require('./agent-dispatch');

const operationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const parentUuid = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const parentPath = 'helloworld/Canvas';

function fixture(withTarget = false) {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-reconcile-'));
    fs.mkdirSync(path.join(projectRoot, 'assets', 'Scene'), { recursive: true });
    const objects = [
        { __type__: 'cc.SceneAsset' },
        { __type__: 'cc.Scene', _id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', _children: [{ __id__: 2 }] },
        { __type__: 'cc.Node', _id: parentUuid, _name: 'Canvas', _children: [], _parent: { __id__: 1 } },
    ];
    if (withTarget) objects.push({ __type__: 'cc.Node', _id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        _name: 'P1MultiRuntimeProbe', _parent: { __id__: 2 }, _children: [] });
    fs.writeFileSync(path.join(projectRoot, 'assets', 'Scene', 'helloworld.fire'), `${JSON.stringify(objects)}\n`);
    const record = { contractVersion: '0.1', capabilityId: 'scene.node.create', operationId, projectRoot,
        creatorVersion: '2.4.15', manifest: { parentPath, parentUuid, nodeName: 'P1MultiRuntimeProbe', action: 'apply',
            sourceOperationId: null, targetNodeUuid: null, components: [], transform: {} }, sceneName: 'helloworld',
        createdNodeUuid: null, intent: 'editor-write-sent', receipts: [
            { phase: 'editor', status: 'failed', error: { sideEffect: 'possible' } },
        ], phases: { capability: 'passed', preflight: 'passed', editor: 'failed', disk: 'pending', preview: 'pending', recovery: 'pending' },
        createdAt: '2026-10-08T10:00:00.000Z', updatedAt: '2026-10-08T10:00:01.000Z' };
    store.write(projectRoot, record, true);
    const liveObservation = { observedAt: '2026-10-08T10:01:00.000Z', sceneName: 'helloworld',
        parent: { status: 'found', path: parentPath, uuid: parentUuid },
        target: { status: 'not-found', path: `${parentPath}/P1MultiRuntimeProbe` } };
    return { projectRoot, record, liveObservation, cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }) };
}

test('records no-effect only after same-scene parent identity and disk absence agree', () => {
    const f = fixture();
    try {
        const result = reconcileNoEffect({ ...f, creatorVersion: '2.4.15', operationId });
        assert.equal(result.success, true);
        assert.equal(result.data.reconciliation.disposition, 'no-effect');
        assert.equal(result.data.phases.editor, 'failed');
        assert.equal(result.data.phases.disk, 'pending');
        assert.equal(result.data.phases.recovery, 'passed');
        assert.equal(result.data.receipts.at(-1).phase, 'recovery');
        assert.equal(result.data.receipts.at(-1).evidence[0].kind, 'recovery-readback');
        const again = reconcileNoEffect({ ...f, creatorVersion: '2.4.15', operationId });
        assert.equal(again.alreadyReconciled, true);
    } finally { f.cleanup(); }
});

test('rejects mismatched live scene, parent UUID, and disk node presence without changing history', () => {
    for (const mutation of [
        (live) => { live.sceneName = 'other-scene'; },
        (live) => { live.parent.uuid = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'; },
    ]) {
        const f = fixture();
        try {
            mutation(f.liveObservation);
            const result = reconcileNoEffect({ ...f, creatorVersion: '2.4.15', operationId });
            assert.equal(result.error.code, 'LIVE_STATE_NOT_CONFIRMED');
            assert.equal(store.read(f.projectRoot, operationId).phases.recovery, 'pending');
        } finally { f.cleanup(); }
    }
    const f = fixture(true);
    try {
        const result = reconcileNoEffect({ ...f, creatorVersion: '2.4.15', operationId });
        assert.equal(result.error.code, 'DISK_STATE_NOT_CONFIRMED');
        assert.equal(store.read(f.projectRoot, operationId).phases.recovery, 'pending');
    } finally { f.cleanup(); }
});

test('dispatcher selects the recorded scene and reports a reconciled failure as no-effect', () => {
    const f = fixture();
    try {
        const instance = { instanceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', projectRoot: f.projectRoot,
            creatorVersion: '2.4.15', state: 'ready', activeScene: 'helloworld', catalogRevision: 'a'.repeat(64) };
        const calls = [];
        const invoke = (script, args) => {
            calls.push({ script, args });
            if (script === 'catalog-host.js' && args.includes('instances.list'))
                return { status: 0, stdout: JSON.stringify({ success: true, data: [instance] }) };
            if (script === 'catalog-host.js') return { status: 0, stdout: JSON.stringify({ success: true, data: {
                instance, commands: [{ id: 'scene.snapshot', status: 'available' }],
            } }) };
            if (args.includes('--operation-reconcile')) {
                const result = reconcileNoEffect({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', operationId,
                    liveObservation: f.liveObservation });
                return { status: result.success ? 0 : 1, stdout: `reconcile.result ${JSON.stringify({ operationId, disposition: 'no-effect' })}\n`, stderr: '' };
            }
            if (args.includes('--operation-get')) return { status: 0,
                stdout: JSON.stringify({ success: true, data: store.read(f.projectRoot, operationId) }) };
            throw new Error(`unexpected ${script}`);
        };
        const result = dispatch({ targets: [{ projectRoot: f.projectRoot, creatorVersion: '2.4.15' }],
            projectRoot: f.projectRoot, creatorVersion: '2.4.15', operationReconcileId: operationId }, invoke);
        assert.equal(result.outcome, 'failed');
        assert.equal(result.error.code, 'WRITE_RECONCILED_NO_EFFECT');
        assert.equal(result.error.sideEffect, 'none');
        assert.equal(result.phases.editor, 'failed');
        assert.equal(result.phases.disk, 'pending');
        assert.equal(result.phases.recovery, 'passed');
        assert(calls[2].args.includes('--expected-instance-id'));
        assert(calls[2].args.includes(instance.instanceId));
        assert(calls[2].args.includes('--expected-scene'));
        const callsAfterFirstReconcile = calls.length;
        const repeated = dispatch({ targets: [{ projectRoot: f.projectRoot, creatorVersion: '2.4.15' }],
            projectRoot: f.projectRoot, creatorVersion: '2.4.15', operationReconcileId: operationId }, invoke);
        assert.equal(repeated.error.code, 'WRITE_RECONCILED_NO_EFFECT');
        assert.equal(calls.slice(callsAfterFirstReconcile).length, 1, 'repeat only reads the persisted operation record');
        assert(calls.at(-1).args.includes('--operation-get'));
    } finally { f.cleanup(); }
});
