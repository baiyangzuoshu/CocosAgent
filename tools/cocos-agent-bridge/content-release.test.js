'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const release = require('./content-release');
const { handle } = require('./agent-jsonl');

const source = path.resolve(__dirname, '../../2.4.15NewProject/assets/resources/cocos-agent-batch-red.png');

function fixture(version) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-content-release-'));
    const dir = path.join(root, 'assets/resources');
    fs.mkdirSync(dir, { recursive: true });
    const assets = [];
    for (const [id, dependencies] of [['red', []], ['blue', ['red']]]) {
        const name = `cocos-agent-batch-${id}.png`;
        const bytes = fs.readFileSync(source);
        fs.writeFileSync(path.join(dir, name), bytes);
        const meta = version === '2.4.15' ? { importer: 'texture', uuid: `${id}-texture` }
            : { importer: 'image', imported: true, subMetas: { abc: { importer: 'texture', imported: true, uuid: `${id}-texture` } } };
        fs.writeFileSync(path.join(dir, `${name}.meta`), JSON.stringify(meta));
        assets.push({ id, source: `assets/resources/${name}`, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            runtimePath: version === '2.4.15' ? name.slice(0, -4) : `${name.slice(0, -4)}/texture`, dependsOn: dependencies });
    }
    const manifest = { contractVersion: '0.1', releaseId: 'release-a', creatorVersion: version,
        delivery: 'built-in-resources', entryAssetId: 'blue', assets };
    return { root, manifest, params: { projectRoot: root, creatorVersion: version, manifest } };
}

for (const version of ['2.4.15', '3.8.7']) {
    test(`${version}: stage, select, query and rollback local release`, () => {
        const { root, manifest, params } = fixture(version);
        try {
            const planned = release.validate(params);
            assert.equal(planned.success, true);
            assert.equal(release.stage(params).outcome, 'staged');
            assert.equal(release.stage(params).idempotent, true);
            assert.equal(release.select({ projectRoot: root, creatorVersion: version,
                releaseId: 'release-a', expectedCurrent: null }).outcome, 'selected');
            const asset = release.get({ projectRoot: root, creatorVersion: version, releaseId: 'release-a' }).release.assets[1];
            const receipt = { outcome: 'applied', releaseId: 'release-a', activeReleaseId: 'release-a',
                activeFingerprint: planned.fingerprint, assetId: asset.id, activeAssetId: asset.id,
                resourceUuid: asset.resourceUuid, currentRefCount: 1 };
            assert.equal(release.acceptRuntime({ projectRoot: root, creatorVersion: version,
                platform: 'web-preview', receipt }).outcome, 'runtime-observed');
            assert.equal(release.get({ projectRoot: root, creatorVersion: version }).effective.releaseId, 'release-a');
            const second = structuredClone(manifest);
            second.releaseId = 'release-b';
            assert.equal(release.stage({ ...params, manifest: second }).success, true);
            assert.equal(release.select({ projectRoot: root, creatorVersion: version,
                releaseId: 'release-b', expectedCurrent: 'release-a' }).previousReleaseId, 'release-a');
            assert.equal(release.acceptRuntime({ projectRoot: root, creatorVersion: version,
                platform: 'web-preview', receipt }).error.code, 'RUNTIME_RECEIPT_MISMATCH');
            assert.equal(release.get({ projectRoot: root, creatorVersion: version }).effective.releaseId, 'release-a');
            assert.equal(release.select({ projectRoot: root, creatorVersion: version,
                releaseId: 'release-a', expectedCurrent: null }).error.code, 'CURRENT_CHANGED');
            assert.equal(release.rollback({ projectRoot: root, creatorVersion: version,
                expectedCurrent: 'release-b' }).releaseId, 'release-a');
            assert.equal(release.get({ projectRoot: root, creatorVersion: version }).selected.releaseId, 'release-a');
            assert.equal(handle({ id: 1, method: 'content.get', params: { projectRoot: root,
                creatorVersion: version } }).result.selected.releaseId, 'release-a');
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });
    test(`${version}: rejects bad dependencies, wrong path and changed bytes before selecting`, () => {
        const { root, manifest, params } = fixture(version);
        try {
            manifest.assets[0].dependsOn = ['blue'];
            assert.equal(release.validate(params).error.code, 'DEPENDENCY_CYCLE');
            manifest.assets[0].dependsOn = [];
            manifest.assets[1].runtimePath = 'wrong';
            assert.equal(release.validate(params).error.code, 'RUNTIME_PATH_MISMATCH');
            manifest.assets[1].runtimePath = version === '2.4.15' ? 'cocos-agent-batch-blue' : 'cocos-agent-batch-blue/texture';
            assert.equal(release.stage(params).success, true);
            fs.appendFileSync(path.join(root, manifest.assets[0].source), 'changed');
            assert.equal(release.select({ projectRoot: root, creatorVersion: version,
                releaseId: 'release-a', expectedCurrent: null }).error.code, 'RELEASE_CHANGED');
            assert.equal(release.get({ projectRoot: root, creatorVersion: version }).selected, null);
        } finally { fs.rmSync(root, { recursive: true, force: true }); }
    });
}
