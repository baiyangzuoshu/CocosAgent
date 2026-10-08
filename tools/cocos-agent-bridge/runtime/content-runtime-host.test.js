'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const WebSocket = require('../vendor/ws');
const content = require('../content-release');
const { start } = require('./content-runtime-host');

test('runtime channel refuses Creator versions outside the active 2.4.15 scope', () => {
    assert.throws(() => start({ projectRoot: '/tmp', creatorVersion: '3.8.7', previewUrl: 'http://127.0.0.1:7457/' }),
        { message: 'UNSUPPORTED_CREATOR_VERSION' });
});

test('local runtime channel sends selected release and accepts its receipt', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-runtime-host-'));
    const dir = path.join(root, 'assets/resources');
    fs.mkdirSync(dir, { recursive: true });
    const bytes = fs.readFileSync(path.resolve(__dirname, '../../../2.4.15NewProject/assets/resources/cocos-agent-batch-red.png'));
    fs.writeFileSync(path.join(dir, 'red.png'), bytes);
    fs.writeFileSync(path.join(dir, 'red.png.meta'), JSON.stringify({ importer: 'texture', uuid: 'red-texture' }));
    fs.writeFileSync(path.join(dir, 'blue.png'), bytes);
    fs.writeFileSync(path.join(dir, 'blue.png.meta'), JSON.stringify({ importer: 'texture', uuid: 'blue-texture' }));
    const manifest = { contractVersion: '0.1', releaseId: 'red', creatorVersion: '2.4.15',
        delivery: 'built-in-resources', entryAssetId: 'visual', assets: [{ id: 'visual', source: 'assets/resources/red.png',
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'), runtimePath: 'red', dependsOn: [] }] };
    let host; let socket;
    try {
        assert.equal(content.stage({ projectRoot: root, creatorVersion: '2.4.15', manifest }).success, true);
        assert.equal(content.select({ projectRoot: root, creatorVersion: '2.4.15', releaseId: 'red', expectedCurrent: null }).success, true);
        host = await start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'http://127.0.0.1:7456/' });
        const preview = new URL(host.previewUrl);
        socket = new WebSocket(`ws://127.0.0.1:${preview.searchParams.get('cocosAgentPort')}/runtime?token=${preview.searchParams.get('cocosAgentToken')}`,
            { origin: preview.origin });
        const next = () => new Promise((resolve) => socket.once('message', (raw) => resolve(JSON.parse(String(raw)))));
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        socket.send(JSON.stringify({ type: 'hello', creatorVersion: '2.4.15', scene: 'helloworld' }));
        const request = await next();
        assert.equal(request.type, 'apply');
        assert.equal(request.release.releaseId, 'red');
        const receipt = { outcome: 'applied', releaseId: 'red', activeReleaseId: 'red',
            activeFingerprint: request.release.fingerprint, assetId: 'visual', activeAssetId: 'visual',
            resourceUuid: 'red-texture', currentRefCount: 1 };
        socket.send(JSON.stringify({ type: 'receipt', id: request.id, receipt }));
        const ack = await next();
        assert.equal(ack.acceptance.success, true);
        assert.equal(content.get({ projectRoot: root, creatorVersion: '2.4.15' }).effective.releaseId, 'red');
        socket.close();
        await new Promise((resolve) => socket.once('close', resolve));
        await new Promise((resolve) => {
            const poll = setInterval(() => {
                if (host.events.some((event) => event.type === 'disconnected')) { clearInterval(poll); resolve(); }
            }, 10);
        });
        socket = new WebSocket(`ws://127.0.0.1:${preview.searchParams.get('cocosAgentPort')}/runtime?token=${preview.searchParams.get('cocosAgentToken')}`,
            { origin: preview.origin });
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        socket.send(JSON.stringify({ type: 'hello', creatorVersion: '2.4.15', scene: 'helloworld' }));
        const replay = await next();
        assert.equal(replay.release.releaseId, 'red');
        socket.send(JSON.stringify({ type: 'receipt', id: replay.id, receipt: { ...receipt, outcome: 'already-active' } }));
        assert.equal((await next()).acceptance.success, true);
        assert.equal(content.get({ projectRoot: root, creatorVersion: '2.4.15' }).effective.releaseId, 'red');
        const blue = { ...manifest, releaseId: 'blue', assets: [{ ...manifest.assets[0], source: 'assets/resources/blue.png', runtimePath: 'blue' }] };
        assert.equal(content.stage({ projectRoot: root, creatorVersion: '2.4.15', manifest: blue }).success, true);
        assert.equal(content.select({ projectRoot: root, creatorVersion: '2.4.15', releaseId: 'blue', expectedCurrent: 'red' }).success, true);
        const failed = await next();
        assert.equal(failed.release.releaseId, 'blue');
        socket.send(JSON.stringify({ type: 'receipt', id: failed.id, receipt: { outcome: 'failed-preserved', releaseId: 'blue', code: 'LOAD_FAILED' } }));
        assert.equal((await next()).acceptance.success, false);
        assert.equal(content.get({ projectRoot: root, creatorVersion: '2.4.15' }).effective.releaseId, 'red');
    } finally {
        if (socket) socket.close();
        if (host) await host.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
