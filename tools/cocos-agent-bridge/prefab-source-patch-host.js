'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('./vendor/ws');
const store = require('./operation-store');
const contract = require('./prefab-source-patch-contract');
const serialized = require('./prefab-serialized-readback');

const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const fail = (message) => { process.stderr.write(`${message}\n`); process.exit(2); };
const projectRoot = path.resolve(arg('--project') || '.');
const creatorVersion = arg('--creator-version');
const operationGetId = arg('--operation-get');
const operationId = arg('--operation-id') || crypto.randomUUID();
const expectedInstanceId = arg('--expected-instance-id');
const expectedScene = arg('--expected-scene');
const prefabUuid = arg('--prefab-uuid');
const targetNodePath = arg('--target-node-path');
const targetNodeUuid = arg('--target-node-uuid');
const action = arg('--action');
const sourceOperationId = arg('--source-operation-id');
const expectedPrefabSha256 = arg('--expected-prefab-sha256');
let expectedDiff = null;
if (arg('--expected-diff') !== undefined) {
    try { expectedDiff = JSON.parse(arg('--expected-diff')); } catch (_) { fail('INVALID_EXPECTED_DIFF_JSON'); }
}

if (!fs.existsSync(projectRoot) || creatorVersion !== '2.4.15') fail('UNSUPPORTED_TARGET');
if (operationGetId) {
    if (arg('--prefab-uuid') || arg('--target-node-path') || arg('--target-node-uuid') || arg('--action')
        || arg('--expected-diff') !== undefined || arg('--expected-prefab-sha256') || arg('--source-operation-id') || arg('--operation-id')) fail('READ_ONLY_OPERATION_GET');
    let record;
    try { record = store.read(projectRoot, operationGetId); } catch (_) { fail('OPERATION_NOT_FOUND'); }
    if (record.capabilityId !== 'prefab.source.patch' || record.projectRoot !== projectRoot || record.creatorVersion !== creatorVersion) fail('OPERATION_TARGET_MISMATCH');
    process.stdout.write(`${JSON.stringify({ success: true, data: record })}\n`);
    process.exit(0);
}

if (!contract.validInput({ prefabUuid, targetNodePath, targetNodeUuid, expectedPrefabSha256, action,
    expectedDiff, sourceOperationId, operationId })) fail('INVALID_PREFAB_SOURCE_PATCH_INPUT');

function findPrefabAsset(uuid) {
    const root = path.join(projectRoot, 'assets');
    let matches = []; let failed = false;
    function walk(directory, depth) {
        if (depth > 12 || failed) { if (depth > 12) failed = true; return; }
        let entries; try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch (_) { failed = true; return; }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            if (['library', 'temp', 'local', 'build'].includes(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(filename, depth + 1);
            else if (entry.isFile() && entry.name.endsWith('.prefab.meta')) {
                try {
                    const meta = JSON.parse(fs.readFileSync(filename, 'utf8'));
                    if (meta.uuid === uuid && meta.importer === 'prefab') {
                        const assetFile = filename.slice(0, -'.meta'.length);
                        const assetStat = fs.lstatSync(assetFile);
                        if (!assetStat.isFile() || assetStat.isSymbolicLink()) { failed = true; return; }
                        const bytes = fs.readFileSync(assetFile);
                        matches.push({ filename: assetFile, url: `db://assets/${path.relative(root, assetFile).split(path.sep).join('/')}`,
                            uuid: meta.uuid, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), objects: JSON.parse(bytes.toString('utf8')) });
                    }
                } catch (_) { failed = true; return; }
            }
        }
    }
    walk(root, 0);
    return !failed && matches.length === 1 ? matches[0] : null;
}

function readbackState(asset, manifest, side) {
    const index = serialized.pathIndex(asset.objects);
    if (!index) return null;
    const targetPath = require('./scene-patch-contract').targetPathAt(manifest.targetNodePath, manifest.expectedDiff, side);
    const node = serialized.resolveNode(asset.objects, targetPath, manifest.targetNodeUuid);
    if (!node || !serialized.matchesDiff(asset.objects, node, manifest.expectedDiff, side)) return null;
    return { filename: asset.filename, nodePath: node.path, serializedNodeIndex: node.index,
        serializedNodeId: node.object._id, nodeObject: node.object };
}

let source = null;
let asset = findPrefabAsset(prefabUuid);
if (!asset) fail('PREFAB_UUID_NOT_FOUND_OR_AMBIGUOUS');
if (action !== 'apply') {
    try { source = store.read(projectRoot, sourceOperationId); } catch (_) { fail('SOURCE_OPERATION_NOT_FOUND'); }
    if (source.capabilityId !== 'prefab.source.patch' || source.projectRoot !== projectRoot || source.creatorVersion !== creatorVersion
        || source.manifest.prefabUuid !== prefabUuid || source.manifest.targetNodeUuid !== targetNodeUuid
        || source.phases.disk !== 'passed' || source.operationId === operationId
        || (action === 'compensate' && !['apply', 'replay'].includes(source.manifest.action))
        || (action === 'replay' && source.manifest.action !== 'compensate')) fail('SOURCE_OPERATION_MISMATCH');
    const currentPath = require('./scene-patch-contract').targetPathAt(source.manifest.targetNodePath,
        source.manifest.expectedDiff, 'after');
    if (currentPath !== targetNodePath || source.afterSha256 !== asset.sha256
        || JSON.stringify(contract.invertDiff(source.manifest.expectedDiff)) !== JSON.stringify(expectedDiff)
        || (expectedPrefabSha256 && expectedPrefabSha256 !== asset.sha256)) fail('SOURCE_STATE_MISMATCH');
}
if (action === 'apply' && asset.sha256 !== expectedPrefabSha256) fail('PREFAB_SOURCE_STALE');
if (!readbackState(asset, { targetNodePath, targetNodeUuid, expectedDiff }, 'before')) fail('EXPECTED_STATE_MISMATCH');

const initialReadback = readbackState(asset, { targetNodePath, targetNodeUuid, expectedDiff }, 'before');
const manifest = { prefabUuid, prefabUrl: asset.url, targetNodePath, targetNodeUuid, action,
    sourceOperationId: sourceOperationId || null, expectedPrefabSha256: asset.sha256, beforeSha256: asset.sha256, expectedDiff };
const record = { contractVersion: '0.1', capabilityId: 'prefab.source.patch', operationId, projectRoot, creatorVersion,
    manifest, sceneName: expectedScene || null, beforeSha256: asset.sha256, afterSha256: null, intent: 'created',
    receipts: [], phases: { capability: 'pending', preflight: 'pending', editor: 'pending', disk: 'pending', preview: 'skipped', recovery: 'pending' },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
try { store.write(projectRoot, record, true); } catch (error) { fail(error.code === 'EEXIST' ? 'OPERATION_ALREADY_EXISTS' : error.message); }

const sessionId = crypto.randomUUID();
const token = crypto.randomBytes(32).toString('hex');
const nonce = crypto.randomBytes(12).toString('hex');
const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge');
const sessionPath = path.join(sessionDirectory, 'session.json');
let socket = null; let closed = false; let mutationSent = false;
const requests = new Map();
const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
const wss = new WebSocket.Server({ server, path: '/cocos-agent-bridge', maxPayload: 32 * 1024,
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
    record.receipts.push({ contractVersion: '0.1', operationId, capabilityId: record.capabilityId,
        creatorVersion, phase, status, evidence, ...(error ? { error } : {}) });
    record.updatedAt = new Date().toISOString(); store.write(projectRoot, record);
}
function request(method, params) {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeout = setTimeout(() => { requests.delete(id); const error = new Error(`${method} timed out`); error.code = 'EDITOR_REQUEST_TIMEOUT'; reject(error); }, 45000);
        requests.set(id, (message) => {
            clearTimeout(timeout);
            if (!message.ok) { const error = new Error(message.error && message.error.message || `${method} failed`); error.code = message.error && message.error.code; error.sideEffect = message.error && message.error.sideEffect; reject(error); }
            else resolve(message.result);
        });
        socket.send(JSON.stringify({ type: 'request', id, method, params }));
    });
}
function envelope(value) {
    return value && value.nonce === nonce && value.operationId === operationId && value.creatorVersion === creatorVersion
        && path.resolve(value.projectRoot || '') === projectRoot;
}
async function run() {
    const ping = await request('bridge.ping', { nonce });
    if (!ping || ping.nonce !== nonce || ping.creatorVersion !== creatorVersion || path.resolve(ping.projectRoot || '') !== projectRoot) throw new Error('PING_MISMATCH');
    const operation = { nonce, ...manifest };
    const preflight = await request('prefab.source.patch.preflight', { nonce, sessionId, operationId, ...manifest });
    if (!envelope(preflight) || preflight.prefabUuid !== prefabUuid || !preflight.node
        || preflight.node.uuid !== targetNodeUuid || !require('./scene-patch-contract').matchesDiff(preflight.node, expectedDiff, 'before')) throw new Error('EDITOR_PREFLIGHT_MISMATCH');
    receipt('capability', 'passed', [{ kind: 'capability-declaration', source: 'Creator 2.4.15 extension', command: 'prefab.source.patch' }]);
    receipt('preflight', 'passed', [{ kind: 'prefab-source-before-state', source: 'Creator Prefab edit mode', prefabUuid,
        prefabUrl: asset.url, targetNodePath, targetNodeUuid, sourceSha256: asset.sha256, diff: expectedDiff,
        serializedNodeIndex: initialReadback.serializedNodeIndex }]);
    const stillCurrent = findPrefabAsset(prefabUuid);
    if (!stillCurrent || stillCurrent.sha256 !== asset.sha256 || stillCurrent.filename !== asset.filename) throw Object.assign(new Error('Prefab source changed between preflight and write.'), { code: 'PREFAB_SOURCE_STALE' });
    record.intent = 'editor-write-sent'; store.write(projectRoot, record); mutationSent = true;
    const changed = await request('prefab.source.patch.execute', { nonce, sessionId, operationId, ...manifest });
    if (!envelope(changed) || changed.prefabUuid !== prefabUuid || changed.saved !== true || changed.reopened !== true
        || changed.targetNodeUuid !== targetNodeUuid || changed.beforeSha256 !== asset.sha256
        || !/^[a-f0-9]{64}$/.test(changed.afterSha256 || '') || changed.afterSha256 === asset.sha256
        || !require('./scene-patch-contract').matchesDiff(changed.node, expectedDiff, 'after')) throw new Error('EDITOR_RESULT_MISMATCH');
    receipt('editor', 'passed', [{ kind: 'prefab-edit-save-reopen', source: 'Creator 2.4.15 Prefab edit mode', prefabUuid,
        targetNodeUuid, reopened: changed.reopened, nodePath: changed.node.path }]);
    const saved = findPrefabAsset(prefabUuid);
    const readback = saved && readbackState(saved, { targetNodePath, targetNodeUuid, expectedDiff }, 'after');
    if (!saved || saved.url !== asset.url || saved.sha256 !== changed.afterSha256 || !readback) throw new Error('PREFAB_DISK_READBACK_MISMATCH');
    record.afterSha256 = saved.sha256;
    receipt('disk', 'passed', [{ kind: 'saved-prefab-readback', source: path.relative(projectRoot, saved.filename),
        prefabUuid, prefabUrl: saved.url, beforeSha256: asset.sha256, afterSha256: saved.sha256,
        targetNodePath: readback.nodePath, targetNodeUuid, serializedNodeIndex: readback.serializedNodeIndex,
        referencesVerified: true, reopenedInEditor: true, expectedDiff }]);
    record.intent = 'disk-verified';
    if (action === 'compensate') receipt('recovery', 'passed', [{ kind: 'prefab-compensation', source: 'Creator save/reopen and serialized readback',
        sourceOperationId, beforeSha256: asset.sha256, afterSha256: saved.sha256, targetNodeUuid }]);
    else record.phases.recovery = 'pending';
    store.write(projectRoot, record);
    process.stdout.write(`command.result ${JSON.stringify({ command: 'prefab.source.patch', operationId,
        prefabUuid, prefabUrl: asset.url, targetNodePath, targetNodeUuid, action, expectedDiff,
        beforeSha256: asset.sha256, afterSha256: saved.sha256, phases: record.phases })}\n`);
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
                && Array.isArray(message.capabilities) && message.capabilities.includes('prefab.source.patch.preflight')
                && message.capabilities.includes('prefab.source.patch.execute');
            client.send(JSON.stringify({ type: 'helloAck', accepted, sessionId, protocolVersion: '0.1' }));
            if (!accepted) { finish(1); return; }
            run().catch((error) => {
                const phase = record.phases.preflight === 'pending' ? 'preflight' : record.phases.editor === 'pending' ? 'editor' : 'disk';
                receipt(phase, 'failed', [], { code: error.code || error.message || 'PREFAB_SOURCE_PATCH_FAILED', phase,
                    message: String(error.message || error), retryable: false,
                    sideEffect: mutationSent ? error.sideEffect || 'possible' : 'none' });
                process.stderr.write(`${error.code || error.message || 'PREFAB_SOURCE_PATCH_FAILED'}\n`); finish(1);
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
        expiresAt: Date.now() + 1800000, prefabSourcePatchOperation: { nonce, ...manifest } };
    const temporary = `${sessionPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(session), { mode: 0o600 }); fs.renameSync(temporary, sessionPath);
    process.stdout.write(`Bridge ready for Creator 2.4.15 Prefab source patch; operationId=${operationId}\n`);
});
process.on('SIGINT', () => finish(130));
process.on('SIGTERM', () => finish(143));
