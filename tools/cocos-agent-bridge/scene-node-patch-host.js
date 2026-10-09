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
const fail = (message) => { process.stderr.write(`${message}\n`); process.exit(2); };
const projectRoot = path.resolve(arg('--project') || '.');
const creatorVersion = arg('--creator-version');
const operationGetId = arg('--operation-get');
const operationId = arg('--operation-id') || crypto.randomUUID();
const expectedInstanceId = arg('--expected-instance-id');
const expectedScene = arg('--expected-scene');
const action = arg('--action');
const targetNodePath = arg('--target-node-path');
const targetNodeUuid = arg('--target-node-uuid');
const sourceOperationId = arg('--source-operation-id');
let expectedDiff = null;
if (arg('--expected-diff') !== undefined) {
    try { expectedDiff = JSON.parse(arg('--expected-diff')); } catch (_) { fail('INVALID_EXPECTED_DIFF_JSON'); }
}
const UUID = contract.UUID;
if (!fs.existsSync(projectRoot) || creatorVersion !== '2.4.15') fail('UNSUPPORTED_TARGET');
if (operationGetId) {
    if (arg('--action') || arg('--target-node-path') || arg('--target-node-uuid') || arg('--source-operation-id') || arg('--expected-diff') !== undefined) fail('READ_ONLY_OPERATION_GET');
    let record;
    try { record = store.read(projectRoot, operationGetId); } catch (_) { fail('OPERATION_NOT_FOUND'); }
    if (record.capabilityId !== 'scene.node.patch' || record.projectRoot !== projectRoot || record.creatorVersion !== creatorVersion) fail('OPERATION_TARGET_MISMATCH');
    process.stdout.write(`${JSON.stringify({ success: true, data: record })}\n`);
    process.exit(0);
}
if (!UUID.test(operationId) || (expectedInstanceId && !UUID.test(expectedInstanceId))
    || !['apply', 'compensate', 'replay'].includes(action) || typeof targetNodePath !== 'string'
    || targetNodePath.length > 240 || targetNodePath.includes('\\') || targetNodePath.includes('//')
    || !contract.NODE_ID.test(targetNodeUuid || '') || !contract.validateDiff(expectedDiff)
    || (action === 'apply' ? !!sourceOperationId : !UUID.test(sourceOperationId || ''))) fail('INVALID_NODE_PATCH_INPUT');
if (action === 'apply' && contract.targetPathAt(targetNodePath, expectedDiff, 'before') !== targetNodePath) fail('TARGET_PATH_NAME_MISMATCH');

let source = null;
if (sourceOperationId) {
    try { source = store.read(projectRoot, sourceOperationId); } catch (_) { fail('SOURCE_OPERATION_NOT_FOUND'); }
    if (source.capabilityId !== 'scene.node.patch' || source.projectRoot !== projectRoot || source.creatorVersion !== creatorVersion
        || source.phases.disk !== 'passed' || source.manifest.targetNodeUuid !== targetNodeUuid
        || source.manifest.targetNodePath !== targetNodePath || source.operationId === operationId
        || (action === 'compensate' && !['apply', 'replay'].includes(source.manifest.action))
        || (action === 'replay' && source.manifest.action !== 'compensate')) fail('SOURCE_OPERATION_MISMATCH');
    const expectedFromSource = action === 'compensate'
        ? contract.invertDiff(source.manifest.expectedDiff)
        : contract.invertDiff(source.manifest.expectedDiff);
    if (JSON.stringify(expectedFromSource) !== JSON.stringify(expectedDiff)) fail('SOURCE_DIFF_MISMATCH');
    if (source.sceneName !== expectedScene && expectedScene) fail('SOURCE_SCENE_MISMATCH');
}

function sceneFilename(sceneName) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sceneName || '')) return null;
    const matches = [];
    function walk(directory, depth) {
        if (depth > 8) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            if (['library', 'temp', 'local', 'build'].includes(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) walk(filename, depth + 1);
            else if (entry.isFile() && entry.name === `${sceneName}.fire`) matches.push(filename);
        }
    }
    walk(path.join(projectRoot, 'assets'), 0);
    return matches.length === 1 ? matches[0] : null;
}
function diskState(record, expectedSide) {
    const filename = sceneFilename(record.sceneName);
    if (!filename) return null;
    let objects;
    try { objects = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (_) { return null; }
    if (!Array.isArray(objects)) return null;
    const node = serializedReadback.resolveSerializedNode(objects, record.sceneName, record.manifest.targetNodePath,
        record.manifest.expectedDiff, expectedSide);
    return serializedReadback.matchesSerializedDiff(objects, node, record.manifest.expectedDiff, expectedSide)
        ? { filename, serializedNodeIndex: node.index, serializedNodeId: node.object._id } : null;
}

const sessionId = crypto.randomUUID();
const token = crypto.randomBytes(32).toString('hex');
const nonce = crypto.randomBytes(12).toString('hex');
const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge');
const sessionPath = path.join(sessionDirectory, 'session.json');
const record = { contractVersion: '0.1', capabilityId: 'scene.node.patch', operationId, projectRoot, creatorVersion,
    manifest: { targetNodePath, targetNodeUuid, action, sourceOperationId: sourceOperationId || null, expectedDiff },
    sceneName: null, intent: 'created', receipts: [],
    phases: { capability: 'pending', preflight: 'pending', editor: 'pending', disk: 'pending', preview: 'pending', recovery: 'pending' },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
try { store.write(projectRoot, record, true); } catch (error) { fail(error.code === 'EEXIST' ? 'OPERATION_ALREADY_EXISTS' : error.message); }

let socket = null;
let closed = false;
const requests = new Map();
const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
const wss = new WebSocket.Server({ server, path: '/cocos-agent-bridge', maxPayload: 16 * 1024,
    verifyClient: (info, done) => {
        const candidate = Buffer.from(typeof info.req.headers['x-cocos-agent-token'] === 'string' ? info.req.headers['x-cocos-agent-token'] : '');
        const expected = Buffer.from(token);
        done(candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected));
    } });
function finish(code) {
    if (closed) return; closed = true;
    try { if (JSON.parse(fs.readFileSync(sessionPath, 'utf8')).sessionId === sessionId) fs.unlinkSync(sessionPath); } catch (_) { /* Session already gone. */ }
    try { fs.rmdirSync(sessionDirectory); } catch (_) { /* Preserve other bridge files. */ }
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    server.close(); process.exitCode = code;
}
function receipt(phase, status, evidence = [], error) {
    record.phases[phase] = status;
    record.receipts.push({ contractVersion: '0.1', operationId, capabilityId: record.capabilityId, creatorVersion,
        phase, status, evidence, ...(error ? { error } : {}) });
    record.updatedAt = new Date().toISOString(); store.write(projectRoot, record);
}
function request(method, params) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`${method} timed out`)); }, method === 'scene.node.patch' ? 30000 : 15000);
        requests.set(id, (message) => {
            clearTimeout(timeout);
            if (!message.ok) { const error = new Error(message.error && message.error.message || `${method} failed`); error.code = message.error && message.error.code; reject(error); }
            else resolve(message.result);
        });
        socket.send(JSON.stringify({ type: 'request', id, method, params }));
    });
}
function envelope(value) {
    return value && value.nonce === nonce && value.creatorVersion === creatorVersion
        && path.resolve(value.projectRoot || '') === projectRoot;
}
async function run() {
    const ping = await request('bridge.ping', { nonce });
    if (!envelope(ping)) throw new Error('PING_MISMATCH');
    const beforeSnapshot = await request('scene.snapshot', { nonce,
        targetNodePath: contract.targetPathAt(targetNodePath, expectedDiff, 'before') });
    if (!envelope(beforeSnapshot) || !beforeSnapshot.targetNode || beforeSnapshot.targetNode.status !== 'found'
        || beforeSnapshot.targetNode.uuid !== targetNodeUuid || !contract.matchesDiff(beforeSnapshot.targetNode, expectedDiff, 'before')
        || (expectedScene && beforeSnapshot.sceneName !== expectedScene)) throw new Error('EXPECTED_STATE_MISMATCH');
    record.sceneName = beforeSnapshot.sceneName;
    if (source && source.sceneName !== record.sceneName) throw new Error('SOURCE_SCENE_MISMATCH');
    store.write(projectRoot, record);
    const sessionParams = { nonce, sessionId, operationId, ...record.manifest };
    const preflight = await request('scene.node.patch.preflight', sessionParams);
    if (!envelope(preflight) || preflight.sceneName !== record.sceneName || !preflight.node
        || preflight.node.uuid !== targetNodeUuid || !contract.matchesDiff(preflight.node, expectedDiff, 'before')) throw new Error('EDITOR_PREFLIGHT_MISMATCH');
    receipt('capability', 'passed', [{ kind: 'capability-declaration', source: 'Creator 2.4.15 extension' }]);
    receipt('preflight', 'passed', [{ kind: 'expected-diff', source: 'Creator scene snapshot', targetNodePath, targetNodeUuid,
        diff: expectedDiff }]);
    record.intent = 'editor-write-sent'; store.write(projectRoot, record);
    const changed = await request('scene.node.patch', sessionParams);
    if (!envelope(changed) || changed.operationId !== operationId || changed.saved !== true || !changed.node
        || changed.node.uuid !== targetNodeUuid || !contract.matchesDiff(changed.node, expectedDiff, 'after')) throw new Error('EDITOR_RESULT_MISMATCH');
    receipt('editor', 'passed', [{ kind: 'editor-write', source: 'Creator scene script', targetNodeUuid, changedFields: expectedDiff.map((item) => item.path) }]);
    const live = await request('scene.node.patch.snapshot', { nonce, sessionId, operationId, nodeUuid: targetNodeUuid });
    if (!envelope(live) || live.status !== 'found' || live.uuid !== targetNodeUuid || !contract.matchesDiff(live, expectedDiff, 'after')) throw new Error('LIVE_READBACK_MISMATCH');
    const disk = diskState(record, 'after');
    if (!disk) throw new Error('DISK_READBACK_MISMATCH');
    receipt('disk', 'passed', [{ kind: 'saved-scene-readback', source: path.relative(projectRoot, disk.filename),
        sceneName: record.sceneName, targetNodeUuid, serializedNodeIndex: disk.serializedNodeIndex,
        serializedNodeId: disk.serializedNodeId, expectedDiff }]);
    record.intent = 'disk-verified';
    record.phases.preview = action === 'compensate' ? 'skipped' : 'pending';
    if (action === 'compensate') receipt('recovery', 'passed', [{ kind: 'compensation-readback', source: 'Creator scene and serialized .fire', targetNodeUuid }]);
    else record.phases.recovery = 'pending';
    store.write(projectRoot, record);
    if (action !== 'compensate') {
        try {
            const started = await request('scene.preview.start', { nonce, sessionId });
            if (!envelope(started) || started.started !== true) throw new Error('PREVIEW_START_MISMATCH');
            const observed = await require('./preview-runtime').verify({ creatorVersion, projectRoot, sceneName: record.sceneName,
                nodePath: contract.targetPathAt(targetNodePath, expectedDiff, 'after'), nodeUuid: targetNodeUuid, expectedDiff });
            const accepted = require('./operation-preview').acceptRuntimePreview({ projectRoot, creatorVersion, operationId, ...observed });
            if (!accepted.success) throw new Error(accepted.error.code);
            Object.assign(record, accepted.data);
        } catch (error) {
            record.previewAttempt = { status: 'failed', attemptedAt: new Date().toISOString(),
                error: { code: error.code || error.message, message: String(error.message || error).slice(0, 500) } };
            store.write(projectRoot, record);
        }
    }
    process.stdout.write(`command.result ${JSON.stringify({ command: 'scene.node.patch', operationId, sceneName: record.sceneName,
        action, targetNodeUuid, expectedDiff, phases: record.phases })}\n`);
    finish(0);
}

server.on('error', (error) => { process.stderr.write(`${error.message}\n`); finish(1); });
wss.on('connection', (client) => {
    if (socket) { client.close(1008); return; }
    socket = client;
    client.on('message', (raw) => {
        let message; try { message = JSON.parse(raw.toString()); } catch (_) { finish(1); return; }
        if (message.type === 'hello') {
            const accepted = message.protocolVersion === '0.1' && message.creatorVersion === creatorVersion
                && path.resolve(message.projectRoot || '') === projectRoot && message.extension === 'cocos-agent-bridge'
                && (!expectedInstanceId || message.instanceId === expectedInstanceId)
                && Array.isArray(message.capabilities) && message.capabilities.includes('scene.node.patch.preflight')
                && message.capabilities.includes('scene.node.patch');
            client.send(JSON.stringify({ type: 'helloAck', accepted, sessionId, protocolVersion: '0.1' }));
            if (!accepted) { finish(1); return; }
            run().catch((error) => {
                const phase = record.phases.preflight === 'pending' ? 'preflight' : record.phases.editor === 'pending' ? 'editor' : 'disk';
                receipt(phase, 'failed', [], { code: error.code || error.message || 'NODE_PATCH_FAILED',
                    phase, message: String(error.message || error), retryable: false,
                    sideEffect: record.intent === 'editor-write-sent' ? 'possible' : 'none' });
                process.stderr.write(`${error.code || error.message || error}\n`); finish(1);
            });
        } else if (message.type === 'response' && requests.has(message.id)) {
            const settle = requests.get(message.id); requests.delete(message.id); settle(message);
        }
    });
    client.on('error', (error) => { process.stderr.write(`${error.message}\n`); finish(1); });
});
server.listen(0, '127.0.0.1', () => {
    fs.mkdirSync(sessionDirectory, { recursive: true });
    const session = { protocolVersion: '0.1', sessionId, operationId, creatorVersion, projectRoot,
        url: `ws://127.0.0.1:${server.address().port}/cocos-agent-bridge`, token,
        expiresAt: Date.now() + 1800000, nodePatchOperation: { nonce, ...record.manifest } };
    const temporary = `${sessionPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(session), { mode: 0o600 }); fs.renameSync(temporary, sessionPath);
    process.stdout.write(`Bridge ready for Creator 2.4.15 node patch; operationId=${operationId}\n`);
});
process.on('SIGINT', () => finish(130));
process.on('SIGTERM', () => finish(143));
