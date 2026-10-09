'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('./vendor/ws');
const store = require('./operation-store');
const contract = require('./scene-patch-contract');
const serializedReadback = require('./scene-serialized-readback');

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const projectRoot = path.resolve(arg('--project') || '.');
const creatorVersion = arg('--creator-version');
const operationId = arg('--operation-id');
const expectedInstanceId = arg('--expected-instance-id');
const expectedScene = arg('--expected-scene');
const uuidPattern = contract.UUID;
const fail = (message) => { process.stderr.write(`${message}\n`); process.exit(2); };
if (creatorVersion !== '2.4.15' || !fs.existsSync(projectRoot) || !uuidPattern.test(operationId || '')
    || (expectedInstanceId && !uuidPattern.test(expectedInstanceId)) || !/^[A-Za-z0-9_-]{1,64}$/.test(expectedScene || '')) fail('INVALID_RECONCILE_TARGET');
let record;
try { record = store.read(projectRoot, operationId); } catch (_) { fail('OPERATION_NOT_FOUND'); }
if (record.capabilityId !== 'scene.node.patch' || record.projectRoot !== projectRoot || record.creatorVersion !== creatorVersion
    || record.operationId !== operationId || !record.sceneName || record.sceneName !== expectedScene
    || !record.manifest || !contract.NODE_ID.test(record.manifest.targetNodeUuid || '')
    || !contract.validateDiff(record.manifest.expectedDiff) || record.phases.disk === 'passed'
    || !['editor-write-sent', 'disk-recovered'].includes(record.intent)) fail('OPERATION_NOT_RECONCILABLE');

function sceneFile() {
    const matches = [];
    function walk(directory, depth) {
        if (depth > 8) return;
        let entries; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            if (['library', 'temp', 'local', 'build'].includes(entry.name) || entry.isSymbolicLink()) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(filename, depth + 1);
            else if (entry.isFile() && entry.name === `${record.sceneName}.fire`) matches.push(filename);
        }
    }
    walk(path.join(projectRoot, 'assets'), 0);
    return matches.length === 1 ? matches[0] : null;
}
function readDisk(side) {
    const filename = sceneFile(); if (!filename) return null;
    let objects; try { objects = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (_) { return null; }
    if (!Array.isArray(objects)) return null;
    const node = serializedReadback.resolveSerializedNode(objects, record.sceneName, record.manifest.targetNodePath,
        record.manifest.expectedDiff, side);
    return serializedReadback.matchesSerializedDiff(objects, node, record.manifest.expectedDiff, side)
        ? { filename, serializedNodeIndex: node.index, serializedNodeId: node.object._id } : null;
}

const sessionId = crypto.randomUUID(); const token = crypto.randomBytes(32).toString('hex'); const nonce = crypto.randomBytes(12).toString('hex');
const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge'); const sessionPath = path.join(sessionDirectory, 'session.json');
let socket = null; let finished = false; const requests = new Map();
const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
const wss = new WebSocket.Server({ server, path: '/cocos-agent-bridge', maxPayload: 16 * 1024,
    verifyClient: (info, done) => {
        const actual = Buffer.from(typeof info.req.headers['x-cocos-agent-token'] === 'string' ? info.req.headers['x-cocos-agent-token'] : '');
        const expected = Buffer.from(token);
        done(actual.length === expected.length && crypto.timingSafeEqual(actual, expected));
    } });
function finish(code) {
    if (finished) return; finished = true;
    try { if (JSON.parse(fs.readFileSync(sessionPath, 'utf8')).sessionId === sessionId) fs.unlinkSync(sessionPath); } catch (_) { /* gone */ }
    try { fs.rmdirSync(sessionDirectory); } catch (_) { /* another bridge file remains */ }
    if (socket && socket.readyState === WebSocket.OPEN) socket.close(); server.close(); process.exitCode = code;
}
function request(method, params) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID(); const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`${method} timed out`)); }, 15000);
        requests.set(id, (message) => { clearTimeout(timeout); if (!message.ok) reject(new Error(message.error && message.error.code || `${method} failed`)); else resolve(message.result); });
        socket.send(JSON.stringify({ type: 'request', id, method, params }));
    });
}
function setReceipt(phase, evidence) {
    record.phases[phase] = 'passed'; record.receipts.push({ contractVersion: '0.1', operationId,
        capabilityId: record.capabilityId, creatorVersion, phase, status: 'passed', evidence });
}
async function reconcile() {
    const live = await request('scene.node.patch.snapshot', { nonce, sessionId, operationId, nodeUuid: record.manifest.targetNodeUuid });
    if (!live || live.nonce !== nonce || live.creatorVersion !== creatorVersion || path.resolve(live.projectRoot || '') !== projectRoot
        || live.status !== 'found' || live.sceneName !== record.sceneName || live.uuid !== record.manifest.targetNodeUuid) throw new Error('RECONCILE_LIVE_MISMATCH');
    const liveBefore = contract.matchesDiff(live, record.manifest.expectedDiff, 'before');
    const liveAfter = contract.matchesDiff(live, record.manifest.expectedDiff, 'after');
    const diskBefore = readDisk('before'); const diskAfter = readDisk('after');
    const observedAt = new Date().toISOString();
    if (liveBefore && diskBefore) {
        record.reconciliation = { disposition: 'no-effect', observedAt, sceneName: record.sceneName,
            targetNodeUuid: record.manifest.targetNodeUuid, live: 'before', disk: 'before', diskPath: path.relative(projectRoot, diskBefore.filename),
            serializedNodeIndex: diskBefore.serializedNodeIndex, serializedNodeId: diskBefore.serializedNodeId };
        record.intent = 'no-effect'; setReceipt('recovery', [{ kind: 'live-and-disk-no-effect', source: 'Creator 2.4.15 scene snapshot and serialized .fire', observedAt }]);
        record.updatedAt = observedAt; store.write(projectRoot, record);
        process.stdout.write(`reconcile.result ${JSON.stringify({ operationId, disposition: 'no-effect', observedAt })}\n`); finish(0); return;
    }
    if (liveAfter && diskAfter) {
        record.reconciliation = { disposition: 'write-verified', observedAt, sceneName: record.sceneName,
            targetNodeUuid: record.manifest.targetNodeUuid, live: 'after', disk: 'after', diskPath: path.relative(projectRoot, diskAfter.filename),
            serializedNodeIndex: diskAfter.serializedNodeIndex, serializedNodeId: diskAfter.serializedNodeId };
        record.intent = 'disk-verified';
        if (record.phases.capability === 'pending') setReceipt('capability', [{ kind: 'capability-declaration', source: 'Creator extension' }]);
        if (record.phases.preflight === 'pending') setReceipt('preflight', [{ kind: 'expected-diff', source: 'reconciled operation record', diff: record.manifest.expectedDiff }]);
        if (record.phases.editor !== 'passed') setReceipt('editor', [{ kind: 'editor-write-reconciled', source: 'live scene snapshot', targetNodeUuid: record.manifest.targetNodeUuid }]);
        if (record.phases.disk !== 'passed') setReceipt('disk', [{ kind: 'saved-scene-readback', source: path.relative(projectRoot, diskAfter.filename),
            serializedNodeIndex: diskAfter.serializedNodeIndex, serializedNodeId: diskAfter.serializedNodeId, diff: record.manifest.expectedDiff }]);
        setReceipt('recovery', [{ kind: 'live-and-disk-write-confirmed', source: 'Creator 2.4.15 scene snapshot and serialized .fire', observedAt }]);
        record.updatedAt = observedAt; store.write(projectRoot, record);
        process.stdout.write(`reconcile.result ${JSON.stringify({ operationId, disposition: 'write-verified', observedAt })}\n`); finish(0); return;
    }
    throw new Error('RECONCILE_NEEDS_REVIEW');
}
wss.on('connection', (client) => {
    if (socket) { client.close(1008); return; } socket = client;
    client.on('message', (raw) => {
        let message; try { message = JSON.parse(raw.toString()); } catch (_) { finish(1); return; }
        if (message.type === 'hello') {
            const accepted = message.protocolVersion === '0.1' && message.creatorVersion === creatorVersion
                && path.resolve(message.projectRoot || '') === projectRoot && message.extension === 'cocos-agent-bridge'
                && (!expectedInstanceId || message.instanceId === expectedInstanceId)
                && Array.isArray(message.capabilities) && message.capabilities.includes('scene.node.patch.snapshot');
            client.send(JSON.stringify({ type: 'helloAck', accepted, sessionId, protocolVersion: '0.1' }));
            if (!accepted) { finish(1); return; }
            reconcile().catch((error) => { process.stderr.write(`${error.message || error}\n`); finish(1); });
        } else if (message.type === 'response' && requests.has(message.id)) {
            const settle = requests.get(message.id); requests.delete(message.id); settle(message);
        }
    });
});
server.listen(0, '127.0.0.1', () => {
    fs.mkdirSync(sessionDirectory, { recursive: true });
    const session = { protocolVersion: '0.1', sessionId, operationId, creatorVersion, projectRoot,
        url: `ws://127.0.0.1:${server.address().port}/cocos-agent-bridge`, token, expiresAt: Date.now() + 1800000,
        nodePatchOperation: { nonce, ...record.manifest } };
    const temporary = `${sessionPath}.${process.pid}.tmp`; fs.writeFileSync(temporary, JSON.stringify(session), { mode: 0o600 }); fs.renameSync(temporary, sessionPath);
});
server.on('error', (error) => { process.stderr.write(`${error.message}\n`); finish(1); });
wss.on('error', (error) => { process.stderr.write(`${error.message}\n`); finish(1); });
