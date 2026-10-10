'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const dependencies = require('./content-bundle-dependencies');
const build = require('./content-build');

const textureUuid = 'bf8602ca-5561-4eb5-8c63-9653d4c32a4f';
const frameUuid = '0683b14a-8790-4ecd-9ee5-4b83163e34ff';
const sceneUuid = '53751717-051c-4b3d-abe7-19bfc2b3990a';
const sourcePng = path.resolve(__dirname, '../../2.4.15NewProject/assets/resources/RedReleaseOct09.png');

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-bundle-deps-'));
    const resources = path.join(root, 'assets/resources');
    const bundle = path.join(root, 'assets/Consumer');
    fs.mkdirSync(resources, { recursive: true });
    fs.mkdirSync(bundle, { recursive: true });
    fs.writeFileSync(path.join(root, 'assets/Consumer.meta'), JSON.stringify({ isBundle: true, bundleName: 'consumer-demo' }));
    fs.copyFileSync(sourcePng, path.join(resources, 'Shared.png'));
    fs.writeFileSync(path.join(resources, 'Shared.png.meta'), JSON.stringify({ importer: 'texture', uuid: textureUuid,
        subMetas: { Shared: { importer: 'sprite-frame', uuid: frameUuid, rawTextureUuid: textureUuid } } }));
    fs.writeFileSync(path.join(bundle, 'Shared.fire'), JSON.stringify({ spriteFrame: { __uuid__: frameUuid } }));
    fs.writeFileSync(path.join(bundle, 'Shared.fire.meta'), JSON.stringify({ uuid: sceneUuid, importer: 'scene' }));
    return { root, bundle, source: 'assets/resources/Shared.png' };
}

function contractFor(value, contractId = 'contract-demo-01', buildId = 'bundle-demo-01') {
    return dependencies.plan({ projectRoot: value.root, creatorVersion: '2.4.15', contractId, buildId,
        platform: 'web-mobile', assetSources: [value.source] });
}

test('derives owners, static consumers, UUID dependencies, and deterministic scheduling from source files', () => {
    const value = fixture();
    try {
        const planned = contractFor(value);
        assert.equal(planned.success, true);
        assert.equal(planned.contract.assets.length, 2);
        assert.equal(planned.contract.assets.find((asset) => asset.type === 'cc.SpriteFrame').meta.rawTextureUuid, textureUuid);
        assert.deepEqual(planned.contract.deliveries.map((delivery) => [delivery.id, delivery.role]), [
            ['consumer-consumer-demo', 'consumer'], ['owner-resources', 'owner'],
        ]);
        assert.deepEqual(planned.contract.loadOrder, ['owner-resources', 'consumer-consumer-demo']);
        assert.deepEqual(planned.contract.unloadOrder, ['consumer-consumer-demo', 'owner-resources']);
        assert.equal(planned.contract.references[0].sceneUuid, sceneUuid);
        assert.equal(planned.contract.references[0].assetUuid, frameUuid);
        assert.equal(fs.existsSync(path.join(value.root, '.cocos-agent')), false);
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('stages an immutable contract and get detects source or reference drift', () => {
    const value = fixture();
    try {
        const staged = dependencies.stage({ projectRoot: value.root, creatorVersion: '2.4.15', contractId: 'contract-demo-01',
            buildId: 'bundle-demo-01', assetSources: [value.source] });
        assert.equal(staged.success, true);
        assert.equal(staged.outcome, 'staged');
        const read = dependencies.get({ projectRoot: value.root, creatorVersion: '2.4.15', contractId: 'contract-demo-01' });
        assert.equal(read.success, true);
        assert.equal(read.fingerprint, staged.fingerprint);
        assert.equal(dependencies.stage({ projectRoot: value.root, creatorVersion: '2.4.15', contractId: 'contract-demo-01',
            buildId: 'bundle-demo-01', assetSources: [value.source] }).outcome, 'already-staged');
        fs.writeFileSync(path.join(value.bundle, 'Shared.fire'), '{}');
        assert.equal(dependencies.get({ projectRoot: value.root, creatorVersion: '2.4.15', contractId: 'contract-demo-01' }).error.code,
            'CONTRACT_SOURCE_CHANGED');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});

test('build verification checks unique local owner and the consumer scene redirect to that owner', () => {
    const value = fixture();
    try {
        const planned = contractFor(value);
        assert.equal(planned.success, true);
        const output = path.join(value.root, 'out');
        const ownerRoot = path.join(output, 'web-mobile/assets/resources');
        const consumerRoot = path.join(output, 'web-mobile/assets/consumer-demo');
        fs.mkdirSync(path.join(ownerRoot, 'import', frameUuid.slice(0, 2)), { recursive: true });
        fs.mkdirSync(path.join(ownerRoot, 'import', textureUuid.slice(0, 2)), { recursive: true });
        fs.mkdirSync(path.join(ownerRoot, 'native', textureUuid.slice(0, 2)), { recursive: true });
        fs.mkdirSync(consumerRoot, { recursive: true });
        fs.writeFileSync(path.join(ownerRoot, 'import', frameUuid.slice(0, 2), `${frameUuid}.frame123.json`),
            JSON.stringify([1, [build.compactUuid(textureUuid)], ['_textureSetter'], ['cc.SpriteFrame']]));
        fs.writeFileSync(path.join(ownerRoot, 'import', textureUuid.slice(0, 2), `${textureUuid}.tex123.json`), '{}');
        fs.writeFileSync(path.join(ownerRoot, 'native', textureUuid.slice(0, 2), `${textureUuid}.native123.png`), 'png');
        const owner = { name: 'resources', uuids: [build.compactUuid(frameUuid), build.compactUuid(textureUuid)],
            paths: { 0: ['Shared', 0], 1: ['Shared', 1] }, types: ['cc.SpriteFrame', 'cc.Texture2D'],
            nativeBase: 'native', versions: { import: [0, 'frame123', 1, 'tex123'], native: [1, 'native123'] } };
        const consumer = { name: 'consumer-demo', uuids: [build.compactUuid(sceneUuid), build.compactUuid(frameUuid)],
            paths: {}, types: ['cc.SceneAsset', 'cc.SpriteFrame'], deps: ['resources', 'internal'], redirect: [1, 0],
            scenes: { 'db://assets/Consumer/Shared.fire': 0 } };
        const configs = [{ filename: path.join(ownerRoot, 'config.aaa.json'), value: owner },
            { filename: path.join(consumerRoot, 'config.bbb.json'), value: consumer }];
        configs.forEach(({ filename, value: config }) => fs.writeFileSync(filename, JSON.stringify(config)));
        let result = build.verifyDependencyContract(output, configs, planned.contract);
        assert.equal(result.success, true);
        assert.equal(result.checks.filter((check) => check.redirectTarget).length, 1);
        consumer.redirect = [1, 1];
        fs.writeFileSync(configs[1].filename, JSON.stringify(consumer));
        result = build.verifyDependencyContract(output, configs, planned.contract);
        assert.equal(result.error.code, 'DEPENDENCY_REDIRECT_MISMATCH');
    } finally { fs.rmSync(value.root, { recursive: true, force: true }); }
});
