'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { plan, execute, get } = require('./asset-batch');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlXjQAAAABJRU5ErkJggg==', 'base64');
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
test('batch plans, imports and persists both PNG assets', () => {
    const f = fixture();
    try {
        assert.equal(plan(f.params).outcome, 'ready');
        const run = (request) => {
            const assetName = path.basename(request.input.sourcePath);
            const destination = path.join(f.params.projectRoot, 'assets', 'resources', assetName);
            fs.copyFileSync(request.input.sourcePath, destination);
            fs.writeFileSync(`${destination}.meta`, '{}');
            return { success: true, outcome: 'completed', result: { assetName, uuid: `uuid-${assetName}` } };
        };
        const result = execute(f.params, run);
        assert.equal(result.outcome, 'completed');
        assert.deepEqual(result.items.map((item) => item.status), ['imported', 'imported']);
        assert.equal(get({ ...f.params, batchId: result.batchId }).outcome, 'completed');
        assert.equal(execute({ ...f.params, batchId: result.batchId }, run).outcome, 'completed');
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
            const destination = path.join(f.params.projectRoot, 'assets', 'resources', assetName);
            fs.copyFileSync(request.input.sourcePath, destination);
            fs.writeFileSync(`${destination}.meta`, '{}');
            return { success: true, outcome: 'completed', result: { assetName } };
        });
        assert.equal(result.outcome, 'failed');
        assert.deepEqual(result.items.map((item) => item.status), ['imported', 'rejected']);
        assert.equal(fs.existsSync(path.join(f.params.projectRoot, 'assets', 'resources', 'One.png')), true);
    } finally { f.cleanup(); }
});
