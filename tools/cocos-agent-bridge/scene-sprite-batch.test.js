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
    const fPositions = { 'One.png': { x: -64, y: 0 }, 'Two.png': { x: 64, y: 0 } };
    const run = (request) => {
        if (request.command === 'scene.snapshot') return { success: true, outcome: 'completed', instance,
            result: { sceneName: 'helloworld', nodeCount: 2, nodes: [], truncated: false } };
        if (request.command === 'scene.node.inspect') {
            if (request.input.nodePath === 'helloworld/Canvas') return { success: true, outcome: 'completed', instance,
                result: { sceneName: 'helloworld', node: { status: 'found', uuid: 'a286bbGknJLZpRpxROV6M94' } } };
            const name = request.input.nodePath.split('/').at(-1);
            return { success: true, outcome: 'completed', instance, result: { sceneName: 'helloworld',
                node: nodes.has(name) ? { status: 'found', uuid: nodes.get(name) } : { status: 'not-found' } } };
        }
        if (request.operationGetId) {
            const operation = operationStore.read(projectRoot, request.operationGetId);
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
        if (action === 'apply') assert.deepEqual(request.input.position, fPositions[assetName]);
        if (assetName === 'Two.png' && action === 'apply' && failureMode === 'definite') return { success: false, outcome: 'failed',
            instance, error: { code: 'EDITOR_REJECTED', sideEffect: 'none' } };
        if (assetName === 'Two.png' && action === 'apply' && failureMode === 'uncertain') return { success: false, outcome: 'needs-review',
            instance, error: { code: 'WRITE_UNKNOWN', sideEffect: 'possible' } };
        if (action === 'apply') nodes.set(targetNodeName, crypto.randomUUID());
        else nodes.delete(targetNodeName);
        const operation = { contractVersion: '0.1', operationId: request.input.operationId, projectRoot, creatorVersion: '2.4.15',
            sceneName: 'helloworld', manifest: { sceneAction: action, assetName, nodeName: targetNodeName, assetUuid: spriteFrameUuid,
                ...(action === 'apply' ? { position: request.input.position } : {}) },
            phases: { capability: 'passed', preflight: 'passed', editor: 'passed', disk: 'passed', preview: action === 'apply' ? 'pending' : 'skipped', recovery: 'passed' },
            receipts: [], intent: 'disk-verified', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        operationStore.write(projectRoot, operation, true);
        return { success: true, outcome: action === 'compensate' ? 'completed' : 'needs-preview', instance,
            operationId: request.input.operationId, phases: operation.phases,
            result: { sceneName: 'helloworld', action, assetName, nodeName: targetNodeName, assetUuid: spriteFrameUuid,
                ...(action === 'apply' ? { position: request.input.position } : {}) } };
    };
    let failureMode = null;
    const setFailure = (mode) => { failureMode = mode; };
    return { root, params, projectRoot, nodes, run, setFailure,
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

test('uncertain scene write stops without automatic compensation', () => {
    const f = fixture();
    try {
        f.setFailure('uncertain');
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'needs-review');
        assert.deepEqual(result.items.map((item) => item.status), ['applied', 'applying']);
        assert.equal(f.nodes.size, 1);
        assert.equal(compensate({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', batchId: result.batchId }, f.run).error.code,
            'BATCH_NOT_COMPENSABLE');
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
