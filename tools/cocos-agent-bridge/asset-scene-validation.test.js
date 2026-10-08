'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validate, repair, readSceneReference } = require('./asset-scene-validation');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXjQAAAABJRU5ErkJggg==', 'base64');
const projectId = '11111111-1111-4111-8111-111111111111';
const pipelineId = '22222222-2222-4222-8222-222222222222';
const sceneBatchId = '33333333-3333-4333-8333-333333333333';
const textureUuid = '44444444-4444-4444-8444-444444444444';
const spriteFrameUuid = '55555555-5555-4555-8555-555555555555';
const assetName = 'Probe.png';
const nodeName = 'CocosAgentAsset_Probe';

function fixture(options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-asset-scene-validation-'));
    const projectRoot = path.join(root, 'project');
    const assetPath = path.join(projectRoot, 'assets', 'resources', assetName);
    const scenePath = path.join(projectRoot, 'assets', 'Scene', 'helloworld.fire');
    const recordPath = path.join(projectRoot, '.cocos-agent', 'asset-scene-pipelines', `${pipelineId}.json`);
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.mkdirSync(path.dirname(scenePath), { recursive: true });
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(assetPath, png);
    const sha256 = crypto.createHash('sha256').update(png).digest('hex');
    fs.writeFileSync(`${assetPath}.meta`, JSON.stringify({ importer: 'texture', uuid: textureUuid,
        subMetas: { Probe: { importer: 'sprite-frame', uuid: spriteFrameUuid, rawTextureUuid: textureUuid } } }));
    const sceneObjects = [
        { __type__: 'cc.Scene', _children: [{ __id__: 1 }] },
        { __type__: 'cc.Node', _name: 'Canvas', _parent: { __id__: 0 }, _children: [{ __id__: 2 }], _components: [] },
        { __type__: 'cc.Node', _name: nodeName, _parent: { __id__: 1 }, _children: [], _components: [{ __id__: 3 }] },
        { __type__: 'cc.Sprite', node: { __id__: 2 }, _spriteFrame: { __uuid__: spriteFrameUuid } },
    ];
    fs.writeFileSync(scenePath, JSON.stringify(sceneObjects));
    const record = { pipelineId, projectRoot, creatorVersion: '2.4.15', state: 'completed', instanceId: projectId,
        sceneName: 'helloworld', sceneBatchId, repairAttempts: [], items: [{ assetName, nodeName, sha256, width: 1, height: 1,
            textureUuid, spriteFrameUuid, importStatus: 'imported', removalStatus: null }] };
    fs.writeFileSync(recordPath, JSON.stringify(record));
    const batchPath = path.join(projectRoot, '.cocos-agent', 'scene-batches', `${sceneBatchId}.json`);
    fs.mkdirSync(path.dirname(batchPath), { recursive: true });
    fs.writeFileSync(batchPath, JSON.stringify({ batchId: sceneBatchId, projectRoot, creatorVersion: '2.4.15', state: 'completed',
        items: [{ assetName, status: 'applied', assetUuid: spriteFrameUuid }] }));
    const instance = { instanceId: projectId, projectRoot, creatorVersion: '2.4.15', activeScene: 'helloworld' };
    let assetDbStale = options.assetDbStale === true;
    let refreshCount = 0;
    const calls = [];
    const run = (request) => {
        calls.push(request.command);
        if (request.command === 'scene.snapshot') return { success: true, outcome: 'completed', instance,
            result: { sceneName: 'helloworld' } };
        if (request.command === 'scene.node.inspect') {
            const canvas = request.input.nodePath === 'helloworld/Canvas';
            return { success: true, outcome: 'completed', instance, result: { sceneName: 'helloworld', node: { status: 'found',
                uuid: canvas ? 'canvas-node-identity-0001' : 'probe-node-identity-001', componentDetails: canvas ? [] : [
                    { classId: 'cc.Sprite', spriteFrameUuid: options.runtimeSpriteFrameUuid || spriteFrameUuid } ] } } };
        }
        if (request.command === 'asset.validatePng') {
            const stale = assetDbStale;
            return { success: true, outcome: 'completed', result: { status: stale ? 'repairable' : 'valid',
                issues: stale ? ['ASSETDB_MAPPING_STALE'] : [], checks: { assetDbUrlUuidMatches: !stale } } };
        }
        if (request.command === 'asset.refreshPng') {
            refreshCount++;
            if (options.refreshThrowsAfterEffect) { assetDbStale = false; throw new Error('simulated host interruption after refresh'); }
            if (options.refreshFails) return { success: false, outcome: 'failed', error: { code: 'ASSETDB_REFRESH_FAILED' } };
            assetDbStale = false;
            if (options.refreshChangesIdentity) {
                const metaFile = `${assetPath}.meta`;
                const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
                meta.subMetas.Probe.uuid = '66666666-6666-4666-8666-666666666666';
                fs.writeFileSync(metaFile, JSON.stringify(meta));
            }
            return { success: true, outcome: 'completed', result: { status: 'valid', refreshed: true } };
        }
        throw new Error(`Unexpected validation command: ${request.command}`);
    };
    const params = { targets: [{ projectRoot, creatorVersion: '2.4.15' }], projectRoot, creatorVersion: '2.4.15', pipelineId };
    return { root, projectRoot, assetPath, scenePath, recordPath, params, run, calls,
        refreshCount: () => refreshCount, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('validates disk metadata, AssetDB, serialized and live scene references read-only', () => {
    const f = fixture();
    try {
        const result = validate(f.params, f.run);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.outcome, 'valid');
        assert.equal(result.items[0].status, 'valid');
        assert.deepEqual(f.calls, ['scene.snapshot', 'asset.validatePng', 'scene.node.inspect']);
        assert.equal(f.refreshCount(), 0);
        assert.equal(readSceneReference(f.projectRoot, 'helloworld', nodeName, spriteFrameUuid).success, true);
    } finally { f.cleanup(); }
});

test('repairs only stale AssetDB mapping and persists identity-stable readback', () => {
    const f = fixture({ assetDbStale: true });
    try {
        const result = repair({ ...f.params, assetName, repairId: '77777777-7777-4777-8777-777777777777' }, f.run);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.outcome, 'repaired');
        assert.equal(result.validation.outcome, 'valid');
        assert.equal(f.refreshCount(), 1);
        const persisted = JSON.parse(fs.readFileSync(f.recordPath, 'utf8'));
        assert.equal(persisted.repairAttempts[0].status, 'completed');
        assert.equal(persisted.repairAttempts[0].editorResult.refreshed, true);
    } finally { f.cleanup(); }
});

test('refuses metadata or runtime scene identity drift without refreshing', () => {
    const f = fixture({ assetDbStale: true });
    try {
        const metaFile = `${f.assetPath}.meta`;
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        meta.uuid = '88888888-8888-4888-8888-888888888888';
        fs.writeFileSync(metaFile, JSON.stringify(meta));
        const result = repair({ ...f.params, assetName }, f.run);
        assert.equal(result.outcome, 'needs-review');
        assert.equal(result.validation.items[0].status, 'needs-review');
        assert.equal(f.refreshCount(), 0);
    } finally { f.cleanup(); }

    const runtime = fixture({ runtimeSpriteFrameUuid: '99999999-9999-4999-8999-999999999999' });
    try {
        const result = repair({ ...runtime.params, assetName }, runtime.run);
        assert.equal(result.outcome, 'needs-review');
        assert.ok(result.validation.items[0].issues.includes('SCENE_RUNTIME_REFERENCE_MISMATCH'));
        assert.equal(runtime.refreshCount(), 0);
    } finally { runtime.cleanup(); }
});

test('marks post-refresh identity changes and refresh errors for review', () => {
    for (const options of [{ assetDbStale: true, refreshFails: true }, { assetDbStale: true, refreshChangesIdentity: true }]) {
        const f = fixture(options);
        try {
            const result = repair({ ...f.params, assetName }, f.run);
            assert.equal(result.outcome, 'needs-review');
            assert.equal(f.refreshCount(), 1);
            const persisted = JSON.parse(fs.readFileSync(f.recordPath, 'utf8'));
            assert.equal(persisted.repairAttempts[0].status, 'needs-review');
        } finally { f.cleanup(); }
    }
});

test('reconciles an interrupted refresh by readback without repeating the side effect', () => {
    const f = fixture({ assetDbStale: true, refreshThrowsAfterEffect: true });
    const repairId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    try {
        assert.throws(() => repair({ ...f.params, assetName, repairId }, f.run), /simulated host interruption/);
        const result = repair({ ...f.params, assetName, repairId }, f.run);
        assert.equal(result.success, true, JSON.stringify(result));
        assert.equal(result.outcome, 'already-valid');
        assert.equal(f.refreshCount(), 1);
        const persisted = JSON.parse(fs.readFileSync(f.recordPath, 'utf8'));
        assert.equal(persisted.repairAttempts[0].status, 'reconciled');
    } finally { f.cleanup(); }
});

test('validates a PNG scene node as a direct Canvas child in serialized data', () => {
    const f = fixture();
    try {
        const objects = JSON.parse(fs.readFileSync(f.scenePath, 'utf8'));
        objects[2]._parent = { __id__: 0 };
        objects[1]._children = [];
        fs.writeFileSync(f.scenePath, JSON.stringify(objects));
        assert.deepEqual(readSceneReference(f.projectRoot, 'helloworld', nodeName, spriteFrameUuid),
            { success: false, code: 'SCENE_SPRITEFRAME_MISMATCH' });
    } finally { f.cleanup(); }
});

process.stdout.write('asset scene validation and safe repair tests passed\n');
