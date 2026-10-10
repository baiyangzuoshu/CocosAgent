'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const runtime = require('../../../2.4.15NewProject/assets/Script/CocosAgentContentRuntime.js');

function harness(options = {}) {
    const calls = [];
    const bundles = new Map();
    let capturedAdapter;
    const canvas = { children: [], addChild(node) { this.children.push(node); } };
    const scene = { _id: options.sceneUuid || 'scene-main', getChildByName(name) { return name === 'Canvas' ? canvas : null; } };
    let sceneLaunch;
    class Node {
        constructor(name) { this.name = name; this.children = []; }
        setPosition(x, y) { this.position = { x, y }; }
        addChild(node) { this.children.push(node); }
        addComponent(Type) { return new Type(); }
        destroy() { this.destroyed = true; }
    }
    class Sprite { }
    Sprite.SizeMode = { CUSTOM: 1 };
    class Texture2D { }
    const cachedUuids = new Set(['texture-uuid']);
    const assetCache = { count: 7, forEach() {}, has(uuid) { return cachedUuids.has(uuid); } };
    const bundleCache = { count: 2, forEach(callback) {
        callback({ name: 'resources' }, 'resources');
        callback({ name: 'cocos-agent-smoke' }, 'cocos-agent-smoke');
    } };
    const cc = {
        Node,
        Sprite,
        Texture2D,
        SpriteFrame: class SpriteFrame { constructor(texture) { this.texture = texture; } },
        Director: { EVENT_AFTER_DRAW: 'after-draw', EVENT_AFTER_SCENE_LAUNCH: 'after-scene-launch' },
        director: { getScene: () => scene, once() {}, on(event, callback) { if (event === 'after-scene-launch') sceneLaunch = callback; } },
        isValid: (asset) => !!asset,
        resources: { load(path, type, callback) { calls.push(['resources.load', path, type]); callback(null, { _uuid: `${path}-uuid` }); } },
        assetManager: {
            assets: assetCache,
            bundles: bundleCache,
            getBundle(name) { return bundles.get(name); },
            loadBundle(name, callback) {
                calls.push(['loadBundle', name]);
                const loaded = new Map();
                const bundle = { name,
                    get(path) { return loaded.get(path); },
                    load(path, type, done) {
                        calls.push(['bundle.load', name, path, type]);
                        const texture = { _uuid: `${path}-uuid` };
                        loaded.set(path, texture);
                        cachedUuids.add(texture._uuid);
                        done(null, texture);
                    },
                    release(path, type) {
                        calls.push(['bundle.release', name, path, type]);
                        const texture = loaded.get(path);
                        if (texture) cachedUuids.delete(texture._uuid);
                        loaded.delete(path);
                    },
                };
                bundles.set(name, bundle);
                callback(null, bundle);
            },
            removeBundle(bundle) { calls.push(['removeBundle', bundle.name]); bundles.delete(bundle.name); },
            releaseUnusedAssets() { calls.push(['releaseUnusedAssets']); },
        },
    };
    const core = { create(adapter) {
        capturedAdapter = adapter;
        return { apply() {}, snapshot() { return {}; }, dispose() { return { outcome: 'disposed' }; } };
    } };
    const instance = runtime.mount({ cc, core, scene });
    return { instance, calls, Texture2D, captured: () => capturedAdapter,
        setSceneUuid(uuid) { scene._id = uuid; if (sceneLaunch) sceneLaunch(); },
        dropCached(uuid) { cachedUuids.delete(uuid); } };
}

test('Creator 2.4 runtime loads a Bundle texture through AssetManager and removes its cached Bundle', async () => {
    const h = harness();
    const adapter = h.captured();
    const asset = { id: 'blue', runtimePath: 'BlueReleaseOct09', resourceUuid: 'texture-uuid',
        spriteFrameUuid: 'spriteframe-uuid' };
    const release = { delivery: 'asset-bundle', bundleName: 'cocos-agent-smoke' };
    const texture = await adapter.load(asset.runtimePath, asset, release);
    assert.equal(texture._uuid, 'BlueReleaseOct09-uuid');
    assert.deepEqual(h.calls.slice(0, 2).map((call) => call.slice(0, 2)), [
        ['loadBundle', 'cocos-agent-smoke'], ['bundle.load', 'cocos-agent-smoke'],
    ]);
    assert.equal(h.calls[1][2], 'BlueReleaseOct09');
    assert.equal(h.calls[1][3], h.Texture2D);
    assert.equal(adapter.isCached(texture), true);
    assert.equal(adapter.releaseBundleAsset('cocos-agent-smoke', 'BlueReleaseOct09', texture._uuid), true);
    assert.deepEqual(h.calls[2], ['bundle.release', 'cocos-agent-smoke', 'BlueReleaseOct09', h.Texture2D]);
    assert.equal(adapter.isCached(texture), false);
    adapter.removeBundle('cocos-agent-smoke');
    assert.deepEqual(h.calls.at(-1), ['removeBundle', 'cocos-agent-smoke']);
});

test('Creator 2.4 built-in resources keep using cc.resources.load', async () => {
    const h = harness();
    const asset = { id: 'blue', runtimePath: 'GeneratedBlue', resourceUuid: 'texture-uuid' };
    const texture = await h.captured().load(asset.runtimePath, asset, { delivery: 'built-in-resources' });
    assert.equal(texture._uuid, 'GeneratedBlue-uuid');
    assert.equal(h.calls[0][0], 'resources.load');
});

test('Creator 2.4 runtime reports bounded AssetManager cache counts and Bundle names', () => {
    const diagnostics = harness().captured().diagnostics();
    assert.equal(diagnostics.assetCacheCount, 7);
    assert.equal(diagnostics.bundleCacheCount, 2);
    assert.deepEqual(diagnostics.bundleNames, ['cocos-agent-smoke', 'resources']);
    assert.equal(diagnostics.bundleNamesTruncated, false);
    assert.match(diagnostics.sampledAt, /^20\d\d-/);
    assert.ok(diagnostics.jsHeap === null || diagnostics.jsHeap.source === 'performance.memory');
    const adapter = harness().captured();
    assert.equal(adapter.isCached({ _uuid: 'texture-uuid' }), true);
    assert.equal(adapter.isCached({ _uuid: 'missing' }), false);
});

test('dependency scheduler loads owner before the active consumer and defers release while its scene is active', async () => {
    const h = harness({ sceneUuid: 'scene-a' });
    const adapter = h.captured();
    const contract = { schema: 'cocos.asset-bundle-dependency', version: '0.2', creatorVersion: '2.4.15', platform: 'web-mobile',
        contractId: 'shared-contract', buildId: 'shared-build-01',
        deliveries: [
            { id: 'owner-resources', kind: 'builtin-bundle', bundleName: 'resources', role: 'owner', dependsOn: [] },
            { id: 'consumer-smoke', kind: 'bundle', bundleName: 'cocos-agent-smoke', role: 'consumer', dependsOn: ['owner-resources'] },
        ],
        assets: [
            { uuid: 'frame-uuid', type: 'cc.SpriteFrame', ownerDeliveryId: 'owner-resources', dependsOn: ['texture-uuid'] },
            { uuid: 'texture-uuid', type: 'cc.Texture2D', ownerDeliveryId: 'owner-resources', dependsOn: [] },
        ],
        references: [{ consumerDeliveryId: 'consumer-smoke', sceneUuid: 'scene-a', assetUuid: 'frame-uuid' }],
        loadOrder: ['owner-resources', 'consumer-smoke'], unloadOrder: ['consumer-smoke', 'owner-resources'] };
    const lease = await adapter.acquireDependencies(contract, { resourceUuid: 'texture-uuid' });
    assert.equal(lease.receipt.outcome, 'acquired');
    assert.deepEqual(h.calls.filter((call) => call[0] === 'loadBundle').map((call) => call[1]), ['resources', 'cocos-agent-smoke']);
    assert.equal(lease.receipt.ownerLoaded, true);
    assert.equal(lease.receipt.consumerLoaded, true);
    assert.equal(lease.receipt.consumerSceneAlreadyActive, true);
    assert.deepEqual(lease.receipt.redirectTargets, [{ assetUuid: 'frame-uuid', ownerDeliveryId: 'owner-resources' }]);
    const deferred = adapter.releaseDependencies(lease);
    assert.equal(deferred.outcome, 'OWNER_RELEASE_DEFERRED');
    assert.equal(deferred.activeSceneUuid, 'scene-a');
    assert.equal(h.calls.some((call) => call[0] === 'releaseUnusedAssets'), false);
    h.dropCached('texture-uuid');
    h.setSceneUuid('scene-main');
    assert.equal(lease.receipt.outcome, 'released');
    assert.equal(lease.receipt.ownerBundleRetained, true);
    assert.equal(h.calls.some((call) => call[0] === 'releaseUnusedAssets'), true);
});

test('dependency lease protects static Bundle references independently of the selected dynamic asset UUID', async () => {
    const h = harness({ sceneUuid: 'scene-a' });
    const contract = { schema: 'cocos.asset-bundle-dependency', version: '0.2',
        creatorVersion: '2.4.15', platform: 'web-mobile',
        assets: [{ uuid: 'shared-texture', type: 'cc.Texture2D', ownerDeliveryId: 'owner-resources', dependsOn: [] }],
        deliveries: [
            { id: 'owner-resources', kind: 'builtin-bundle', bundleName: 'resources', role: 'owner', dependsOn: [] },
            { id: 'consumer-smoke', kind: 'bundle', bundleName: 'cocos-agent-smoke', role: 'consumer', dependsOn: ['owner-resources'] },
        ],
        references: [{ consumerDeliveryId: 'consumer-smoke', sceneUuid: 'scene-a', assetUuid: 'shared-frame' }],
        loadOrder: ['owner-resources', 'consumer-smoke'], unloadOrder: ['consumer-smoke', 'owner-resources'],
    };
    const lease = await h.captured().acquireDependencies(contract, { resourceUuid: 'other-texture' });
    assert.equal(lease.receipt.outcome, 'acquired');
    assert.equal(lease.receipt.candidateAssetInDependencyContract, false);
    assert.equal(lease.receipt.candidateAssetUuid, 'other-texture');
});

test('a live lease in another consumer prevents release of their shared owner', async () => {
    const h = harness({ sceneUuid: 'scene-a' });
    const adapter = h.captured();
    const contract = { schema: 'cocos.asset-bundle-dependency', version: '0.2', creatorVersion: '2.4.15', platform: 'web-mobile',
        assets: [{ uuid: 'texture-uuid', type: 'cc.Texture2D', ownerDeliveryId: 'owner-resources', dependsOn: [] }],
        deliveries: [
            { id: 'owner-resources', kind: 'builtin-bundle', bundleName: 'resources', role: 'owner', dependsOn: [] },
            { id: 'consumer-smoke', kind: 'bundle', bundleName: 'cocos-agent-smoke', role: 'consumer', dependsOn: ['owner-resources'] },
        ],
        references: [{ consumerDeliveryId: 'consumer-smoke', sceneUuid: 'scene-a', assetUuid: 'frame-uuid' }],
        loadOrder: ['owner-resources', 'consumer-smoke'], unloadOrder: ['consumer-smoke', 'owner-resources'] };
    const first = await adapter.acquireDependencies(contract, { resourceUuid: 'texture-uuid' });
    const second = await adapter.acquireDependencies(contract, { resourceUuid: 'texture-uuid' });
    adapter.releaseDependencies(first);
    h.setSceneUuid('scene-main');
    assert.equal(first.receipt.outcome, 'OWNER_RELEASE_DEFERRED');
    assert.equal(h.calls.some((call) => call[0] === 'releaseUnusedAssets'), false);
    adapter.releaseDependencies(second);
    h.dropCached('texture-uuid');
    h.setSceneUuid('scene-other');
    assert.equal(first.receipt.outcome, 'released');
    assert.equal(second.receipt.outcome, 'released');
});
