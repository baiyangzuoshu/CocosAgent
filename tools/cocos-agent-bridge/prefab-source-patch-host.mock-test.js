'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('./vendor/ws');
const store = require('./operation-store');
const inspect = require('./prefab-source-inspect');
const serialized = require('./prefab-serialized-readback');
const patchContract = require('./prefab-source-patch-contract');

const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-agent-prefab-patch-'));
const instanceId = '538268cf-04bc-41c1-89af-20ef61f4d513';
const prefabUuid = '9e1fb81b-6322-4c87-93e2-6b8a5d87a052';
const spriteFrameUuid = 'f67a88ce-5b1b-4e02-8e92-126eb492a2fd';
const prefabPath = path.join(projectRoot, 'assets', 'UI', 'Badge.prefab');
const metaPath = `${prefabPath}.meta`;
const nodePath = 'Panel/Badge';
const nodeUuid = 'node-badge-01';

function createPrefab() {
    fs.mkdirSync(path.dirname(prefabPath), { recursive: true });
    const objects = [
        { __type__: 'cc.Prefab', data: { __id__: 1 } },
        { __type__: 'cc.Node', _name: 'Panel', _id: 'node-panel-01', _parent: null,
            _children: [{ __id__: 2 }], _components: [], _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] } },
        { __type__: 'cc.Node', _name: 'Badge', _id: nodeUuid, _parent: { __id__: 1 },
            _children: [], _components: [{ __id__: 3 }], _active: true,
            _trs: { array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] } },
        { __type__: 'cc.Sprite', node: { __id__: 2 }, _enabled: true, _spriteFrame: { __uuid__: spriteFrameUuid } },
    ];
    fs.writeFileSync(prefabPath, `${JSON.stringify(objects)}\n`);
    fs.writeFileSync(metaPath, `${JSON.stringify({ importer: 'prefab', uuid: prefabUuid })}\n`);
}

function sourceBytes() { return fs.readFileSync(prefabPath); }
function sourceHash() { return crypto.createHash('sha256').update(sourceBytes()).digest('hex'); }
function operationId() { return crypto.randomUUID(); }

function findTarget(objects) {
    const nodes = inspect.inspect(objects);
    assert.ok(nodes, 'serialized Prefab graph remains valid');
    const node = nodes.find((entry) => entry.path === nodePath && entry.uuid === nodeUuid);
    assert.ok(node, 'target path and UUID remain linked');
    return node;
}

function liveSnapshot(objects) {
    const node = findTarget(objects);
    return { ...node, componentDetails: node.components.map((component) => ({ ...component })) };
}

function setSerializedValue(objects, fieldPath, value) {
    const nodeEntry = serialized.resolveNode(objects, nodePath, nodeUuid);
    assert.ok(nodeEntry);
    if (fieldPath === 'node.active') { nodeEntry.object._active = value; return; }
    if (fieldPath === 'node.position.x') { nodeEntry.object._trs.array[0] = value; return; }
    if (fieldPath === 'component.cc.Sprite.enabled') {
        const component = objects[nodeEntry.object._components[0].__id__]; component._enabled = value; return;
    }
    if (fieldPath === 'component.cc.Sprite.spriteFrameUuid') {
        const component = objects[nodeEntry.object._components[0].__id__];
        component._spriteFrame = value === null ? null : { __uuid__: value }; return;
    }
    throw new Error(`Unsupported test field: ${fieldPath}`);
}

async function waitForSession() {
    const filename = path.join(projectRoot, 'temp', 'cocos-agent-bridge', 'session.json');
    for (let index = 0; index < 250; index += 1) {
        try { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
        catch (_) { await new Promise((resolve) => setTimeout(resolve, 20)); }
    }
    throw new Error('Prefab patch bridge session file missing');
}

function runStaleAttempt(expectedHash, diff) {
    return new Promise((resolve, reject) => {
        const staleId = operationId();
        const args = ['prefab-source-patch-host.js', '--project', projectRoot, '--creator-version', '2.4.15',
            '--expected-instance-id', instanceId, '--expected-scene', 'SampleScene', '--prefab-uuid', prefabUuid,
            '--target-node-path', nodePath, '--target-node-uuid', nodeUuid, '--action', 'apply',
            '--expected-prefab-sha256', expectedHash, '--expected-diff', JSON.stringify(diff), '--operation-id', staleId];
        const child = spawn(process.execPath, args, { cwd: __dirname });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.once('error', reject);
        child.once('close', (code) => resolve({ code, stderr, staleId }));
    });
}

async function runPatch({ id, action, diff, sourceOperationId, expectedHash }) {
    const args = ['prefab-source-patch-host.js', '--project', projectRoot, '--creator-version', '2.4.15',
        '--expected-instance-id', instanceId, '--expected-scene', 'SampleScene', '--prefab-uuid', prefabUuid,
        '--target-node-path', nodePath, '--target-node-uuid', nodeUuid, '--action', action,
        '--expected-diff', JSON.stringify(diff), '--operation-id', id];
    if (expectedHash) args.push('--expected-prefab-sha256', expectedHash);
    if (sourceOperationId) args.push('--source-operation-id', sourceOperationId);
    const child = spawn(process.execPath, args, { cwd: __dirname });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    const config = await waitForSession();
    const socket = new WebSocket(config.url, { headers: { 'x-cocos-agent-token': config.token } });
    let protocolError = null;
    socket.on('error', (error) => { protocolError = error; });
    socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'helloAck') {
            if (!message.accepted) protocolError = new Error('Host rejected the mock Creator extension.');
            return;
        }
        if (message.type !== 'request') return;
        const params = message.params || {};
        const response = (result) => socket.send(JSON.stringify({ type: 'response', id: message.id, ok: true, result }));
        const envelope = { nonce: params.nonce, operationId: id, creatorVersion: '2.4.15', projectRoot,
            prefabUuid, targetNodePath: nodePath, targetNodeUuid: nodeUuid, expectedDiff: diff };
        if (message.method === 'bridge.ping') {
            response({ nonce: params.nonce, creatorVersion: '2.4.15', projectRoot });
        } else if (message.method === 'prefab.source.patch.preflight') {
            const objects = JSON.parse(sourceBytes().toString('utf8'));
            response({ ...envelope, sourceSha256: sourceHash(), node: liveSnapshot(objects) });
        } else if (message.method === 'prefab.source.patch.execute') {
            const objects = JSON.parse(sourceBytes().toString('utf8'));
            for (const item of diff) setSerializedValue(objects, item.path, item.after);
            fs.writeFileSync(prefabPath, `${JSON.stringify(objects)}\n`);
            response({ ...envelope, saved: true, reopened: true, beforeSha256: params.expectedPrefabSha256,
                afterSha256: sourceHash(), node: liveSnapshot(objects) });
        } else {
            protocolError = new Error(`Unexpected request: ${message.method}`);
            socket.send(JSON.stringify({ type: 'response', id: message.id, ok: false,
                error: { code: 'UNEXPECTED_REQUEST', message: protocolError.message } }));
        }
    });

    try {
        await new Promise((resolve, reject) => {
            socket.once('open', resolve);
            socket.once('error', reject);
        });
        socket.send(JSON.stringify({ type: 'hello', protocolVersion: '0.1', creatorVersion: '2.4.15', projectRoot,
            extension: 'cocos-agent-bridge', instanceId,
            capabilities: ['prefab.source.patch.preflight', 'prefab.source.patch.execute'] }));
        const code = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Host timed out: stdout=${stdout}; stderr=${stderr}`)), 8000);
            child.once('error', (error) => { clearTimeout(timer); reject(error); });
            child.once('close', (value) => { clearTimeout(timer); resolve(value); });
        });
        assert.equal(code, 0, stderr);
        assert.equal(protocolError, null);
        const line = stdout.split('\n').find((entry) => entry.startsWith('command.result '));
        assert.ok(line, stdout);
        const result = JSON.parse(line.slice('command.result '.length));
        assert.equal(result.operationId, id);
        assert.equal(result.action, action);
        assert.deepEqual(result.expectedDiff, diff);
        assert.equal(result.phases.disk, 'passed');
        assert.equal(result.afterSha256, sourceHash());
        assert.equal(fs.existsSync(path.join(projectRoot, 'temp', 'cocos-agent-bridge', 'session.json')), false);
        return store.read(projectRoot, id);
    } finally {
        socket.close();
        child.kill('SIGTERM');
    }
}

async function main() {
    createPrefab();
    const initialHash = sourceHash();
    const firstDiff = [{ path: 'node.active', before: true, after: false }];
    const firstId = operationId();
    const first = await runPatch({ id: firstId, action: 'apply', diff: firstDiff, expectedHash: initialHash });
    const firstHash = first.afterSha256;
    assert.notEqual(firstHash, initialHash);
    assert.equal(first.phases.disk, 'passed');
    assert.equal(first.phases.recovery, 'pending');

    const stale = await runStaleAttempt(initialHash, [{ path: 'node.position.x', before: 0, after: 16 }]);
    assert.equal(stale.code, 2);
    assert.match(stale.stderr, /PREFAB_SOURCE_STALE/);
    assert.equal(sourceHash(), firstHash, 'stale source hash cannot write or overwrite the latest round');

    const secondDiff = [{ path: 'node.position.x', before: 0, after: 48 }];
    const secondId = operationId();
    const second = await runPatch({ id: secondId, action: 'apply', diff: secondDiff, expectedHash: firstHash });
    const secondHash = second.afterSha256;
    assert.notEqual(secondHash, firstHash);

    const undoSecondId = operationId();
    const undoSecond = await runPatch({ id: undoSecondId, action: 'compensate',
        diff: patchContract.invertDiff(secondDiff), sourceOperationId: secondId });
    assert.equal(undoSecond.phases.recovery, 'passed');
    const replayId = operationId();
    const replay = await runPatch({ id: replayId, action: 'replay', diff: secondDiff, sourceOperationId: undoSecondId });
    const replayHash = replay.afterSha256;
    assert.equal(replay.phases.disk, 'passed');

    const undoReplayId = operationId();
    const undoReplay = await runPatch({ id: undoReplayId, action: 'compensate',
        diff: patchContract.invertDiff(secondDiff), sourceOperationId: replayId });
    const undoFirstId = operationId();
    const undoFirst = await runPatch({ id: undoFirstId, action: 'compensate',
        diff: patchContract.invertDiff(firstDiff), sourceOperationId: firstId });
    assert.equal(undoFirst.phases.recovery, 'passed');

    const objects = JSON.parse(sourceBytes().toString('utf8'));
    const target = serialized.resolveNode(objects, nodePath, nodeUuid);
    assert.ok(target);
    assert.equal(serialized.matchesDiff(objects, target, firstDiff, 'before'), true);
    assert.equal(serialized.matchesDiff(objects, target, secondDiff, 'before'), true);
    assert.equal(objects[1]._children[0].__id__, target.index, 'Prefab parent-child reference remains intact');
    assert.deepEqual(objects[target.index]._components, [{ __id__: 3 }], 'target component reference remains intact');
    assert.equal(objects[3].node.__id__, target.index, 'component reverse reference remains intact');
    assert.equal(objects[3]._spriteFrame.__uuid__, spriteFrameUuid, 'unmodified SpriteFrame UUID remains intact');
    assert.equal(replayHash, secondHash, 'replay restores the same serialized content from its source operation');
    assert.notEqual(sourceHash(), replayHash, 'later compensation returns the source to its prior serialized content');

    process.stdout.write('Prefab Host multiround patch, stale-state rejection, compensation/replay, hierarchy and component-reference checks passed\n');
}

main().catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
}).finally(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
});
