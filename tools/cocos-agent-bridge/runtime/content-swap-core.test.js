'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./content-swap-core');
const creator24Core = require('../../../2.4.15NewProject/assets/Script/CocosAgentContentSwapCore.js');

function harness(creatorVersion = '3.8.7') {
    const events = [];
    const textures = [];
    const removedBundles = [];
    const releasedBundleAssets = [];
    let diagnostics = { assetCacheCount: 2, bundleCacheCount: 1, bundleNames: ['resources'], jsHeap: null };
    let visible = null;
    let failDraw = false;
    const adapter = {
        creatorVersion,
        load: async (path) => {
            if (path === 'missing/texture') throw Error('LOAD_FAILED');
            const texture = { uuid: `${path}-uuid`, path, refCount: 0, valid: true,
                addRef() { this.refCount++; events.push(`hold:${path}`); },
                decRef() { this.refCount--; events.push(`release:${path}`); } };
            textures.push(texture);
            return texture;
        },
        createFrame: (texture) => ({ texture, disposed: false }),
        installFrame: (frame) => { visible = frame; events.push(`show:${frame ? frame.texture.uuid : 'none'}`); },
        confirmFrame: async () => { if (failDraw) throw Error('DRAW_FAILED'); events.push('draw'); },
        afterCleanup: async () => { events.push('cleanup-tick'); },
        disposeFrame: (frame) => { frame.disposed = true; events.push(`dispose:${frame.texture.uuid}`); },
        releaseUnused: () => { for (const texture of textures) if (texture.refCount === 0) texture.valid = false; },
        removeBundle: (name) => { removedBundles.push(name); events.push(`removeBundle:${name}`); },
        releaseBundleAsset: (name, path, uuid) => {
            const texture = textures.find((item) => item.uuid === uuid && item.path === path);
            if (!texture) throw Error('BUNDLE_RESOURCE_ID_MISMATCH');
            texture.valid = false;
            releasedBundleAssets.push({ name, path, uuid });
            events.push(`releaseBundleAsset:${name}:${path}`);
        },
        diagnostics: () => diagnostics,
        isValid: (texture) => texture.valid,
        isCached: (texture) => texture.valid,
        assetId: (texture) => texture.uuid,
    };
    const controller = create(adapter);
    const release = (id, path) => ({ contractVersion: '0.1', creatorVersion,
        delivery: 'built-in-resources', releaseId: id, fingerprint: `${id}-fingerprint`,
        assets: [{ id: 'visual', runtimePath: path, resourceUuid: `${path}-uuid` }] });
    return { controller, release, events, textures, removedBundles, releasedBundleAssets, visible: () => visible,
        failDraw: (value) => { failDraw = value; }, setDiagnostics: (value) => { diagnostics = value; } };
}

test('applies after draw and only then releases the old texture', async () => {
    const h = harness();
    assert.equal((await h.controller.apply(h.release('red', 'red/texture'), 'visual')).outcome, 'applied');
    const blue = await h.controller.apply(h.release('blue', 'blue/texture'), 'visual');
    assert.equal(blue.outcome, 'applied');
    assert.ok(h.events.indexOf('draw') < h.events.indexOf('release:red/texture'));
    assert.equal(h.textures[0].valid, false);
    assert.equal(h.textures[1].refCount, 1);
    assert.equal(blue.previousAssetRefCount, 0);
    assert.equal(blue.previousAssetValid, false);
    assert.equal(blue.previousAssetCached, false);
    assert.ok(h.events.indexOf('release:red/texture') < h.events.indexOf('cleanup-tick'));
    assert.equal(h.controller.snapshot().activeReleaseId, 'blue');
    assert.equal(h.controller.snapshot().assetCached, true);
    assert.equal((await h.controller.apply(h.release('blue', 'blue/texture'), 'visual')).outcome, 'already-active');
    assert.equal(h.controller.dispose().outcome, 'disposed');
    assert.equal(h.textures[1].valid, false);
});

test('returns an engine diagnostics snapshot with runtime receipts and readback', async () => {
    const h = harness('2.4.15');
    const expected = { assetCacheCount: 7, bundleCacheCount: 2, bundleNames: ['cocos-agent-smoke', 'resources'], jsHeap: null };
    h.setDiagnostics(expected);
    const result = await h.controller.apply(h.release('blue', 'blue/texture'), 'visual');
    assert.equal(result.outcome, 'applied');
    assert.deepEqual(result.runtimeDiagnostics, expected);
    assert.deepEqual(h.controller.snapshot().runtimeDiagnostics, expected);
});

test('failed load and failed draw retain the previous visible frame', async () => {
    const h = harness();
    await h.controller.apply(h.release('red', 'red/texture'), 'visual');
    const red = h.visible();
    assert.equal((await h.controller.apply(h.release('missing', 'missing/texture'), 'visual')).outcome, 'retained');
    assert.equal(h.visible(), red);
    h.failDraw(true);
    const reply = await h.controller.apply(h.release('blue', 'blue/texture'), 'visual');
    assert.equal(reply.outcome, 'retained');
    assert.equal(reply.code, 'DRAW_FAILED');
    assert.equal(h.visible(), red);
    assert.equal(h.controller.snapshot().activeReleaseId, 'red');
    assert.equal(h.textures[1].valid, false);
});

test('rejects version mismatch and resource identity mismatch without releasing an unowned asset', async () => {
    const h = harness();
    const wrongVersion = h.release('red', 'red/texture');
    wrongVersion.creatorVersion = '2.4.15';
    assert.equal((await h.controller.apply(wrongVersion, 'visual')).code, 'RELEASE_MISMATCH');
    const wrongUuid = h.release('red', 'red/texture');
    wrongUuid.assets[0].resourceUuid = 'wrong';
    assert.equal((await h.controller.apply(wrongUuid, 'visual')).code, 'RESOURCE_ID_MISMATCH');
    assert.equal(h.textures[0].refCount, 0);
    assert.equal(h.controller.snapshot().activeReleaseId, null);
});

test('Creator 2.4 Bundle swaps keep the previous release through draw and remove only the replaced Bundle', async () => {
    const h = harness('2.4.15');
    const bundleRelease = (id, path, bundleName) => ({
        ...h.release(id, path),
        delivery: 'asset-bundle',
        bundleName,
        assets: [{ id: 'visual', runtimePath: path, resourceUuid: `${path}-uuid`,
            spriteFrameUuid: '3f0ad80b-bafa-4818-a000-7dfeb8aa80f5' }],
    });
    assert.equal((await h.controller.apply(bundleRelease('red', 'red', 'bundle-red'), 'visual')).outcome, 'applied');
    const red = h.visible();
    assert.equal((await h.controller.apply(bundleRelease('blue', 'blue', 'bundle-blue'), 'visual')).outcome, 'applied');
    assert.notEqual(h.visible(), red);
    assert.deepEqual(h.removedBundles, ['bundle-red']);
    assert.deepEqual(h.releasedBundleAssets, [{ name: 'bundle-red', path: 'red', uuid: 'red-uuid' }]);
    assert.ok(h.events.indexOf('draw') < h.events.indexOf('removeBundle:bundle-red'));
    assert.ok(h.events.indexOf('draw') < h.events.indexOf('releaseBundleAsset:bundle-red:red'));
    assert.equal(h.controller.snapshot().activeReleaseId, 'blue');
    assert.equal(h.controller.dispose().outcome, 'disposed');
    assert.deepEqual(h.removedBundles, ['bundle-red', 'bundle-blue']);
});

test('does not force-release a Bundle asset while another reference remains', async () => {
    const h = harness('2.4.15');
    const bundleRelease = (id, path, bundleName) => ({ ...h.release(id, path), delivery: 'asset-bundle', bundleName,
        assets: [{ id: 'visual', runtimePath: path, resourceUuid: `${path}-uuid`,
            spriteFrameUuid: '3f0ad80b-bafa-4818-a000-7dfeb8aa80f5' }] });
    await h.controller.apply(bundleRelease('red', 'red', 'bundle-red'), 'visual');
    h.textures[0].addRef();
    const replacement = await h.controller.apply(h.release('blue', 'blue/texture'), 'visual');
    assert.equal(replacement.previousAssetRefCount, 1);
    assert.equal(replacement.previousAssetValid, true);
    assert.equal(replacement.previousAssetCached, true);
    assert.deepEqual(h.releasedBundleAssets, []);
    assert.deepEqual(h.removedBundles, ['bundle-red']);
});

test('a failed 2.4 Bundle load removes only the candidate Bundle and retains the displayed frame', async () => {
    const h = harness('2.4.15');
    const bundleRelease = (id, path, bundleName) => ({
        ...h.release(id, path),
        delivery: 'asset-bundle',
        bundleName,
        assets: [{ id: 'visual', runtimePath: path, resourceUuid: `${path}-uuid`,
            spriteFrameUuid: '3f0ad80b-bafa-4818-a000-7dfeb8aa80f5' }],
    });
    await h.controller.apply(bundleRelease('red', 'red', 'bundle-red'), 'visual');
    const red = h.visible();
    const result = await h.controller.apply(bundleRelease('bad', 'missing/texture', 'bundle-bad'), 'visual');
    assert.equal(result.outcome, 'retained');
    assert.equal(h.visible(), red);
    assert.deepEqual(h.removedBundles, ['bundle-bad']);
    assert.equal(h.controller.snapshot().activeReleaseId, 'red');
});

test('asset-bundle delivery is rejected for Creator 3.8', async () => {
    const h = harness('3.8.7');
    const release = { ...h.release('bundle', 'blue/texture'), delivery: 'asset-bundle', bundleName: 'bundle-blue',
        assets: [{ id: 'visual', runtimePath: 'blue/texture', resourceUuid: 'blue/texture-uuid',
            spriteFrameUuid: '3f0ad80b-bafa-4818-a000-7dfeb8aa80f5' }] };
    const result = await h.controller.apply(release, 'visual');
    assert.equal(result.outcome, 'rejected');
    assert.equal(result.code, 'RELEASE_MISMATCH');
    assert.deepEqual(h.removedBundles, []);
});

test('the project runtime core accepts and releases the 2.4 Asset Bundle contract', async () => {
    const calls = [];
    const texture = { _uuid: 'cdc0901f-6059-4519-9abd-dff51521abea', refCount: 0,
        addRef() { this.refCount++; }, decRef() { this.refCount--; } };
    const runtime = creator24Core.create({
        creatorVersion: '2.4.15',
        async load(runtimePath, asset, release) {
            calls.push(['load', runtimePath, asset.spriteFrameUuid, release.bundleName]);
            return texture;
        },
        createFrame: (value) => ({ value }),
        installFrame: (frame) => calls.push(['install', frame ? 'frame' : 'none']),
        disposeFrame: () => calls.push(['disposeFrame']),
        confirmFrame: async () => calls.push(['draw']),
        releaseUnused: () => calls.push(['releaseUnused']),
        removeBundle: (bundleName) => calls.push(['removeBundle', bundleName]),
        isValid: () => true,
        assetId: (value) => value._uuid,
    });
    const release = { contractVersion: '0.1', creatorVersion: '2.4.15', delivery: 'asset-bundle',
        bundleName: 'cocos-agent-smoke', releaseId: 'bundle-runtime-test', fingerprint: 'f'.repeat(64),
        assets: [{ id: 'blue', runtimePath: 'BlueReleaseOct09',
            resourceUuid: 'cdc0901f-6059-4519-9abd-dff51521abea',
            spriteFrameUuid: '69e2f032-7739-49aa-b9f0-6b6eb820984f' }] };
    assert.equal((await runtime.apply(release, 'blue')).outcome, 'applied');
    assert.deepEqual(calls[0], ['load', 'BlueReleaseOct09', release.assets[0].spriteFrameUuid, 'cocos-agent-smoke']);
    assert.equal(runtime.dispose().outcome, 'disposed');
    assert.ok(calls.some((call) => call[0] === 'removeBundle' && call[1] === 'cocos-agent-smoke'));
});

test('a verified dependency contract is acquired before asset load and its dynamic lease is released after cleanup', async () => {
    const calls = [];
    const texture = { uuid: 'texture-uuid', refCount: 0, valid: true,
        addRef() { this.refCount += 1; }, decRef() { this.refCount -= 1; } };
    const runtime = create({ creatorVersion: '2.4.15',
        acquireDependencies: async (contract, asset) => {
            calls.push(['acquire', contract.contractId, asset.resourceUuid]);
            return { id: 'lease-1', receipt: { outcome: 'acquired', loadOrder: ['owner-resources', 'consumer-smoke'] } };
        },
        releaseDependencies: (lease) => { calls.push(['release-dependencies', lease.id]); return { outcome: 'released' }; },
        load: async () => { calls.push(['load']); return texture; },
        createFrame: (value) => ({ value }), installFrame: () => calls.push(['install']), disposeFrame: () => calls.push(['dispose']),
        confirmFrame: async () => calls.push(['draw']), afterCleanup: async () => calls.push(['after-draw']),
        releaseUnused: () => calls.push(['release-unused']), isValid: () => texture.valid,
        assetId: () => texture.uuid,
    });
    const release = { contractVersion: '0.1', creatorVersion: '2.4.15', delivery: 'built-in-resources',
        releaseId: 'release-with-dependencies', fingerprint: 'f'.repeat(64),
        assets: [{ id: 'visual', runtimePath: 'Shared', resourceUuid: 'texture-uuid' }] };
    const contract = { contractId: 'shared-contract-01' };
    const applied = await runtime.apply(release, 'visual', contract);
    assert.equal(applied.outcome, 'applied');
    assert.deepEqual(calls.slice(0, 2), [['acquire', 'shared-contract-01', 'texture-uuid'], ['load']]);
    assert.deepEqual(applied.dependencySchedule.loadOrder, ['owner-resources', 'consumer-smoke']);
    runtime.dispose();
    assert.ok(calls.some((call) => call[0] === 'release-dependencies' && call[1] === 'lease-1'));
});
