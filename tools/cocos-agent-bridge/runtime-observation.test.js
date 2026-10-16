'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { observeRuntime, sanitizeText, targetExpression, validNodePath, validSceneName, PREVIEW_URL } = require('./runtime-observation');
const SCENE_UUID = '280c3aec-6492-4a9d-9f51-a9b00b570b4a';

function fakeChrome({ sceneName = 'helloworld', sceneUuid = SCENE_UUID, screenshot = true,
    previewUrl = PREVIEW_URL } = {}) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-runtime-observe-test-'));
    let evaluation = 0;
    const port = 49152;
    class FakeCDPSocket extends EventEmitter {
        constructor() { super(); this.readyState = 0; queueMicrotask(() => { this.readyState = FakeCDPSocket.OPEN; this.emit('open'); }); }
        send(raw) {
            const request = JSON.parse(raw);
            const respond = (result = {}) => this.emit('message', Buffer.from(JSON.stringify({ id: request.id, result })));
            if (request.method === 'Runtime.enable') {
                this.emit('message', Buffer.from(JSON.stringify({ method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [
                    { type: 'string', value: 'TypeError: bad key=sk-test-12345678901234567890' },
                ], stackTrace: { callFrames: [{ url: 'http://127.0.0.1:7456/Button.js', lineNumber: 8 }] } } })));
                this.emit('message', Buffer.from(JSON.stringify({ method: 'Runtime.exceptionThrown', params: { exceptionDetails: {
                    text: 'Uncaught (in promise)', exception: { description: 'ReferenceError: missingMethod is not defined' },
                } } })));
            }
            let result = {};
            if (request.method === 'Runtime.evaluate') {
                evaluation += 1;
                const value = sceneName !== 'helloworld' ? { sceneMismatch: true, actualScene: sceneName }
                    : sceneUuid !== SCENE_UUID ? { sceneUuidMismatch: true, actualSceneUuid: sceneUuid } : {
                    sceneName, sceneUuid, frameCount: evaluation * 12, paused: false,
                    canvas: { width: 320, height: 180, x: 0, y: 0 },
                    targetNode: { path: 'helloworld/Canvas/Button', uuid: 'button-uuid', name: 'Button', active: true,
                        position: { x: 0, y: 0 }, components: [{ classId: 'cc.Button', enabled: true, interactable: true }] },
                    nodeStatus: 'found',
                };
                result = { result: { type: 'object', value } };
            }
            if (request.method === 'Page.captureScreenshot' && screenshot) result = { data: Buffer.from('fake-jpeg').toString('base64') };
            queueMicrotask(() => respond(result));
        }
        close() { this.readyState = 3; }
    }
    FakeCDPSocket.OPEN = 1;
    const fetch = async (url) => {
        if (url === previewUrl) return { ok: true, status: 200 };
        if (String(url).endsWith('/json/list')) return { ok: true, status: 200, json: async () => [{
            type: 'page', url: 'about:blank', webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/1`,
        }] };
        throw new Error('unexpected test fetch');
    };
    const spawn = (_executable, args) => {
        const profile = args.find((arg) => arg.startsWith('--user-data-dir=')).slice('--user-data-dir='.length);
        fs.writeFileSync(path.join(profile, 'DevToolsActivePort'), `${port}\n/devtools/browser/test\n`);
        const child = new EventEmitter();
        child.exitCode = null;
        child.kill = () => { child.exitCode = 0; child.emit('exit', 0, null); };
        return child;
    };
    return { tempRoot, observe: (input) => observeRuntime(input, { chromePath: 'mock-chrome', tempRoot, fetch, spawn, WebSocket: FakeCDPSocket }) };
}

test('runtime observation validates bounded scene paths and redacts secrets from collected messages', () => {
    assert.equal(validSceneName('helloworld'), true);
    assert.equal(validSceneName('../other'), false);
    assert.equal(validNodePath('helloworld/Canvas/Button'), true);
    assert.equal(validNodePath('helloworld//Button'), false);
    assert.match(targetExpression('helloworld', SCENE_UUID, 'helloworld/Canvas/Button'), /targetNode/);
    assert.match(targetExpression('helloworld', SCENE_UUID, undefined, 'http://127.0.0.1:7457/'), /127\.0\.0\.1:7457/);
    assert.doesNotMatch(sanitizeText('failed for sk-test-12345678901234567890 at /Users/alice/game'), /alice|1234567890/);
});

test('runtime observation reads exact scene, frame progress, console errors, safe node state, and a canvas image', async (t) => {
    const harness = await fakeChrome();
    t.after(() => fs.rmSync(harness.tempRoot, { recursive: true, force: true }));
    const result = await harness.observe({ expectedScene: 'helloworld', expectedSceneUuid: SCENE_UUID,
        nodePath: 'helloworld/Canvas/Button', timeoutMs: 3000 });
    assert.equal(result.success, true);
    assert.equal(result.runtime.status, 'runtime-error');
    assert.equal(result.runtime.capturedErrorCount, 2);
    assert.ok(result.runtime.frameDelta > 0);
    assert.match(result.diagnostics.errors[0].message, /REDACTED/);
    assert.equal(result.diagnostics.errors[0].location.resource, 'Button.js');
    assert.equal(result.targetNodeStatus, 'found');
    assert.equal(result.targetNode.components[0].classId, 'cc.Button');
    assert.equal(result.screenshot.available, true);
    assert.equal(result.screenshotBase64, Buffer.from('fake-jpeg').toString('base64'));
});

test('runtime observation rejects a preview showing a different scene before capturing an image', async (t) => {
    const harness = await fakeChrome({ sceneName: 'differentScene' });
    t.after(() => fs.rmSync(harness.tempRoot, { recursive: true, force: true }));
    const result = await harness.observe({ expectedScene: 'helloworld', expectedSceneUuid: SCENE_UUID, timeoutMs: 3000 });
    assert.equal(result.success, false);
    assert.equal(result.error.code, 'PREVIEW_SCENE_MISMATCH');
    assert.equal(result.error.actualScene, 'differentScene');
});

test('runtime observation rejects a same-name preview from a different scene UUID', async (t) => {
    const harness = await fakeChrome({ sceneUuid: 'ffffffff-ffff-ffff-ffff-ffffffffffff' });
    t.after(() => fs.rmSync(harness.tempRoot, { recursive: true, force: true }));
    const result = await harness.observe({ expectedScene: 'helloworld', expectedSceneUuid: SCENE_UUID, timeoutMs: 3000 });
    assert.equal(result.success, false);
    assert.equal(result.error.code, 'PREVIEW_SCENE_IDENTITY_MISMATCH');
    assert.equal(result.error.actualSceneUuid, 'ffffffff-ffff-ffff-ffff-ffffffffffff');
});

test('runtime observation rejects malformed input without starting Chrome', async () => {
    let spawned = false;
    const result = await observeRuntime({ expectedScene: 'scene/../../other', expectedSceneUuid: SCENE_UUID, timeoutMs: 3000 }, {
        chromePath: 'mock-chrome', spawn: () => { spawned = true; }, fetch: async () => ({ ok: true, status: 200 }),
    });
    assert.equal(result.error.code, 'INVALID_RUNTIME_OBSERVATION_INPUT');
    assert.equal(spawned, false);
});

test('runtime observation supports a Creator-assigned loopback preview port and returns its exact URL', async (t) => {
    const previewUrl = 'http://127.0.0.1:7457/';
    const harness = await fakeChrome({ previewUrl });
    t.after(() => fs.rmSync(harness.tempRoot, { recursive: true, force: true }));
    const result = await harness.observe({ expectedScene: 'helloworld', expectedSceneUuid: SCENE_UUID,
        previewUrl, timeoutMs: 3000 });
    assert.equal(result.success, true);
    assert.equal(result.previewUrl, previewUrl);
});

test('runtime observation rejects non-loopback, non-root, or query-bearing preview URLs', async () => {
    for (const previewUrl of ['https://127.0.0.1:7457/', 'http://localhost:7457/',
        'http://127.0.0.1:7457/other', 'http://127.0.0.1:7457/?x=1']) {
        const result = await observeRuntime({ expectedScene: 'helloworld', expectedSceneUuid: SCENE_UUID,
            previewUrl, timeoutMs: 3000 }, { chromePath: 'mock-chrome', spawn: () => { throw new Error('should not spawn'); } });
        assert.equal(result.error.code, 'INVALID_RUNTIME_OBSERVATION_INPUT', previewUrl);
    }
});
