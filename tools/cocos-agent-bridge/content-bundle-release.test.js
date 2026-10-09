'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const bundleRelease = require('./content-bundle-release');
const contentRelease = require('./content-release');

const sampleRoot = path.resolve(__dirname, '../../2.4.15NewProject');
const sampleBundle = path.join(sampleRoot, 'assets/CocosAgentBundleSmoke');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-content-bundle-'));
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.cpSync(sampleBundle, path.join(root, 'assets/CocosAgentBundleSmoke'), { recursive: true });
    fs.copyFileSync(path.join(sampleRoot, 'assets/CocosAgentBundleSmoke.meta'), path.join(root, 'assets/CocosAgentBundleSmoke.meta'));
    const params = {
        projectRoot: root, creatorVersion: '2.4.15', releaseId: 'bundle-release-a',
        bundleRoot: 'assets/CocosAgentBundleSmoke', bundleName: 'cocos-agent-smoke',
        entryAssetName: 'BlueReleaseOct09.png',
        assets: [
            { id: 'red', assetName: 'RedReleaseOct09.png' },
            { id: 'blue', assetName: 'BlueReleaseOct09.png', dependsOn: ['red'] },
        ],
    };
    return { root, params };
}

test('plans and stages a Creator 2.4 local Asset Bundle release from imported PNG metadata', () => {
    const value = fixture();
    try {
        const plan = bundleRelease.plan(value.params);
        assert.equal(plan.success, true);
        assert.equal(plan.manifest.delivery, 'asset-bundle');
        assert.equal(plan.manifest.bundleName, 'cocos-agent-smoke');
        assert.equal(plan.manifest.entryAssetId, 'blue');
        assert.deepEqual(plan.assets.map((asset) => asset.textureUuid), [
            'cdc0901f-6059-4519-9abd-dff51521abea', '0a19c5a6-a415-4278-8d9c-12f98bfe1bc8',
        ]);
        assert.deepEqual(plan.assets.map((asset) => asset.spriteFrameUuid), [
            '69e2f032-7739-49aa-b9f0-6b6eb820984f', '3f0ad80b-bafa-4818-a000-7dfeb8aa80f5',
        ]);
        assert.equal(bundleRelease.stage(value.params).outcome, 'staged');
        assert.equal(bundleRelease.stage(value.params).idempotent, true);
        assert.equal(contentRelease.select({ projectRoot: value.root, creatorVersion: '2.4.15',
            releaseId: 'bundle-release-a', expectedCurrent: null }).outcome, 'selected');
        const fetched = contentRelease.get({ projectRoot: value.root, creatorVersion: '2.4.15', releaseId: 'bundle-release-a' });
        assert.equal(fetched.release.delivery, 'asset-bundle');
        assert.equal(fetched.release.fingerprint, plan.fingerprint);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('rejects a Bundle name collision, remote bundle metadata, UUID mismatch and 3.8 requests', () => {
    const value = fixture();
    try {
        assert.equal(bundleRelease.stage(value.params).success, true);
        assert.equal(bundleRelease.stage({ ...value.params, releaseId: 'bundle-release-b' }).error.code, 'BUNDLE_NAME_CONFLICT');
        assert.equal(bundleRelease.plan({ ...value.params, creatorVersion: '3.8.7' }).error.code, 'INVALID_ARGUMENT');

        const folderMetaPath = path.join(value.root, 'assets/CocosAgentBundleSmoke.meta');
        const folderMeta = JSON.parse(fs.readFileSync(folderMetaPath, 'utf8'));
        folderMeta.isRemoteBundle = true;
        fs.writeFileSync(folderMetaPath, JSON.stringify(folderMeta));
        assert.equal(bundleRelease.plan(value.params).details.code, 'BUNDLE_CONFIGURATION_MISMATCH');
        folderMeta.isRemoteBundle = {};
        fs.writeFileSync(folderMetaPath, JSON.stringify(folderMeta));

        const source = path.join(value.root, 'assets/CocosAgentBundleSmoke/BlueReleaseOct09.png');
        const metaPath = `${source}.meta`;
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.subMetas.BlueReleaseOct09.rawTextureUuid = 'cdc0901f-6059-4519-9abd-dff51521abea';
        fs.writeFileSync(metaPath, JSON.stringify(meta));
        assert.equal(bundleRelease.plan(value.params).details.code, 'BUNDLE_SPRITE_FRAME_MISMATCH');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('a changed Bundle PNG invalidates a previously staged release at selection time', () => {
    const value = fixture();
    try {
        const staged = bundleRelease.stage(value.params);
        assert.equal(staged.success, true);
        fs.appendFileSync(path.join(value.root, 'assets/CocosAgentBundleSmoke/BlueReleaseOct09.png'), 'changed');
        const selected = contentRelease.select({ projectRoot: value.root, creatorVersion: '2.4.15',
            releaseId: 'bundle-release-a', expectedCurrent: null });
        assert.equal(selected.error.code, 'RELEASE_CHANGED');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});
