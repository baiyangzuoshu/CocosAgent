'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('./vendor/ws');

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-search-host-'));
const instanceId = '538268cf-04bc-41c1-89af-20ef61f4d513';
const textureUuid = 'be74f85d-2ff1-472e-9d9c-571605318daf';
const spriteFrameUuid = 'bf3ac0aa-a2b4-4806-b5c7-740be92924c3';

async function waitForSession() {
    const file = path.join(projectRoot, 'temp', 'cocos-agent-bridge', 'session.json');
    for (let index = 0; index < 150; index += 1) {
        try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
        catch (_) { await new Promise((resolve) => setTimeout(resolve, 20)); }
    }
    throw new Error('Bridge session file missing');
}

async function main() {
    const child = spawn(process.execPath, ['bridge-host.js', '--project', projectRoot, '--creator-version', '2.4.15',
        '--expected-instance-id', instanceId, '--asset-search-png', 'cocos-agent', '--asset-search-limit', '20', '--asset-search-offset', '0'], { cwd: __dirname });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const config = await waitForSession();
    assert.deepStrictEqual(config.assetSearch, { query: 'cocos-agent', limit: 20, offset: 0, nonce: config.assetSearch.nonce });
    assert.match(config.assetSearch.nonce, /^[a-f0-9]{24}$/);
    const socket = new WebSocket(config.url, { headers: { 'x-cocos-agent-token': config.token } });
    const requests = [];
    let protocolError = null;
    socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'helloAck') {
            assert.strictEqual(message.accepted, true);
            return;
        }
        if (message.type !== 'request') return;
        requests.push(message.method);
        if (message.method === 'bridge.ping') {
            socket.send(JSON.stringify({ type: 'response', id: message.id, ok: true, result: {
                nonce: message.params.nonce, creatorVersion: '2.4.15', projectRoot,
            } }));
        } else if (message.method === 'asset.searchPng') {
            assert.deepStrictEqual(message.params, { nonce: config.assetSearch.nonce, sessionId: config.sessionId,
                query: 'cocos-agent', limit: 20, offset: 0 });
            socket.send(JSON.stringify({ type: 'response', id: message.id, ok: true, result: {
                nonce: message.params.nonce, sessionId: config.sessionId, creatorVersion: '2.4.15', projectRoot,
                query: 'cocos-agent', total: 1, offset: 0, limit: 20, nextOffset: null,
                items: [{ name: 'cocos-agent-smoke.png', url: 'db://assets/resources/cocos-agent-smoke.png', type: 'texture',
                    textureUuid, spriteFrameUuid, width: 2, height: 2, metadataStatus: 'valid' }],
            } }));
        } else protocolError = new Error(`Unexpected request: ${message.method}`);
    });
    socket.on('error', (error) => { protocolError = error; });
    const exit = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => resolve(code));
    });
    try {
        await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
        socket.send(JSON.stringify({ type: 'hello', protocolVersion: '0.1', creatorVersion: '2.4.15', projectRoot,
            extension: 'cocos-agent-bridge', instanceId, capabilities: ['scene.snapshot', 'asset.searchPng'],
            assetSearchContract: { id: 'asset.searchPng', contractVersion: '0.1', creatorVersion: '2.4.15',
                access: 'read', implementation: 'Editor.assetdb.queryAssets', maximumPageSize: 50 },
        }));
        const code = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Host timed out: stdout=${stdout}; stderr=${stderr}; requests=${requests.join(',')}`)), 5000);
            exit.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
        });
        assert.strictEqual(code, 0, stderr);
        assert.strictEqual(protocolError, null);
        assert.deepStrictEqual(requests, ['bridge.ping', 'asset.searchPng'], 'AssetDB search must not require a scene snapshot');
        assert.match(stdout, /command\.result \{"command":"asset\.searchPng"/);
        const resultLine = stdout.split('\n').find((line) => line.startsWith('command.result '));
        const result = JSON.parse(resultLine.slice('command.result '.length)).result;
        assert.strictEqual(result.items[0].spriteFrameUuid, spriteFrameUuid);
        assert.strictEqual(result.items[0].metadataStatus, 'valid');
        assert.strictEqual(fs.existsSync(path.join(projectRoot, 'temp', 'cocos-agent-bridge', 'session.json')), false);
        process.stdout.write('2.4 read-only PNG search bridge request, validation, pagination, and no-scene path passed\n');
    } finally {
        socket.close();
        child.kill('SIGTERM');
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
}

main().catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    fs.rmSync(projectRoot, { recursive: true, force: true });
    process.exitCode = 1;
});
