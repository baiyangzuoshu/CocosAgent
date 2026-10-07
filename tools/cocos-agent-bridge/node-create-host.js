'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('./vendor/ws');
const store = require('./operation-store');

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const fail = (message) => { process.stderr.write(`${message}\n`); process.exit(2); };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectRoot = path.resolve(arg('--project') || '.');
const creatorVersion = arg('--creator-version');
const operationGetId = arg('--operation-get');
const operationId = arg('--operation-id') || crypto.randomUUID();
const expectedInstanceId = arg('--expected-instance-id');
const expectedScene = arg('--expected-scene');
const action = arg('--action');
const parentPath = arg('--parent-path');
const parentUuid = arg('--parent-uuid');
const nodeName = arg('--node-name');
const sourceOperationId = arg('--source-operation-id');
const interruptAfterEditor = process.argv.includes('--interrupt-after-editor');
if (!['2.4.15', '3.8.7'].includes(creatorVersion) || !fs.existsSync(projectRoot)) fail('INVALID_TARGET');
if (!uuidPattern.test(operationGetId || operationId) || (expectedInstanceId && !uuidPattern.test(expectedInstanceId))) fail('INVALID_OPERATION_ID');

function scenePath(sceneName) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sceneName || '')) return null;
    const matches = [];
    function walk(directory, depth) {
        if (depth > 8) return;
        let entries;
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { return; }
        for (const entry of entries) {
            if (['library', 'temp', 'local', 'build'].includes(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(filename, depth + 1);
            else if (entry.isFile() && entry.name === `${sceneName}.${creatorVersion === '2.4.15' ? 'fire' : 'scene'}`) matches.push(filename);
        }
    }
    walk(path.join(projectRoot, 'assets'), 0);
    return matches.length === 1 ? matches[0] : null;
}
function diskState(record) {
    const filename = scenePath(record.sceneName);
    if (!filename) return null;
    let objects;
    try { objects = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (_) { return null; }
    if (!Array.isArray(objects)) return null;
    const { parentUuid: parentId, nodeName: name, action: sceneAction } = record.manifest;
    const parent = objects.find((item) => item && ['cc.Node', 'cc.Scene'].includes(item.__type__) && item._id === parentId);
    if (!parent) return null;
    const matches = objects.filter((item) => item && item.__type__ === 'cc.Node' && item._name === name
        && item._parent && Number.isInteger(item._parent.__id__)
        && objects[item._parent.__id__] && objects[item._parent.__id__]._id === parentId);
    if (sceneAction === 'compensate') return matches.length === 0
        && !objects.some((item) => item && item.__type__ === 'cc.Node' && item._id === record.manifest.targetNodeUuid)
        ? { filename, nodeUuid: record.manifest.targetNodeUuid } : null;
    if (matches.length !== 1 || !record.createdNodeUuid || matches[0]._id !== record.createdNodeUuid
        || (matches[0]._components || []).length !== 0) return null;
    return { filename, nodeUuid: matches[0]._id };
}
function receipt(record, phase, status, evidence = [], error) {
    record.phases[phase] = status;
    const item = { contractVersion: '0.1', operationId: record.operationId, capabilityId: 'scene.node.create',
        creatorVersion, phase, status, evidence };
    if (error) item.error = error;
    record.receipts.push(item);
    record.updatedAt = new Date().toISOString();
    store.write(projectRoot, record);
}
if (operationGetId) {
    if (action || parentPath || parentUuid || nodeName || sourceOperationId) fail('READ_ONLY_OPERATION_GET');
    let record;
    try { record = store.read(projectRoot, operationGetId); } catch (_) { fail('OPERATION_NOT_FOUND'); }
    if (record.projectRoot !== projectRoot || record.creatorVersion !== creatorVersion || record.capabilityId !== 'scene.node.create') fail('OPERATION_TARGET_MISMATCH');
    if (record.intent === 'editor-write-sent' && (record.createdNodeUuid || record.manifest.action === 'compensate') && record.phases.disk !== 'passed') {
        const observed = diskState(record);
        if (observed) { receipt(record, 'disk', 'passed', [{ kind: 'disk-readback', source: 'operation.get', sceneName: record.sceneName, nodeUuid: observed.nodeUuid }]); record.intent = 'disk-recovered'; record.phases.preview = 'skipped'; if (record.manifest.action === 'compensate') record.phases.recovery = 'passed'; store.write(projectRoot, record); }
    }
    if (record.phases.disk === 'passed' && record.phases.preview === 'pending') { record.phases.preview = 'skipped'; store.write(projectRoot, record); }
    process.stdout.write(`${JSON.stringify({ success: true, data: record })}\n`);
    process.exit(0);
}
if (!uuidPattern.test(operationId) || !['apply', 'compensate', 'replay'].includes(action)
    || typeof parentPath !== 'string' || parentPath.length > 240 || parentPath.includes('//') || parentPath.includes('\\')
    || typeof parentUuid !== 'string' || parentUuid.length < 1 || parentUuid.length > 64
    || !/^[A-Za-z0-9_ -]{1,64}$/.test(nodeName || '')
    || (action === 'apply' ? !!sourceOperationId : !uuidPattern.test(sourceOperationId || ''))) fail('INVALID_NODE_CREATE_INPUT');
let source = null;
if (sourceOperationId) {
    try { source = store.read(projectRoot, sourceOperationId); } catch (_) { fail('SOURCE_OPERATION_NOT_FOUND'); }
    if (source.capabilityId !== 'scene.node.create' || source.projectRoot !== projectRoot || source.creatorVersion !== creatorVersion
        || source.phases.disk !== 'passed' || source.manifest.parentPath !== parentPath || source.manifest.parentUuid !== parentUuid
        || source.manifest.nodeName !== nodeName || sourceOperationId === operationId
        || (action === 'compensate' && (!['apply', 'replay'].includes(source.manifest.action) || !source.createdNodeUuid))
        || (action === 'replay' && source.manifest.action !== 'compensate')) fail('SOURCE_OPERATION_MISMATCH');
}
const manifest = { parentPath, parentUuid, nodeName, action, sourceOperationId: sourceOperationId || null,
    targetNodeUuid: action === 'compensate' ? source.createdNodeUuid : null };
const record = { contractVersion: '0.1', capabilityId: 'scene.node.create', operationId, projectRoot, creatorVersion,
    manifest, sceneName: null, createdNodeUuid: null, intent: 'created', receipts: [],
    phases: { capability: 'pending', preflight: 'pending', editor: 'pending', disk: 'pending', preview: 'pending', recovery: 'pending' },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
try { store.write(projectRoot, record, true); } catch (error) { fail(error.code === 'EEXIST' ? 'OPERATION_ALREADY_EXISTS' : error.message); }

const sessionId = crypto.randomUUID();
const token = crypto.randomBytes(32).toString('hex');
const nonce = crypto.randomBytes(12).toString('hex');
const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge');
const sessionPath = path.join(sessionDirectory, 'session.json');
const requests = new Map();
let socket = null;
let closed = false;
let timer = null;
const server = http.createServer((_, response) => { response.writeHead(404); response.end(); });
const wss = new WebSocket.Server({ server, path: '/cocos-agent-bridge', maxPayload: 16 * 1024,
    verifyClient: (info, done) => {
        const candidate = info.req.headers['x-cocos-agent-token'];
        const a = Buffer.from(typeof candidate === 'string' ? candidate : '');
        const b = Buffer.from(token);
        done(a.length === b.length && crypto.timingSafeEqual(a, b));
    } });
function close(code) {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    try { if (JSON.parse(fs.readFileSync(sessionPath)).sessionId === sessionId) fs.unlinkSync(sessionPath); } catch (_) { /* gone */ }
    try { fs.rmdirSync(sessionDirectory); } catch (_) { /* other sessions */ }
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
    server.close();
    process.exitCode = code;
}
function request(method, params) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => { requests.delete(id); reject(new Error(`${method} timed out`)); }, method === 'scene.node.create' ? 30000 : 15000);
        requests.set(id, (message) => { clearTimeout(timeout); if (!message.ok) { const error = new Error(message.error && message.error.message || `${method} failed`); error.code = message.error && message.error.code; reject(error); } else resolve(message.result); });
        socket.send(JSON.stringify({ type: 'request', id, method, params }));
    });
}
async function run() {
    const ping = await request('bridge.ping', { nonce });
    if (!ping || ping.nonce !== nonce || ping.creatorVersion !== creatorVersion || path.resolve(ping.projectRoot || '') !== projectRoot) throw new Error('PING_MISMATCH');
    const before = await request('scene.snapshot', { nonce, targetNodePath: parentPath });
    if (!before || before.nonce !== nonce || before.creatorVersion !== creatorVersion || (expectedScene && before.sceneName !== expectedScene)
        || !before.targetNode || before.targetNode.status !== 'found' || before.targetNode.uuid !== parentUuid) throw new Error('PARENT_CHANGED');
    record.sceneName = before.sceneName;
    store.write(projectRoot, record);
    if (source && source.sceneName !== record.sceneName) throw new Error('SOURCE_SCENE_MISMATCH');
    const params = { nonce, sessionId, operationId, ...manifest };
    const checked = await request('scene.node.create.preflight', params);
    if (!checked || checked.nonce !== nonce || checked.sceneName !== record.sceneName || checked.parentUuid !== parentUuid
        || checked.parentPath !== parentPath || checked.nodeName !== nodeName
        || checked.decision !== (action === 'compensate' ? (checked.targetNodeUuid ? 'remove' : 'alreadyAbsent') : 'create')) throw new Error('PREFLIGHT_MISMATCH');
    receipt(record, 'preflight', 'passed', [{ kind: 'scene-snapshot', source: 'Creator scene script', sceneName: record.sceneName, nodeName, parentUuid, note: checked.decision }]);
    record.intent = 'editor-write-sent'; store.write(projectRoot, record);
    const changed = await request('scene.node.create', params);
    if (!changed || changed.nonce !== nonce || changed.operationId !== operationId || changed.saved !== true
        || changed.parentUuid !== parentUuid || changed.nodeName !== nodeName || typeof changed.nodeUuid !== 'string'
        || (action === 'compensate' && changed.nodeUuid !== manifest.targetNodeUuid)) throw new Error('EDITOR_RESULT_MISMATCH');
    if (action !== 'compensate') record.createdNodeUuid = changed.nodeUuid;
    receipt(record, 'editor', 'passed', [{ kind: 'editor-result', source: 'Creator scene script', sceneName: record.sceneName, nodeName, nodeUuid: changed.nodeUuid }]);
    if (interruptAfterEditor) { process.stderr.write('Interrupted after editor receipt.\n'); close(75); return; }
    let disk = null;
    for (let i = 0; i < 30 && !disk; i++) { disk = diskState(record); if (!disk) await new Promise((resolve) => setTimeout(resolve, 100)); }
    if (!disk) throw new Error('DISK_READBACK_MISMATCH');
    const after = await request('scene.snapshot', { nonce, targetNodePath: `${parentPath}/${nodeName}` });
    if (!after || after.nonce !== nonce || !after.targetNode
        || (action === 'compensate' ? after.targetNode.status !== 'not-found' : after.targetNode.status !== 'found' || after.targetNode.uuid !== record.createdNodeUuid)) throw new Error('POST_WRITE_SNAPSHOT_MISMATCH');
    receipt(record, 'disk', 'passed', [{ kind: 'disk-readback', source: disk.filename, sceneName: record.sceneName, nodeName, nodeUuid: disk.nodeUuid, parentUuid }]);
    record.intent = 'disk-verified';
    record.phases.preview = 'skipped';
    record.phases.recovery = action === 'compensate' ? 'passed' : 'pending';
    store.write(projectRoot, record);
    process.stdout.write(`command.result ${JSON.stringify({ command: 'scene.node.create', operationId, sceneName: record.sceneName, action, nodeName, nodeUuid: disk.nodeUuid })}\n`);
    close(0);
}
server.on('error', (error) => { process.stderr.write(`${error.message}\n`); close(1); });
wss.on('connection', (client) => {
    if (socket) { client.close(1008); return; }
    socket = client;
    client.on('message', (raw) => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) { close(1); return; }
        if (message.type === 'hello') {
            const ok = message.protocolVersion === '0.1' && message.creatorVersion === creatorVersion
                && path.resolve(message.projectRoot || '') === projectRoot && message.extension === 'cocos-agent-bridge'
                && (!expectedInstanceId || message.instanceId === expectedInstanceId)
                && Array.isArray(message.capabilities) && message.capabilities.includes('scene.node.create.preflight')
                && message.capabilities.includes('scene.node.create');
            client.send(JSON.stringify({ type: 'helloAck', accepted: ok, sessionId, protocolVersion: '0.1' }));
            if (!ok) { close(1); return; }
            clearTimeout(timer);
            receipt(record, 'capability', 'passed', [{ kind: 'capability-declaration', source: 'Creator extension hello' }]);
            run().catch((error) => {
                const phase = record.phases.preflight === 'pending' ? 'preflight' : record.phases.editor === 'pending' ? 'editor' : 'disk';
                receipt(record, phase, 'failed', [], { code: error.code || error.message || 'NODE_OPERATION_FAILED', phase,
                    message: String(error.message || error), retryable: false, sideEffect: record.intent === 'editor-write-sent' ? 'possible' : 'none' });
                process.stderr.write(`${error.code || error.message || error}\n`); close(1);
            });
        } else if (message.type === 'response' && requests.has(message.id)) { const settle = requests.get(message.id); requests.delete(message.id); settle(message); }
    });
    client.on('error', (error) => { process.stderr.write(`${error.message}\n`); close(1); });
});
server.listen(0, '127.0.0.1', () => {
    fs.mkdirSync(sessionDirectory, { recursive: true });
    const session = { protocolVersion: '0.1', sessionId, operationId, creatorVersion, projectRoot,
        url: `ws://127.0.0.1:${server.address().port}/cocos-agent-bridge`, token, expiresAt: Date.now() + 1800000,
        nodeOperation: { nonce, ...manifest } };
    const temporary = `${sessionPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(session), { mode: 0o600 }); fs.renameSync(temporary, sessionPath);
    timer = setTimeout(() => { process.stderr.write('Editor handshake timed out.\n'); close(1); }, 20000);
    process.stdout.write(`Node create Host ready; operationId: ${operationId}\n`);
});
process.on('SIGINT', () => close(130));
process.on('SIGTERM', () => close(143));
