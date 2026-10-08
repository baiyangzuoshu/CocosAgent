'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const operationStore = require('./operation-store');
const { plan, execute, get, acceptPreview, compensate } = require('./asset-scene-pipeline');
const sceneBatch = require('./scene-sprite-batch');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXjQAAAABJRU5ErkJggg==', 'base64');
function fixture(options = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-asset-scene-pipeline-'));
    const projectRoot = path.join(root, 'project');
    fs.mkdirSync(path.join(projectRoot, 'assets', 'resources'), { recursive: true });
    const sources = ['Red.png', 'Blue.png'].map((name) => {
        const filename = path.join(root, name);
        fs.writeFileSync(filename, png);
        return filename;
    });
    const params = { projectRoot, creatorVersion: '2.4.15', targets: [{ projectRoot, creatorVersion: '2.4.15' }], sources,
        positions: [{ x: -64, y: 0 }, { x: 64, y: 0 }] };
    const instance = { instanceId: '11111111-1111-4111-8111-111111111111', projectRoot, creatorVersion: '2.4.15', activeScene: 'helloworld' };
    const nodes = new Map();
    const calls = [];
    const identity = new Map();
    const run = (request) => {
        calls.push(request);
        if (request.command === 'scene.snapshot') return { success: true, outcome: 'completed', instance,
            result: { sceneName: 'helloworld', nodeCount: nodes.size, nodes: [], truncated: false } };
        if (request.command === 'scene.node.inspect') {
            if (request.input.nodePath === 'helloworld/Canvas') return { success: true, outcome: 'completed', instance,
                result: { sceneName: 'helloworld', node: { status: 'found', uuid: 'a286bbGknJLZpRpxROV6M94' } } };
            const nodeName = request.input.nodePath.split('/').at(-1);
            return { success: true, outcome: 'completed', instance, result: { sceneName: 'helloworld',
                node: nodes.has(nodeName) ? { status: 'found', uuid: nodes.get(nodeName) } : { status: 'not-found' } } };
        }
        if (request.command === 'asset.importPng') {
            const assetName = path.basename(request.input.sourcePath);
            if (assetName === 'Blue.png' && options.failImport === true) return { success: false, outcome: 'failed',
                error: { code: 'ASSET_CONFLICT', sideEffect: 'none' } };
            const destination = path.join(projectRoot, 'assets', 'resources', assetName);
            fs.copyFileSync(request.input.sourcePath, destination);
            const textureUuid = crypto.randomUUID();
            const spriteFrameUuid = crypto.randomUUID();
            const meta = { importer: 'texture', uuid: textureUuid, width: 1, height: 1,
                subMetas: { [path.basename(assetName, '.png')]: { importer: 'sprite-frame', uuid: spriteFrameUuid, rawTextureUuid: textureUuid } } };
            fs.writeFileSync(`${destination}.meta`, JSON.stringify(meta));
            identity.set(assetName, { textureUuid, spriteFrameUuid });
            return { success: true, outcome: 'completed', result: { assetName, uuid: textureUuid, type: 'texture', imported: true,
                sha256: crypto.createHash('sha256').update(fs.readFileSync(request.input.sourcePath)).digest('hex'), width: 1, height: 1 } };
        }
        if (request.command === 'asset.removeImportedPng') {
            const { assetName, textureUuid, spriteFrameUuid } = request.input;
            const actual = identity.get(assetName);
            if (!actual || actual.textureUuid !== textureUuid || actual.spriteFrameUuid !== spriteFrameUuid)
                return { success: false, outcome: 'failed', error: { code: 'ASSET_IDENTITY_CHANGED', sideEffect: 'none' } };
            const filename = path.join(projectRoot, 'assets', 'resources', assetName);
            fs.rmSync(filename, { force: true }); fs.rmSync(`${filename}.meta`, { force: true });
            if (options.deleteButReportFailure === true && assetName === 'Blue.png') return { success: false, outcome: 'failed',
                error: { code: 'ASSETDB_DELETE_UNVERIFIED', sideEffect: 'possible' } };
            return { success: true, outcome: 'completed', result: { ...request.input, removed: true } };
        }
        if (request.previewAcceptId) {
            const operation = operationStore.read(projectRoot, request.previewAcceptId);
            operation.phases.preview = 'passed';
            operation.receipts.push({ phase: 'preview', status: 'passed', evidence: [{ kind: 'visual-preview' }] });
            operationStore.write(projectRoot, operation);
            return { success: true, outcome: 'completed', operationId: request.previewAcceptId };
        }
        if (request.operationGetId) {
            const operation = operationStore.read(projectRoot, request.operationGetId);
            return { success: true, outcome: operation.manifest.sceneAction === 'compensate' ? 'completed' : 'needs-preview',
                instance, phases: operation.phases, result: { sceneName: 'helloworld', action: operation.manifest.sceneAction,
                    assetName: operation.manifest.assetName, nodeName: operation.manifest.nodeName, assetUuid: operation.manifest.assetUuid,
                    ...(operation.manifest.position ? { position: operation.manifest.position } : {}) } };
        }
        assert.equal(request.command, 'scene.pngSprite');
        const { assetName, action, operationId } = request.input;
        const nodeName = sceneBatch.nodeName(assetName);
        const spriteFrameUuid = identity.get(assetName).spriteFrameUuid;
        if (action === 'apply' && assetName === 'Blue.png' && options.failScene === true)
            return { success: false, outcome: 'failed', instance, error: { code: 'EDITOR_REJECTED', sideEffect: 'none' } };
        if (action === 'apply') nodes.set(nodeName, crypto.randomUUID()); else nodes.delete(nodeName);
        const operation = { contractVersion: '0.1', capabilityId: 'scene.pngSprite', operationId, sessionId: crypto.randomUUID(),
            projectRoot, creatorVersion: '2.4.15', sceneName: 'helloworld', intent: 'disk-verified',
            manifest: { sceneAction: action, assetName, nodeName, assetUuid: spriteFrameUuid,
                ...(action === 'apply' ? { position: request.input.position } : {}) }, receipts: [],
            phases: { capability: 'passed', preflight: 'passed', editor: 'passed', disk: 'passed',
                preview: action === 'apply' ? 'pending' : 'skipped', recovery: 'passed' },
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        operationStore.write(projectRoot, operation, true);
        return { success: true, outcome: action === 'compensate' ? 'completed' : 'needs-preview', instance, operationId,
            phases: operation.phases, result: { sceneName: 'helloworld', action, assetName, nodeName, assetUuid: spriteFrameUuid,
                ...(action === 'apply' ? { position: request.input.position } : {}) } };
    };
    return { root, projectRoot, params, nodes, calls, run, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('plans, imports, validates Creator metadata and UUIDs, places resources, and waits for preview receipts', () => {
    const f = fixture();
    try {
        const checked = plan(f.params, f.run);
        assert.equal(checked.outcome, 'ready');
        assert.deepEqual(checked.items.map((item) => item.position), [{ x: -64, y: 0 }, { x: 64, y: 0 }]);
        const result = execute({ ...f.params, pipelineId: checked.pipelineId }, f.run);
        assert.equal(result.outcome, 'needs-preview', JSON.stringify(result));
        assert.ok(result.items.every((item) => item.textureUuid && item.spriteFrameUuid && item.importStatus === 'imported'));
        assert.equal(f.nodes.size, 2);
        for (const [index, item] of result.items.entries()) {
            const accepted = acceptPreview({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', pipelineId: result.pipelineId,
                operationId: item.operationId, evidence: { url: 'http://127.0.0.1:7456/', observedAt: new Date().toISOString(), note: `${item.assetName} visible` } }, f.run);
            assert.equal(accepted.outcome, index === result.items.length - 1 ? 'completed' : 'needs-preview');
        }
        assert.equal(get({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', pipelineId: result.pipelineId }).outcome, 'completed');
        const undone = compensate({ projectRoot: f.projectRoot, creatorVersion: '2.4.15', pipelineId: result.pipelineId }, f.run);
        assert.equal(undone.outcome, 'compensated');
        assert.equal(undone.rollbackStatus, 'passed');
        assert.equal(f.nodes.size, 0);
        assert.ok(undone.items.every((item) => item.removalStatus === 'removed'));
        assert.ok(undone.items.every((item) => !fs.existsSync(path.join(f.projectRoot, 'assets', 'resources', item.assetName))));
    } finally { f.cleanup(); }
});

test('a definite import failure rolls back only resources this pipeline imported', () => {
    const f = fixture({ failImport: true });
    try {
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'failed', JSON.stringify(result));
        assert.equal(result.rollbackStatus, 'passed');
        assert.equal(f.nodes.size, 0);
        assert.equal(fs.existsSync(path.join(f.projectRoot, 'assets', 'resources', 'Red.png')), false);
        assert.equal(fs.existsSync(path.join(f.projectRoot, 'assets', 'resources', 'Blue.png')), false);
    } finally { f.cleanup(); }
});

test('a definite scene rejection compensates scene writes before deleting imported resources', () => {
    const f = fixture({ failScene: true });
    try {
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'failed', JSON.stringify(result));
        assert.equal(result.rollbackStatus, 'passed');
        assert.equal(f.nodes.size, 0);
        assert.ok(result.items.every((item) => item.removalStatus === 'removed'));
    } finally { f.cleanup(); }
});

test('reconciles an uncertain AssetDB receipt only after disk absence and UUID reference scan', () => {
    const f = fixture({ failScene: true, deleteButReportFailure: true });
    try {
        const result = execute(f.params, f.run);
        assert.equal(result.outcome, 'failed', JSON.stringify(result));
        assert.equal(result.rollbackStatus, 'passed');
        assert.ok(result.items.every((item) => item.removalStatus === 'removed'));
        assert.equal(fs.existsSync(path.join(f.projectRoot, 'assets', 'resources', 'Red.png')), false);
        assert.equal(fs.existsSync(path.join(f.projectRoot, 'assets', 'resources', 'Blue.png.meta')), false);
    } finally { f.cleanup(); }
});

test('an uncertain import identity stops and preserves files for review', () => {
    const f = fixture();
    try {
        let count = 0;
        const run = (request) => {
            if (request.command === 'asset.importPng' && ++count === 1) {
                const result = f.run(request);
                const metaPath = path.join(f.projectRoot, 'assets', 'resources', 'Red.png.meta');
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                meta.subMetas.Red.rawTextureUuid = crypto.randomUUID();
                fs.writeFileSync(metaPath, JSON.stringify(meta));
                return result;
            }
            return f.run(request);
        };
        const result = execute(f.params, run);
        assert.equal(result.outcome, 'needs-review');
        assert.equal(result.rollbackStatus, 'blocked');
        assert.equal(f.nodes.size, 0);
        assert.equal(fs.existsSync(path.join(f.projectRoot, 'assets', 'resources', 'Red.png')), true);
    } finally { f.cleanup(); }
});
