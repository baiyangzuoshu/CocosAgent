'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./content-swap-core');

function harness() {
    const events = [];
    const textures = [];
    let visible = null;
    let failDraw = false;
    const adapter = {
        creatorVersion: '3.8.7',
        load: async (path) => {
            if (path === 'missing/texture') throw Error('LOAD_FAILED');
            const texture = { uuid: `${path}-uuid`, refCount: 0, valid: true,
                addRef() { this.refCount++; events.push(`hold:${path}`); },
                decRef() { this.refCount--; events.push(`release:${path}`); } };
            textures.push(texture);
            return texture;
        },
        createFrame: (texture) => ({ texture, disposed: false }),
        installFrame: (frame) => { visible = frame; events.push(`show:${frame ? frame.texture.uuid : 'none'}`); },
        confirmFrame: async () => { if (failDraw) throw Error('DRAW_FAILED'); events.push('draw'); },
        disposeFrame: (frame) => { frame.disposed = true; events.push(`dispose:${frame.texture.uuid}`); },
        releaseUnused: () => { for (const texture of textures) if (texture.refCount === 0) texture.valid = false; },
        isValid: (texture) => texture.valid,
        assetId: (texture) => texture.uuid,
    };
    const controller = create(adapter);
    const release = (id, path) => ({ contractVersion: '0.1', creatorVersion: '3.8.7',
        delivery: 'built-in-resources', releaseId: id, fingerprint: `${id}-fingerprint`,
        assets: [{ id: 'visual', runtimePath: path, resourceUuid: `${path}-uuid` }] });
    return { controller, release, events, textures, visible: () => visible, failDraw: (value) => { failDraw = value; } };
}

test('applies after draw and only then releases the old texture', async () => {
    const h = harness();
    assert.equal((await h.controller.apply(h.release('red', 'red/texture'), 'visual')).outcome, 'applied');
    assert.equal((await h.controller.apply(h.release('blue', 'blue/texture'), 'visual')).outcome, 'applied');
    assert.ok(h.events.indexOf('draw') < h.events.indexOf('release:red/texture'));
    assert.equal(h.textures[0].valid, false);
    assert.equal(h.textures[1].refCount, 1);
    assert.equal(h.controller.snapshot().activeReleaseId, 'blue');
    assert.equal((await h.controller.apply(h.release('blue', 'blue/texture'), 'visual')).outcome, 'already-active');
    assert.equal(h.controller.dispose().outcome, 'disposed');
    assert.equal(h.textures[1].valid, false);
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
