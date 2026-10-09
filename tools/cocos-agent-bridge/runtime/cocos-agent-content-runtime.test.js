'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const runtime = require('../../../2.4.15NewProject/assets/Script/CocosAgentContentRuntime.js');

function harness() {
    const calls = [];
    const bundles = new Map();
    let capturedAdapter;
    const canvas = { children: [], addChild(node) { this.children.push(node); } };
    const scene = { getChildByName(name) { return name === 'Canvas' ? canvas : null; } };
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
        Director: { EVENT_AFTER_DRAW: 'after-draw' },
        director: { getScene: () => scene, once() {} },
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
    return { instance, calls, Texture2D, captured: () => capturedAdapter };
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
