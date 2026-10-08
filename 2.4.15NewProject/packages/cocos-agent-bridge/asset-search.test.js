'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { searchPngAssets } = require('./asset-search');

const uuidA = 'be74f85d-2ff1-472e-9d9c-571605318daf';
const uuidB = 'bf3ac0aa-a2b4-4806-b5c7-740be92924c3';
const uuidC = 'c3e2a935-1d59-45d7-a1a3-729e2bc6742b';
const uuidD = 'd4f3a935-1d59-45d7-a1a3-729e2bc6742b';
const uuidE = 'e5f4a935-1d59-45d7-a1a3-729e2bc6742b';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-asset-search-'));
const assets = path.join(root, 'assets');
const resources = path.join(assets, 'resources');
const missingMeta = path.join(assets, 'missing-meta');
fs.mkdirSync(resources, { recursive: true });
fs.mkdirSync(missingMeta, { recursive: true });

function asset(relative, uuid, meta) {
    const filename = path.join(assets, relative);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, 'png-fixture');
    if (meta !== undefined) fs.writeFileSync(`${filename}.meta`, JSON.stringify(meta));
    return { url: `db://assets/${relative.split(path.sep).join('/')}`, uuid, type: 'texture', isSubAsset: false };
}

const valid = asset('resources/cocos-agent-valid.png', uuidA, { importer: 'texture', uuid: uuidA, width: 4, height: 8,
    subMetas: { frame: { importer: 'sprite-frame', uuid: uuidB, rawTextureUuid: uuidA } } });
const noFrame = asset('resources/cocos-agent-no-frame.png', uuidC, { importer: 'texture', uuid: uuidC, width: 2, height: 2, subMetas: {} });
const mismatch = asset('resources/cocos-agent-mismatch.png', uuidD, { importer: 'texture', uuid: uuidE, width: 1, height: 1, subMetas: {} });
const absentMeta = asset('missing-meta/cocos-agent-absent.png', uuidE);
const externalFile = path.join(root, 'cocos-agent-link.png');
fs.writeFileSync(externalFile, 'external');
const linkPath = path.join(resources, 'cocos-agent-link.png');
fs.symlinkSync(externalFile, linkPath);
fs.writeFileSync(`${linkPath}.meta`, JSON.stringify({ importer: 'texture', uuid: uuidA, width: 1, height: 1,
    subMetas: { frame: { importer: 'sprite-frame', uuid: uuidB, rawTextureUuid: uuidA } } }));
const link = { url: 'db://assets/resources/cocos-agent-link.png', uuid: uuidA, type: 'texture', isSubAsset: false };
const escaped = { url: 'db://assets/resources/%2E%2E/%2E%2E/cocos-agent-escape.png', uuid: uuidA, type: 'texture', isSubAsset: false };
const child = { ...valid, url: 'db://assets/resources/cocos-agent-valid.png/spriteFrame', isSubAsset: true };
const irrelevant = { ...valid, url: 'db://assets/resources/other.jpg' };
const rows = [valid, noFrame, mismatch, absentMeta, link, escaped, child, irrelevant];

function query(search, list = rows) {
    let result;
    let callbackCount = 0;
    const db = { queryAssets(pattern, type, callback) {
        assert.strictEqual(pattern, 'db://assets/**/*');
        assert.strictEqual(type, 'texture');
        callback(null, list);
    } };
    searchPngAssets(db, assets, search, (error, value) => {
        callbackCount += 1;
        assert.ifError(error);
        result = value;
    });
    assert.strictEqual(callbackCount, 1);
    return result;
}

try {
    const first = query({ query: 'COCOS-AGENT', limit: 2, offset: 0 });
    assert.strictEqual(first.total, 6);
    assert.strictEqual(first.items.length, 2);
    assert.strictEqual(first.nextOffset, 2);
    const second = query({ query: 'cocos-agent', limit: 2, offset: 2 });
    assert.strictEqual(second.nextOffset, 4);
    const last = query({ query: 'cocos-agent', limit: 2, offset: 4 });
    assert.strictEqual(last.nextOffset, null);
    const all = query({ query: 'cocos-agent', limit: 20, offset: 0 });
    const statuses = Object.fromEntries(all.items.map((item) => [item.name, item.metadataStatus]));
    assert.deepStrictEqual(statuses, {
        'cocos-agent-absent.png': 'metadata-unavailable',
        'cocos-agent-escape.png': 'metadata-unavailable',
        'cocos-agent-link.png': 'metadata-unavailable',
        'cocos-agent-mismatch.png': 'identity-mismatch',
        'cocos-agent-no-frame.png': 'sprite-frame-unavailable',
        'cocos-agent-valid.png': 'valid',
    });
    assert.strictEqual(all.items.find((item) => item.metadataStatus === 'valid').spriteFrameUuid, uuidB);
    assert.ok(all.items.every((item) => !path.isAbsolute(item.url)));
    assert.strictEqual(query({ query: 'not-present', limit: 5, offset: 0 }).total, 0);
    const projectAssets = path.resolve(__dirname, '../../assets');
    const realMeta = JSON.parse(fs.readFileSync(path.join(projectAssets, 'Texture/HelloWorld.png.meta'), 'utf8'));
    let realAssetResult;
    searchPngAssets({ queryAssets(_pattern, _type, callback) {
        callback(null, [{ url: 'db://assets/Texture/HelloWorld.png', uuid: realMeta.uuid, type: 'texture', isSubAsset: false }]);
    } }, projectAssets, { query: 'HelloWorld', limit: 5, offset: 0 }, (error, result) => {
        assert.ifError(error);
        realAssetResult = result;
    });
    assert.strictEqual(realAssetResult.items[0].metadataStatus, 'valid');
    assert.strictEqual(realAssetResult.items[0].textureUuid, realMeta.uuid);
    assert.strictEqual(realAssetResult.items[0].spriteFrameUuid, realMeta.subMetas.HelloWorld.uuid);
    let unavailableError;
    searchPngAssets(null, assets, { query: 'x', limit: 1, offset: 0 }, (error) => { unavailableError = error; });
    assert.strictEqual(unavailableError.code, 'ASSETDB_UNAVAILABLE');
    let queryError;
    searchPngAssets({ queryAssets(_pattern, _type, callback) { callback(new Error('fixture failure')); } }, assets,
        { query: 'x', limit: 1, offset: 0 }, (error) => { queryError = error; });
    assert.strictEqual(queryError.code, 'ASSET_QUERY_FAILED');
    process.stdout.write('2.4 AssetDB PNG filtering, real/synthetic metadata identity, safe paths, and pagination passed\n');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
