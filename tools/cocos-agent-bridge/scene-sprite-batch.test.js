'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const operationStore = require('./operation-store');
const { plan, execute, get, compensate, replay, nodeName } = require('./scene-sprite-batch');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXjQAAAABJRU5ErkJggg==', 'base64');
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-scene-sprite-batch-'));
    const projectRoot = path.join(root, 'project');
    const resources = path.join(projectRoot, 'assets', 'resources');
    fs.mkdirSync(resources, { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'assets', 'Scene'), { recursive: true });
    for (const [index, assetName] of ['One.png', 'Two.png'].entries()) {
        const textureUuid = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
        const spriteFrameUuid = `00000000-0000-4000-8000-${String(index + 11).padStart(12, '0')}`;
        fs.writeFileSync(path.join(resources, assetName), png);
        fs.writeFileSync(path.join(resources, `${assetName}.meta`), JSON.stringify({ importer: 'texture', uuid: textureUuid,
            subMetas: { [path.basename(assetName, '.png')]: { importer: 'sprite-frame', uuid: spriteFrameUuid, rawTextureUuid: textureUuid } } }));
    }
    const params = { targets: [{ projectRoot, creatorVersion: '2.4.15' }], projectRoot, creatorVersion: '2.4.15', assets: ['One.png', 'Two.png'],
        positions: [{ x: -64, y: 0 }, { x: 64, y: 0 }] };
    const instance = { instanceId: '11111111-1111-4111-8111-111111111111', projectRoot,
        creatorVersion: '2.4.15', activeScene: 'helloworld' };
    const nodes = new Map();
    const sceneFile = path.join(projectRoot, 'assets', 'Scene', 'helloworld.fire');
    function writeScene() {
        const objects = [
            { __type__: 'cc.Scene', _name: 'helloworld', _children: [{ __id__: 1 }] },
            { __type__: 'cc.Node', _name: 'Canvas', _id: 'a286bbGknJLZpRpxROV6M94', _children: [] },
        ];
        for (const [name, uuid] of nodes) {
            const index = objects.length;
            objects[1]._children.push({ __id__: index });
            objects.push({ __type__: 'cc.Node', _name: name, _id: uuid, _parent: { __id__: 1 }, _children: [] });
        }
        fs.writeFileSync(sceneFile, JSON.stringify(objects));
    }
    writeScene();
    const sceneCalls = [];
    const fPositions = { 'One.png': { x: -64, y: 0 }, 'Two.png': { x: 64, y: 0 } };
    const run = (request) => {
        if (request.command === 'scene.snapshot') return { success: true, outcome: 'completed', instance,
            result: { sceneName: 'helloworld', nodeCount: 2, nodes: [], truncated: false } };
        if (request.command === 'scene.node.inspect') {
            if (request.input.nodePath === 'helloworld/Canvas') return { success: true, outcome: 'completed', instance,
                result: { sceneName: 'helloworld', node: { status: 'found', path: 'helloworld/Canvas', uuid: 'a286bbGknJLZpRpxROV6M94' } } };
            const name = request.input.nodePath.split('/').at(-1);
            return { success: true, outcome: 'completed', instance, result: { sceneName: 'helloworld',
                node: nodes.has(name) ? { status: 'found', path: request.input.nodePath, uuid: nodes.get(name) }
                    : { status: 'not-found', path: request.input.nodePath } } };
        }
        if (request.operationGetId) {
            let operation;
            try { operation = operationStore.read(projectRoot, request.operationGetId); }
            catch (error) { if (error.code === 'ENOENT') return { success: false, error: { code: 'OPERATION_STATUS_UNKNOWN' } }; throw error; }
            return { success: true, outcome: operation.manifest.sceneAction === 'compensate' ? 'completed' : 'needs-preview',
                instance, phases: operation.phases, result: { sceneName: 'helloworld', action: operation.manifest.sceneAction,
                    assetName: operation.manifest.assetName, nodeName: operation.manifest.nodeName, assetUuid: operation.manifest.assetUuid,
                    ...(operation.manifest.position ? { position: operation.manifest.position } : {}) } };
        }
        assert.equal(request.command, 'scene.pngSprite');
        const assetName = request.input.assetName;
        const targetNodeName = nodeName(assetName);
        const spriteFrameUuid = JSON.parse(fs.readFileSync(path.join(resources, `${assetName}.meta`), 'utf8'))
            .subMetas[path.basename(assetName, '.png')].uuid;
        const action = request.input.action;
        sceneCalls.push({ assetName, action, operationId: request.input.operationId });
        if (action === 'apply') assert.deepEqual(request.input.position, fPositions[assetName]);
        if (assetName === 'Two.png' && action === 'apply' && failureMode === 'definite') return { success: false, outcome: 'failed',
            instance, error: { code: 'EDITOR_REJECTED', sideEffect: 'none' } };
        if (assetName === 'Two.png' && action === 'apply' && failureMode === 'uncertain') return { success: false, outcome: 'needs-review',
            instance, error: { code: 'WRITE_UNKNOWN', sideEffect: 'possible' } };
        if (assetName === 'Two.png' && action === 'apply' && failureMode === 'interrupt-before-persist') {
            failureMode = null;
            throw new Error('INJECTED_HOST_INTERRUPTION_BEFORE_OPERATION_RECORD');
        }
        if (assetName === 'Two.png' && action === 'apply' && failureMode === 'interrupt-after-created') {
            failureMode = null;
            operationStore.write(projectRoot, { contractVersion: '0.1',
                operationId: request.input.operationId, sessionId: crypto.randomUUID(), projectRoot, creatorVersion: '2.4.15',
                manifest: { assetName, nodeName: targetNodeName, assetUuid: spriteFrameUuid, sceneAction: 'apply', position: request.input.position },
                sceneName: null, intent: 'created', receipts: [],
                phases: { capability: 'pending', preflight: 'pending', editor: 'pending', disk: 'pending', preview: 'pending', recovery: 'pending' },
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, true);
            throw new Error('INJECTED_HOST_INTERRUPTION_AFTER_OPERATION_CREATED');
        }
        if (action === 'apply') nodes.set(targetNodeName, crypto.randomUUID());
        else nodes.delete(targetNodeName);
        writeScene();
        const operation = { contractVersion: '0.1', operationId: request.input.operationId, projectRoot, creatorVersion: '2.4.15',
            sceneName: 'helloworld', manifest: { sceneAction: action, assetName, nodeName: targetNodeName, assetUuid: spriteFrameUuid,
                ...(action === 'apply' ? { position: request.input.position } : {}) },
            phases: { capability: 'passed', preflight: 'passed', editor: 'passed', disk: 'passed', preview: action === 'apply' ? 'pending' : 'skipped', recovery: 'passed' },
            receipts: [], intent: 'disk-verified', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        operationStore.write(projectRoot, operation, true);
        if (failureMode === 'interrupt-after-persist' && assetName === 'One.png' && action === 'apply') {
            failureMode = null;
            throw new Error('INJECTED_HOST_INTERRUPTION');
        }
        return { success: true, outcome: action === 'compensate' ? 'completed' : 'needs-preview', instance,
            operationId: request.input.operationId, phases: operation.phases,
            result: { sceneName: 'helloworld', action, assetName, nodeName: targetNodeName, assetUuid: spriteFrameUuid,
                ...(action === 'apply' ? { position: request.input.position } : {}) } };
    };
    let failureMode = null;
    const setFailure = (mode) => { failureMode = mode; };
    return { root, params, projectRoot, nodes, sceneCalls, run, setFailure,
        cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('2.4 plans and applies all imported SpriteFrame references, then exposes preview-gated completion', () => {
    const f = fixture();
    try {
        const checked = plan(f.params, f.run);
        assert.equal(checked.outcome, 'ready');
        assert.equal(checked.items.length, 2);
        assert.deepEqual(checked.items.map((item) => item.position), [{ x: -64, y: 0 }, { x: 64, y: 0 }]);
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'needs-preview');
        assert.deepEqual(result.items.map((item) => item.status), ['applied', 'applied']);
        assert.deepEqual(result.items.map((item) => item.position), [{ x: -64, y: 0 }, { x: 64, y: 0 }]);
        assert.equal(f.nodes.size, 2);
        for (const item of result.items) {
            const operation = operationStore.read(f.projectRoot, item.operationId);
            operation.phases.preview = 'passed';
            operationStore.write(f.projectRoot, operation);
        }
        assert.equal(get({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', batchId: result.batchId }).outcome, 'completed');
    } finally { f.cleanup(); }
});

test('definite second scene rejection compensates the first item in reverse order', () => {
    const f = fixture();
    try {
        f.setFailure('definite');
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'failed');
        assert.deepEqual(result.items.map((item) => item.status), ['compensated', 'rejected']);
        assert.equal(f.nodes.size, 0);
    } finally { f.cleanup(); }
});

test('uncertain scene write is compensated only after live and disk readback prove no effect', () => {
    const f = fixture();
    try {
        f.setFailure('uncertain');
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'needs-review');
        assert.deepEqual(result.items.map((item) => item.status), ['applied', 'applying']);
        assert.equal(f.nodes.size, 1);
        const compensated = compensate({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', batchId: result.batchId }, f.run);
        assert.equal(compensated.outcome, 'failed');
        assert.deepEqual(compensated.items.map((item) => item.status), ['compensated', 'rejected']);
        assert.equal(f.nodes.size, 0);
        const record = JSON.parse(fs.readFileSync(path.join(f.projectRoot, '.cocos-agent', 'scene-batches', `${result.batchId}.json`), 'utf8'));
        assert.equal(record.items[1].reconciliations[0].disposition, 'no-effect');
        assert.match(record.items[1].reconciliations[0].diskSha256, /^[a-f0-9]{64}$/);
    } finally { f.cleanup(); }
});

test('compensation resumes an interrupted apply only when live and serialized scene both lack the target', () => {
    const f = fixture();
    const batchId = crypto.randomUUID();
    try {
        f.setFailure('interrupt-before-persist');
        assert.throws(() => execute({ ...f.params, batchId }, f.run), /INJECTED_HOST_INTERRUPTION_BEFORE_OPERATION_RECORD/);
        const batchFile = path.join(f.projectRoot, '.cocos-agent', 'scene-batches', `${batchId}.json`);
        const interrupted = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
        assert.equal(interrupted.state, 'executing');
        assert.deepEqual(interrupted.items.map((item) => item.status), ['applied', 'applying']);
        assert.throws(() => operationStore.read(f.projectRoot, interrupted.items[1].operationId), { code: 'ENOENT' });
        assert.equal(f.nodes.size, 1);

        const reconciled = execute({ ...f.params, batchId }, f.run);
        assert.equal(reconciled.outcome, 'needs-review');
        assert.deepEqual(reconciled.items.map((item) => item.status), ['applied', 'rejected']);
        assert.equal(f.sceneCalls.filter((call) => call.assetName === 'Two.png' && call.action === 'apply').length, 1);

        const compensated = compensate({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', batchId }, f.run);
        assert.equal(compensated.outcome, 'failed');
        assert.deepEqual(compensated.items.map((item) => item.status), ['compensated', 'rejected']);
        assert.equal(f.nodes.size, 0);
        assert.deepEqual(f.sceneCalls.map((call) => [call.assetName, call.action]), [
            ['One.png', 'apply'], ['Two.png', 'apply'], ['One.png', 'compensate'],
        ]);
        const recovered = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
        assert.equal(recovered.items[1].reconciliations[0].disposition, 'no-effect');
        assert.equal(recovered.items[1].reconciliations[0].action, 'apply');
        assert.equal(recovered.error.code, 'WRITE_RECONCILED_NO_EFFECT');
    } finally { f.cleanup(); }
});

test('compensation reconciles a persisted pre-write operation only after live and serialized scene confirm no effect', () => {
    const f = fixture();
    const batchId = crypto.randomUUID();
    try {
        f.setFailure('interrupt-after-created');
        assert.throws(() => execute({ ...f.params, batchId }, f.run), /INJECTED_HOST_INTERRUPTION_AFTER_OPERATION_CREATED/);
        const batchFile = path.join(f.projectRoot, '.cocos-agent', 'scene-batches', `${batchId}.json`);
        const interrupted = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
        assert.equal(interrupted.state, 'executing');
        assert.deepEqual(interrupted.items.map((item) => item.status), ['applied', 'applying']);
        const pendingOperation = operationStore.read(f.projectRoot, interrupted.items[1].operationId);
        assert.equal(pendingOperation.intent, 'created');
        assert.equal(pendingOperation.sceneName, null);
        assert.deepEqual(pendingOperation.receipts, []);
        assert.equal(f.nodes.size, 1);

        const compensated = compensate({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', batchId }, f.run);
        assert.equal(compensated.outcome, 'failed');
        assert.deepEqual(compensated.items.map((item) => item.status), ['compensated', 'rejected']);
        assert.equal(f.nodes.size, 0);
        assert.deepEqual(f.sceneCalls.map((call) => [call.assetName, call.action]), [
            ['One.png', 'apply'], ['Two.png', 'apply'], ['One.png', 'compensate'],
        ]);
        const recovered = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
        assert.equal(recovered.items[1].reconciliations[0].disposition, 'no-effect');
        assert.equal(recovered.items[1].reconciliations[0].action, 'apply');
        assert.match(recovered.items[1].reconciliations[0].diskSha256, /^[a-f0-9]{64}$/);
        assert.equal(recovered.error.code, 'WRITE_RECONCILED_NO_EFFECT');
    } finally { f.cleanup(); }
});

test('same batch resumes after host interruption between persisted operation and reply', () => {
    const f = fixture();
    const batchId = crypto.randomUUID();
    try {
        f.setFailure('interrupt-after-persist');
        assert.throws(() => execute({ ...f.params, batchId }, f.run), /INJECTED_HOST_INTERRUPTION/);

        const batchFile = path.join(f.projectRoot, '.cocos-agent', 'scene-batches', `${batchId}.json`);
        const interrupted = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
        assert.equal(interrupted.state, 'executing');
        assert.deepEqual(interrupted.items.map((item) => item.status), ['applying', 'pending']);
        assert.equal(operationStore.read(f.projectRoot, interrupted.items[0].operationId).phases.disk, 'passed');
        assert.equal(f.nodes.size, 1);

        const resumed = execute({ ...f.params, batchId }, f.run);
        assert.equal(resumed.outcome, 'needs-preview');
        assert.deepEqual(resumed.items.map((item) => item.status), ['applied', 'applied']);
        assert.equal(resumed.items[0].operationId, interrupted.items[0].operationId);
        assert.equal(f.sceneCalls.filter((call) => call.assetName === 'One.png' && call.action === 'apply').length, 1);
        assert.equal(f.sceneCalls.filter((call) => call.assetName === 'Two.png' && call.action === 'apply').length, 1);
        assert.equal(f.nodes.size, 2);
    } finally { f.cleanup(); }
});

test('compensated 2.4 batch can be replayed with fresh operation IDs', () => {
    const f = fixture();
    try {
        const first = execute(f.params, f.run);
        const undone = compensate({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', batchId: first.batchId }, f.run);
        assert.equal(undone.outcome, 'compensated');
        assert.equal(f.nodes.size, 0);
        assert.ok(undone.items.every((item) => item.compensationPhases?.disk === 'passed' && item.compensationPhases?.recovery === 'passed'));
        const replayed = replay({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', sourceBatchId: first.batchId }, f.run);
        assert.equal(replayed.outcome, 'needs-preview');
        assert.equal(replayed.replayedFrom, first.batchId);
        assert.notEqual(replayed.batchId, first.batchId);
        assert.equal(f.nodes.size, 2);
        assert.deepEqual(replayed.items.map((item) => item.position), [{ x: -64, y: 0 }, { x: 64, y: 0 }]);
    } finally { f.cleanup(); }
});

test('rejects incomplete, non-finite, and out-of-range Canvas positions before editor access', () => {
    const f = fixture();
    try {
        assert.equal(plan({ ...f.params, positions: [{ x: 0, y: 0 }] }, f.run).error.code, 'INVALID_POSITIONS');
        assert.equal(plan({ ...f.params, positions: [{ x: 0, y: 0 }, { x: NaN, y: 1 }] }, f.run).error.code, 'INVALID_POSITIONS');
        assert.equal(plan({ ...f.params, positions: [{ x: 0, y: 0 }, { x: 5000, y: 0 }] }, f.run).error.code, 'INVALID_POSITIONS');
    } finally { f.cleanup(); }
});

test('similar asset prefixes that conflict under the scene command name rule are rejected', () => {
    assert.equal(nodeName('cocos-agent-batch-red.png'), nodeName('cocos-agent-batch-blue.png'));
    assert.match(nodeName('cocos-agent-batch-red.png'), /^CocosAgentAsset_[A-Za-z0-9_-]{1,64}$/);
    const f = fixture();
    try {
        for (const [index, assetName] of ['cocos-agent-batch-red.png', 'cocos-agent-batch-blue.png'].entries()) {
            const textureUuid = `00000000-0000-4000-8000-${String(index + 21).padStart(12, '0')}`;
            const spriteFrameUuid = `00000000-0000-4000-8000-${String(index + 31).padStart(12, '0')}`;
            fs.writeFileSync(path.join(f.projectRoot, 'assets', 'resources', assetName), png);
            fs.writeFileSync(path.join(f.projectRoot, 'assets', 'resources', `${assetName}.meta`), JSON.stringify({ importer: 'texture', uuid: textureUuid,
                subMetas: { [path.basename(assetName, '.png')]: { importer: 'sprite-frame', uuid: spriteFrameUuid, rawTextureUuid: textureUuid } } }));
        }
        f.params.assets = ['cocos-agent-batch-red.png', 'cocos-agent-batch-blue.png'];
        assert.equal(plan(f.params, f.run).error.code, 'NODE_NAME_COLLISION');
    } finally { f.cleanup(); }
});
