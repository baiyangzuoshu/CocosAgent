'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { plan, execute, get } = require('./asset-batch');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXjQAAAABJRU5ErkJggg==', 'base64');
let nextUuid = 1;
function uuid() { return `00000000-0000-4000-8000-${String(nextUuid++).padStart(12, '0')}`; }
function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-asset-batch-'));
    const projectRoot = path.join(root, 'project');
    fs.mkdirSync(path.join(projectRoot, 'assets', 'resources'), { recursive: true });
    const sources = ['One.png', 'Two.png'].map((assetName) => {
        const source = path.join(root, assetName);
        fs.writeFileSync(source, png);
        return source;
    });
    const params = { projectRoot, creatorVersion: '2.4.15', targets: [{ projectRoot, creatorVersion: '2.4.15' }], sources };
    return { root, params, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
function importMock(projectRoot, request, options = {}) {
    const assetName = path.basename(request.input.sourcePath);
    const destination = path.join(projectRoot, 'assets', 'resources', assetName);
    fs.copyFileSync(request.input.sourcePath, destination);
    const textureUuid = uuid();
    const spriteFrameUuid = uuid();
    fs.writeFileSync(`${destination}.meta`, JSON.stringify({
        uuid: textureUuid, importer: 'texture', width: 1, height: 1,
        subMetas: { [path.basename(assetName, '.png')]: { uuid: spriteFrameUuid, importer: 'sprite-frame',
            rawTextureUuid: options.mismatchedDependency ? uuid() : textureUuid } },
    }));
    return { success: true, outcome: 'completed', result: { assetName, uuid: textureUuid, type: 'texture', imported: true } };
}
test('batch plans, imports and persists both PNG assets', () => {
    const f = fixture();
    try {
        assert.equal(plan(f.params).outcome, 'ready');
        const result = execute(f.params, (request) => importMock(f.params.projectRoot, request));
        assert.equal(result.outcome, 'completed');
        assert.deepEqual(result.items.map((item) => item.status), ['imported', 'imported']);
        assert.equal(result.items[0].result.metadata.rawTextureUuid, result.items[0].result.metadata.textureUuid);
        assert.match(result.items[0].result.metadata.spriteFrameUuid, /^[0-9a-f-]{36}$/i);
        assert.equal(get({ ...f.params, batchId: result.batchId }).outcome, 'completed');
        assert.equal(execute({ ...f.params, batchId: result.batchId }, (request) => importMock(f.params.projectRoot, request)).outcome, 'completed');
    } finally { f.cleanup(); }
});
test('batch refuses destination conflicts before writing', () => {
    const f = fixture();
    try {
        fs.writeFileSync(path.join(f.params.projectRoot, 'assets', 'resources', 'Two.png'), png);
        assert.equal(plan(f.params).error.code, 'ASSET_CONFLICT');
    } finally { f.cleanup(); }
});
test('definite second import rejection preserves the first completed item', () => {
    const f = fixture();
    try {
        const result = execute(f.params, (request) => {
            const assetName = path.basename(request.input.sourcePath);
            if (assetName === 'Two.png') return { success: false, outcome: 'failed',
                error: { code: 'ASSET_CONFLICT', sideEffect: 'none' } };
            return importMock(f.params.projectRoot, request);
        });
        assert.equal(result.outcome, 'failed');
        assert.deepEqual(result.items.map((item) => item.status), ['imported', 'rejected']);
        assert.equal(fs.existsSync(path.join(f.params.projectRoot, 'assets', 'resources', 'One.png')), true);
    } finally { f.cleanup(); }
});
test('plan requires the exact Creator project target and valid PNG dimensions', () => {
    const f = fixture();
    try {
        const wrongTarget = { ...f.params, targets: [{ projectRoot: f.params.projectRoot, creatorVersion: '3.8.7' }] };
        assert.equal(plan(wrongTarget).error.code, 'TARGET_MISMATCH');
        const oversized = Buffer.from(png);
        oversized.writeUInt32BE(5000, 16);
        fs.writeFileSync(f.params.sources[0], oversized);
        assert.equal(plan(f.params).error.code, 'INVALID_PNG_DIMENSIONS');
    } finally { f.cleanup(); }
});
test('invalid SpriteFrame-to-texture metadata stops the batch for review without hiding the imported side effect', () => {
    const f = fixture();
    try {
        let calls = 0;
        const result = execute(f.params, (request) => {
            calls++;
            return importMock(f.params.projectRoot, request, { mismatchedDependency: true });
        });
        assert.equal(result.outcome, 'needs-review');
        assert.equal(result.error.code, 'CREATOR_META_DEPENDENCY_MISMATCH');
        assert.deepEqual(result.items.map((item) => item.status), ['needs-review', 'pending']);
        assert.equal(calls, 1);
        assert.equal(fs.existsSync(path.join(f.params.projectRoot, 'assets', 'resources', 'One.png')), true);
    } finally { f.cleanup(); }
});
