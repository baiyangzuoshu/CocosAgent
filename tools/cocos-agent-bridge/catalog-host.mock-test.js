'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('./vendor/ws');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-catalog-'));
const projects = ['cocos2', 'cocos3'].map((name) => path.join(temporary, name));
projects.forEach((project) => fs.mkdirSync(project));
const versions = ['2.4.15', '3.8.7'];

function waitForSession(project) {
    const file = path.join(project, 'temp', 'cocos-agent-bridge', 'session.json');
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const poll = () => {
            try { resolve(JSON.parse(fs.readFileSync(file, 'utf8'))); }
            catch (_) { if (Date.now() - started > 3000) reject(new Error(`Session missing: ${project}`)); else setTimeout(poll, 20); }
        };
        poll();
    });
}

async function mockEditor(index, wrongVersion) {
    const project = projects[index];
    const session = await waitForSession(project);
    const instanceId = crypto.randomUUID();
    const socket = new WebSocket(session.url, { headers: { 'x-cocos-agent-token': session.token } });
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.send(JSON.stringify({ type: 'hello', protocolVersion: '0.1', creatorVersion: wrongVersion && index === 0 ? versions[1] : versions[index],
        projectRoot: project, extension: 'cocos-agent-bridge', instanceId }));
    socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'request') return;
        if (message.method === 'capabilities.list') {
            socket.send(JSON.stringify({ type: 'response', id: message.id, ok: true, result: {
                nonce: message.params.nonce, instanceId, creatorVersion: versions[index], projectRoot: project,
                extensionVersion: '0.1.0', commands: [
                    { id: 'scene.snapshot', contractVersion: '0.1', access: 'read', status: 'available' },
                    { id: 'asset.importPng', contractVersion: '0.1', access: 'write', status: 'available' },
                    { id: 'scene.pngSprite', contractVersion: '0.1', access: 'write', status: 'available' },
                ],
            } }));
        } else if (message.method === 'scene.snapshot') {
            socket.send(JSON.stringify(index === 0
                ? { type: 'response', id: message.id, ok: true, result: {
                    nonce: message.params.nonce, creatorVersion: versions[index], projectRoot: project,
                    sceneName: 'helloworld', nodes: [{ name: 'Canvas' }],
                } }
                : { type: 'response', id: message.id, ok: false, error: { code: 'NO_OPEN_SCENE' } }));
        } else {
            throw new Error(`Unexpected write command: ${message.method}`);
        }
    });
    return socket;
}

async function run(query, project, wrongVersion) {
    const args = ['catalog-host.js', '--target', `2.4.15=${projects[0]}`, '--target', `3.8.7=${projects[1]}`, '--query', query];
    if (project) args.push('--project', project);
    const child = spawn(process.execPath, args, { cwd: __dirname });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    const sockets = await Promise.all([mockEditor(0, wrongVersion), mockEditor(1, wrongVersion)]);
    const exit = await new Promise((resolve) => child.on('exit', resolve));
    sockets.forEach((socket) => socket.close());
    assert.strictEqual(stderr, '');
    return { exit, data: JSON.parse(stdout.trim()) };
}

(async () => {
    const list = await run('instances.list');
    assert.strictEqual(list.exit, 0);
    assert.strictEqual(list.data.data.length, 2);
    assert.deepStrictEqual(list.data.data.map((item) => item.activeScene), ['helloworld', null]);
    const catalog = await run('capabilities.list', projects[1]);
    assert.strictEqual(catalog.exit, 0);
    assert.strictEqual(catalog.data.data.instance.projectRoot, projects[1]);
    assert.strictEqual(catalog.data.data.commands.find((item) => item.id === 'scene.pngSprite').status, 'unavailable');
    const missing = await run('instances.get', temporary);
    assert.strictEqual(missing.exit, 1);
    assert.strictEqual(missing.data.error.code, 'EDITOR_NOT_FOUND');
    const mismatch = await run('instances.get', projects[0], true);
    assert.strictEqual(mismatch.exit, 1);
    assert.strictEqual(mismatch.data.error.code, 'INSTANCE_MISMATCH');
    process.stdout.write('catalog host multi-instance and selection checks passed\n');
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; }).finally(() => {
    fs.rmSync(temporary, { recursive: true, force: true });
});
