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

test('web runtime accepts an explicitly configured loopback preview origin and rejects non-loopback origins', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-runtime-origin-'));
    let host;
    try {
        host = await start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'http://127.0.0.1:50466/' });
        assert.equal(new URL(host.previewUrl).origin, 'http://127.0.0.1:50466');
        assert.throws(() => start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'http://localhost:50466/' }),
            { message: 'INVALID_PREVIEW_URL' });
        assert.throws(() => start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'https://127.0.0.1:50466/' }),
            { message: 'INVALID_PREVIEW_URL' });
    } finally {
        if (host) await host.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
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
        host = await start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'http://127.0.0.1:50466/' });
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

test('a new runtime Host replays the persisted selected release after the old Host closes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-runtime-restart-'));
    const dir = path.join(root, 'assets/resources');
    fs.mkdirSync(dir, { recursive: true });
    const bytes = fs.readFileSync(path.resolve(__dirname, '../../../2.4.15NewProject/assets/resources/cocos-agent-batch-red.png'));
    fs.writeFileSync(path.join(dir, 'red.png'), bytes);
    fs.writeFileSync(path.join(dir, 'red.png.meta'), JSON.stringify({ importer: 'texture', uuid: 'restart-red-texture' }));
    const manifest = { contractVersion: '0.1', releaseId: 'restart-red', creatorVersion: '2.4.15',
        delivery: 'built-in-resources', entryAssetId: 'visual', assets: [{ id: 'visual', source: 'assets/resources/red.png',
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'), runtimePath: 'red', dependsOn: [] }] };
    let host; let socket;
    const connect = async (previewUrl) => {
        const preview = new URL(previewUrl);
        const clientSocket = new WebSocket(`ws://127.0.0.1:${preview.searchParams.get('cocosAgentPort')}/runtime?token=${preview.searchParams.get('cocosAgentToken')}`,
            { origin: preview.origin });
        const next = () => new Promise((resolve) => clientSocket.once('message', (raw) => resolve(JSON.parse(String(raw)))));
        await new Promise((resolve, reject) => { clientSocket.once('open', resolve); clientSocket.once('error', reject); });
        clientSocket.send(JSON.stringify({ type: 'hello', creatorVersion: '2.4.15', scene: 'helloworld' }));
        return { socket: clientSocket, next };
    };
    try {
        assert.equal(content.stage({ projectRoot: root, creatorVersion: '2.4.15', manifest }).success, true);
        assert.equal(content.select({ projectRoot: root, creatorVersion: '2.4.15', releaseId: 'restart-red', expectedCurrent: null }).success, true);
        host = await start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'http://127.0.0.1:50469/' });
        let client = await connect(host.previewUrl);
        socket = client.socket;
        let request = await client.next();
        assert.equal(request.type, 'apply');
        assert.equal(request.release.releaseId, 'restart-red');
        socket.send(JSON.stringify({ type: 'receipt', id: request.id, receipt: { outcome: 'applied', releaseId: 'restart-red',
            activeReleaseId: 'restart-red', activeFingerprint: request.release.fingerprint, assetId: 'visual',
            activeAssetId: 'visual', resourceUuid: 'restart-red-texture', currentRefCount: 1 } }));
        assert.equal((await client.next()).acceptance.success, true);
        assert.equal(content.get({ projectRoot: root, creatorVersion: '2.4.15' }).effective.releaseId, 'restart-red');
        socket.close();
        await new Promise((resolve) => socket.once('close', resolve));
        socket = null;
        await host.close();
        host = null;

        host = await start({ projectRoot: root, creatorVersion: '2.4.15', previewUrl: 'http://127.0.0.1:50470/' });
        client = await connect(host.previewUrl);
        socket = client.socket;
        request = await client.next();
        assert.equal(request.type, 'apply');
        assert.equal(request.id, 1);
        assert.equal(request.release.releaseId, 'restart-red');
        socket.send(JSON.stringify({ type: 'receipt', id: request.id, receipt: { outcome: 'applied', releaseId: 'restart-red',
            activeReleaseId: 'restart-red', activeFingerprint: request.release.fingerprint, assetId: 'visual',
            activeAssetId: 'visual', resourceUuid: 'restart-red-texture', currentRefCount: 1 } }));
        assert.equal((await client.next()).acceptance.success, true);
        assert.equal(content.get({ projectRoot: root, creatorVersion: '2.4.15' }).effective.releaseId, 'restart-red');
    } finally {
        if (socket) socket.close();
        if (host) await host.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('Mac native runtime uses a private writable-path session and loopback Origin handshake', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-runtime-native-'));
    const writable = path.join(root, 'native-writable');
    const dir = path.join(root, 'project/assets/resources');
    fs.mkdirSync(dir, { recursive: true });
    const bytes = fs.readFileSync(path.resolve(__dirname, '../../../2.4.15NewProject/assets/resources/cocos-agent-batch-red.png'));
    fs.writeFileSync(path.join(dir, 'red.png'), bytes);
    fs.writeFileSync(path.join(dir, 'red.png.meta'), JSON.stringify({ importer: 'texture', uuid: 'red-texture' }));
    const manifest = { contractVersion: '0.1', releaseId: 'native-red', creatorVersion: '2.4.15',
        delivery: 'built-in-resources', entryAssetId: 'visual', assets: [{ id: 'visual', source: 'assets/resources/red.png',
            sha256: crypto.createHash('sha256').update(bytes).digest('hex'), runtimePath: 'red', dependsOn: [] }] };
    let host; let socket;
    try {
        assert.equal(content.stage({ projectRoot: path.join(root, 'project'), creatorVersion: '2.4.15', manifest }).success, true);
        assert.equal(content.select({ projectRoot: path.join(root, 'project'), creatorVersion: '2.4.15',
            releaseId: 'native-red', expectedCurrent: null }).success, true);
        host = await start({ projectRoot: path.join(root, 'project'), creatorVersion: '2.4.15',
            platform: 'mac-native', nativeWritablePath: writable });
        const session = JSON.parse(fs.readFileSync(host.sessionPath, 'utf8'));
        assert.equal(session.platform, 'mac-native');
        assert.equal(session.host, '127.0.0.1');
        assert.equal((fs.statSync(host.sessionPath).mode & 0o777), 0o600);
        assert.equal((fs.statSync(path.dirname(host.sessionPath)).mode & 0o777), 0o700);
        socket = new WebSocket(`ws://127.0.0.1:${session.port}/runtime?token=${session.token}`,
            { origin: 'http://127.0.0.1:49152' });
        const next = () => new Promise((resolve) => socket.once('message', (raw) => resolve(JSON.parse(String(raw)))));
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        socket.send(JSON.stringify({ type: 'hello', platform: 'mac-native', sessionId: session.sessionId,
            creatorVersion: '2.4.15', scene: 'helloworld' }));
        const request = await next();
        assert.equal(request.type, 'apply');
        assert.equal(fs.existsSync(host.sessionPath), false);
        const receipt = { outcome: 'applied', releaseId: 'native-red', activeReleaseId: 'native-red',
            activeFingerprint: request.release.fingerprint, assetId: 'visual', activeAssetId: 'visual',
            resourceUuid: 'red-texture', currentRefCount: 1 };
        socket.send(JSON.stringify({ type: 'receipt', id: request.id, receipt }));
        assert.equal((await next()).acceptance.success, true);
        assert.equal(content.acceptRuntime({ projectRoot: path.join(root, 'project'), creatorVersion: '2.4.15',
            platform: 'mac-native', receipt }).success, false);
        assert.equal(content.get({ projectRoot: path.join(root, 'project'), creatorVersion: '2.4.15' })
            .effective.platform, 'mac-native');
    } finally {
        if (socket) socket.close();
        if (host) await host.close();
        fs.rmSync(root, { recursive: true, force: true });
    }
});
