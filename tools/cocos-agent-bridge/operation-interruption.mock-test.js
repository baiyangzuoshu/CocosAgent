'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const WebSocket = require('./vendor/ws');

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-interruption-'));
const sceneFile = path.join(projectRoot, 'assets', 'Scene', 'recovery.fire');
const assetUuid = crypto.randomUUID();
const nodeName = 'CocosAgentAsset_probe';
fs.mkdirSync(path.dirname(sceneFile), { recursive: true });
fs.mkdirSync(path.join(projectRoot, 'assets', 'resources'), { recursive: true });
fs.writeFileSync(path.join(projectRoot, 'assets', 'resources', 'probe.png.meta'), JSON.stringify({ subMetas: { spriteFrame: { importer: 'sprite-frame', uuid: assetUuid } } }));
fs.writeFileSync(sceneFile, JSON.stringify([{ __type__: 'cc.Node', _name: 'Canvas' }]));

async function session() {
    const file = path.join(projectRoot, 'temp', 'cocos-agent-bridge', 'session.json');
    for (let index = 0; index < 150; index++) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch (_) { await new Promise((resolve) => setTimeout(resolve, 20)); }
    }
    throw new Error('Session file missing');
}

(async () => {
    const child = spawn(process.execPath, ['bridge-host.js', '--project', projectRoot, '--creator-version', '2.4.15',
        '--scene-asset', 'probe.png', '--scene-action', 'apply', '--interrupt-after-editor'], { cwd: __dirname });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const config = await session();
    assert.notStrictEqual(config.operationId, config.sessionId);
    const socket = new WebSocket(config.url, { headers: { 'x-cocos-agent-token': config.token } });
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.send(JSON.stringify({ type: 'hello', protocolVersion: '0.1', creatorVersion: '2.4.15', projectRoot,
        extension: 'cocos-agent-bridge', capabilities: ['scene.snapshot', 'scene.preflightPngSprite', 'scene.placePngSprite', 'scene.removePngSprite'],
        operationContract: { id: 'scene.pngSprite', contractVersion: '0.1', creatorVersion: '2.4.15', access: 'scene-write',
            actions: ['apply', 'compensate', 'replay'], previewVerification: 'manual-web', compensation: 'identity-checked-node-removal' } }));
    socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'request') return;
        const nonce = message.params.nonce;
        const common = { nonce, creatorVersion: '2.4.15', projectRoot };
        let result;
        if (message.method === 'bridge.ping') result = common;
        else if (message.method === 'scene.snapshot') result = Object.assign({}, common, { sceneName: 'recovery', nodes: [{ path: 'recovery', name: 'recovery', active: true, childCount: 1 }], nodeCount: 1, truncated: false });
        else if (message.method === 'scene.preflightPngSprite') {
            assert.strictEqual(message.params.operation.operationId, config.operationId);
            result = Object.assign({}, common, { sceneName: 'recovery', nodeName, decision: 'create', canvasName: 'Canvas' });
        } else if (message.method === 'scene.pngSprite') {
            fs.writeFileSync(sceneFile, JSON.stringify([
                { __type__: 'cc.Node', _name: nodeName, _parent: { __id__: 1 }, _components: [{ __id__: 2 }] },
                { __type__: 'cc.Node', _name: 'Canvas' },
                { __type__: 'cc.Sprite', _spriteFrame: { __uuid__: assetUuid } },
            ]));
            result = Object.assign({}, common, { action: 'apply', assetName: 'probe.png', nodeName, saved: true, nodeUuid: crypto.randomUUID() });
        } else throw new Error(`Unexpected method: ${message.method}`);
        socket.send(JSON.stringify({ type: 'response', id: message.id, ok: true, result }));
    });
    const exit = await new Promise((resolve) => child.once('exit', resolve));
    socket.close();
    assert.strictEqual(exit, 75, stderr);
    assert.match(stdout, /"phase":"editor","status":"passed"/);
    const get = spawnSync(process.execPath, ['bridge-host.js', '--project', projectRoot, '--creator-version', '2.4.15',
        '--operation-get', config.operationId], { cwd: __dirname, encoding: 'utf8' });
    assert.strictEqual(get.status, 0, get.stderr);
    const record = JSON.parse(get.stdout).data;
    assert.strictEqual(record.phases.editor, 'passed');
    assert.strictEqual(record.phases.disk, 'passed');
    assert.strictEqual(record.phases.preview, 'pending');
    assert.strictEqual(record.receipts.filter((receipt) => receipt.phase === 'disk').length, 1);
    process.stdout.write('editor interruption and cross-process disk recovery passed\n');
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
});
