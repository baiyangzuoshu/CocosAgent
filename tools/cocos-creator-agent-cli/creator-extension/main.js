'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const extensionPackage = require('./package.json');
const contract = require('./command-contract.json');

const EXPECTED_CREATOR_VERSION = contract.creatorVersion;
const PROTOCOL_VERSION = '0.1';
const STATE_FILE = path.join(os.homedir(), '.cocos-creator-agent', 'third-party-bridge.json');
const OPERATION_DIRECTORY = path.join(os.homedir(), '.cocos-creator-agent', 'creator-operations');
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_FILES = 12000;
const MAX_CODE_SCAN_BYTES = 32 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 128 * 1024;
const MAX_WRITE_SOURCE_BYTES = 16 * 1024;
const OPERATION_FILE_MAX_BYTES = 64 * 1024;
const OPERATION_TTL_MS = 15 * 60 * 1000;
function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const INSTANCE_ID = uuid();
const CONTRACT_FINGERPRINT = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'command-contract.json'))).digest('hex');

let timer = null;
let stopped = false;
let activeRequest = null;
let bridgeSession = null;
let lastSceneName = null;
let warned = '';
let diagnosticSequence = 0;
let diagnosticEvents = [];
let latestCompile = null;
let diagnosticListeners = [];

function editorVersion() {
    const candidates = [Editor && Editor.App && Editor.App.version,
        Editor && Editor.app && Editor.app.version, Editor && Editor.version];
    return candidates.find((value) => typeof value === 'string' && value.trim()) || null;
}

function projectRoot() {
    const value = Editor && Editor.Project && Editor.Project.path;
    if (typeof value !== 'string' || !path.isAbsolute(value)) throw coded('PROJECT_PATH_UNAVAILABLE');
    const root = fs.realpathSync(value);
    const stat = fs.statSync(root);
    const projectFile = path.join(root, 'project.json');
    const projectStat = fs.lstatSync(projectFile);
    if (!stat.isDirectory() || !projectStat.isFile() || projectStat.isSymbolicLink()) throw coded('PROJECT_IDENTITY_INVALID');
    return root;
}

function coded(code, message) {
    const error = new Error(message || code);
    error.code = code;
    return error;
}

function readBridgeState() {
    let stat;
    try { stat = fs.lstatSync(STATE_FILE); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw coded('BRIDGE_STATE_UNSAFE');
    const value = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (value.protocolVersion !== PROTOCOL_VERSION || value.host !== '127.0.0.1'
        || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535
        || typeof value.token !== 'string' || value.token.length < 48 || typeof value.bridgeId !== 'string')
        throw coded('BRIDGE_STATE_INVALID');
    return value;
}

function requestJson(state, method, route, body, timeoutMs) {
    return new Promise((resolve, reject) => {
        const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
        const headers = { authorization: `Bearer ${state.token}` };
        if (bytes) {
            headers['content-type'] = 'application/json';
            headers['content-length'] = bytes.length;
        }
        const request = http.request({ hostname: '127.0.0.1', port: state.port, method, path: route,
            headers }, (response) => {
            const chunks = [];
            let total = 0;
            response.on('data', (chunk) => {
                total += chunk.length;
                if (total > MAX_RESPONSE_BYTES) { request.destroy(coded('BRIDGE_RESPONSE_TOO_LARGE')); return; }
                chunks.push(chunk);
            });
            response.on('end', () => {
                if (response.statusCode === 204) { resolve(null); return; }
                let payload = {};
                try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
                catch (_) { reject(coded('BRIDGE_RESPONSE_INVALID')); return; }
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(coded(payload.error && payload.error.code || `BRIDGE_HTTP_${response.statusCode}`)); return;
                }
                resolve(payload);
            });
        });
        request.setTimeout(timeoutMs || 10000, () => request.destroy(coded('BRIDGE_REQUEST_TIMEOUT')));
        request.on('error', reject);
        if (stopped) { request.destroy(coded('EXTENSION_UNLOADED')); return; }
        activeRequest = request;
        request.on('close', () => { if (activeRequest === request) activeRequest = null; });
        if (bytes) request.write(bytes);
        request.end();
    });
}

function authorizeWriteRequest(requestId) {
    if (!bridgeSession || typeof requestId !== 'string') throw coded('WRITE_REQUEST_CONTEXT_MISSING');
    const state = readBridgeState();
    if (!state || state.bridgeId !== bridgeSession.bridgeId) throw coded('WRITE_REQUEST_NO_ACTIVE_BRIDGE');
    return requestJson(state, 'POST', '/v1/creator/authorize-write', {
        instanceId: INSTANCE_ID, sessionId: bridgeSession.sessionId, requestId,
    }, 5000);
}

function redactDiagnosticText(value) {
    return String(value).replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [redacted]')
        .replace(/((?:api[_-]?key|token|secret|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
        .slice(0, 1800);
}

function diagnosticValue(value, depth, seen) {
    if (value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value))
        return typeof value === 'string' ? redactDiagnosticText(value) : value;
    if (typeof value !== 'object' && typeof value !== 'function') return String(value).slice(0, 100);
    if (depth > 3) return '[depth-limit]';
    const visited = seen || new WeakSet();
    if (visited.has(value)) return '[circular]';
    visited.add(value);
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => diagnosticValue(item, depth + 1, visited));
    if (typeof value === 'object') {
        const output = {};
        for (const key of Object.keys(value).slice(0, 32)) {
            if (/token|secret|password|authorization|credential|api.?key/i.test(key)) output[key] = '[redacted]';
            else output[key] = diagnosticValue(value[key], depth + 1, visited);
        }
        return output;
    }
    return String(value).slice(0, 100);
}

function recordDiagnostic(source, level, args) {
    const text = args.map((item) => {
        const safe = diagnosticValue(item, 0);
        if (typeof safe === 'string') return safe;
        try { return JSON.stringify(safe); } catch (_) { return String(safe); }
    }).filter(Boolean).join(' ').slice(0, 1800);
    diagnosticSequence += 1;
    diagnosticEvents.push({ sequence: diagnosticSequence, at: new Date().toISOString(), source, level, text });
    if (diagnosticEvents.length > 400) diagnosticEvents.splice(0, diagnosticEvents.length - 400);
}

function recordIpcDiagnostic(source, level, args) {
    const first = args[0];
    const hasIpcEvent = first && typeof first === 'object'
        && (Object.prototype.hasOwnProperty.call(first, 'sender') || typeof first.reply === 'function');
    recordDiagnostic(source, level, hasIpcEvent ? args.slice(1) : args);
}

function addDiagnosticListener(target, eventName, listener) {
    if (!target || typeof target.on !== 'function') return;
    try {
        target.on(eventName, listener);
        diagnosticListeners.push({ target, eventName, listener });
    } catch (_) {}
}

function setupDiagnosticListeners() {
    for (const eventName of ['compile-finished', 'build-finished']) {
        addDiagnosticListener(Editor && Editor.Builder, eventName, (...args) => {
            const safe = args.map((item) => diagnosticValue(item, 0));
            latestCompile = { event: eventName, at: new Date().toISOString(), details: safe };
            recordDiagnostic('creator-builder', 'info', [eventName, ...safe]);
        });
    }
    addDiagnosticListener(Editor && Editor.Ipc, 'asset-db:script-import-failed', (...args) => {
        recordIpcDiagnostic('creator-assetdb', 'error', args);
    });
    for (const level of ['log', 'info', 'warn', 'error', 'success', 'failed']) {
        addDiagnosticListener(Editor && Editor.Ipc, `editor:renderer-console-${level}`, (...args) => {
            recordIpcDiagnostic('creator-console', level === 'failed' ? 'error' : level, args);
        });
    }
}

function removeDiagnosticListeners() {
    for (const { target, eventName, listener } of diagnosticListeners) {
        try {
            if (typeof target.removeListener === 'function') target.removeListener(eventName, listener);
            else if (typeof target.off === 'function') target.off(eventName, listener);
        } catch (_) {}
    }
    diagnosticListeners = [];
}

function readDiagnostics(input) {
    const afterSequence = input.afterSequence || 0;
    const limit = input.limit || 50;
    const selected = diagnosticEvents.filter((item) => item.sequence > afterSequence).slice(0, limit);
    return { projectRoot: projectRoot(), creatorVersion: editorVersion(), instanceId: INSTANCE_ID,
        sequence: diagnosticSequence, oldestSequence: diagnosticEvents[0]?.sequence || diagnosticSequence + 1,
        truncated: afterSequence > 0 && diagnosticEvents[0] && afterSequence < diagnosticEvents[0].sequence - 1,
        latestCompile, events: selected };
}

function confirmPreviewStart() {
    if (!Editor.Dialog || typeof Editor.Dialog.messageBox !== 'function') throw coded('CREATOR_APPROVAL_DIALOG_UNAVAILABLE');
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            const response = Number.isInteger(result) ? result : result && Number.isInteger(result.response) ? result.response : -1;
            resolve(response === 1);
        };
        try {
            const result = Editor.Dialog.messageBox({ type: 'warning', title: 'Start Cocos Creator Web preview',
                message: 'Run the active scene in an Agent-managed local browser session?',
                detail: `Project: ${projectRoot()}\nCreator: ${editorVersion()}\nScene: ${lastSceneName || '(querying)'}\n\nPreview executes project scripts. It may trigger behavior implemented by the project.`,
                buttons: ['Cancel', 'Start preview'], defaultId: 0, cancelId: 0, noLink: true }, finish);
            if (result && typeof result.then === 'function') result.then(finish, (error) => {
                if (settled) return;
                settled = true;
                reject(coded('CREATOR_APPROVAL_DIALOG_FAILED', String(error && error.message || error)));
            });
        } catch (error) { reject(coded('CREATOR_APPROVAL_DIALOG_FAILED', String(error.message || error))); }
    });
}

async function startPreview(input, context) {
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_PREVIEW_IPC_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (currentVersion !== EXPECTED_CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH');
    const scene = await callScene('snapshot', { maxNodes: 1 });
    if (!scene || scene.available !== true || typeof scene.sceneName !== 'string' || typeof scene.sceneUuid !== 'string')
        throw coded('ACTIVE_SCENE_IDENTITY_UNAVAILABLE');
    const approved = await confirmPreviewStart();
    if (!approved) throw coded('PREVIEW_NOT_APPROVED');
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) { throw coded('PREVIEW_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error)); }
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('PREVIEW_CREATOR_IDENTITY_CHANGED');
    const liveScene = await callScene('snapshot', { maxNodes: 1 });
    if (!liveScene || liveScene.sceneUuid !== scene.sceneUuid || liveScene.sceneName !== scene.sceneName)
        throw coded('PREVIEW_SCENE_CHANGED');
    lastSceneName = scene.sceneName;
    try { Editor.Ipc.sendToPanel('scene', 'scene:play-on-device'); }
    catch (error) { throw coded('CREATOR_PREVIEW_REQUEST_FAILED', String(error.message || error)); }
    return { requested: true, projectRoot: currentRoot, creatorVersion: currentVersion,
        instanceId: INSTANCE_ID, creatorSessionId: bridgeSession && bridgeSession.sessionId,
        sceneName: scene.sceneName, sceneUuid: scene.sceneUuid, previewPort: input.port || 7456,
        requestedAt: new Date().toISOString(), compileCursor: diagnosticSequence };
}

function safeProjectFile(relative, extensionPattern) {
    if (typeof relative !== 'string' || relative.length > 240 || relative.includes('\\') || relative.includes('\0'))
        throw coded('UNSAFE_PROJECT_PATH');
    const parts = relative.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) throw coded('UNSAFE_PROJECT_PATH');
    if (extensionPattern && !extensionPattern.test(relative)) throw coded('UNSUPPORTED_SCRIPT_TYPE');
    const root = projectRoot();
    const assets = path.join(root, 'assets');
    let current = assets;
    const rootStat = fs.lstatSync(assets);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw coded('ASSETS_ROOT_UNSAFE');
    for (let index = 0; index < parts.length; index += 1) {
        current = path.join(current, parts[index]);
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw coded('UNSAFE_PROJECT_PATH');
    }
    const real = fs.realpathSync(current);
    if (!real.startsWith(`${assets}${path.sep}`)) throw coded('UNSAFE_PROJECT_PATH');
    return current;
}

function fileHash(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function ensureOperationDirectory() {
    const dataRoot = path.dirname(STATE_FILE);
    fs.mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
    const dataStat = fs.lstatSync(dataRoot);
    if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw coded('OPERATION_DIRECTORY_UNSAFE');
    try { fs.chmodSync(dataRoot, 0o700); } catch (_) {}
    fs.mkdirSync(OPERATION_DIRECTORY, { recursive: true, mode: 0o700 });
    const operationStat = fs.lstatSync(OPERATION_DIRECTORY);
    if (!operationStat.isDirectory() || operationStat.isSymbolicLink()) throw coded('OPERATION_DIRECTORY_UNSAFE');
    try { fs.chmodSync(OPERATION_DIRECTORY, 0o700); } catch (_) {}
}

function operationPath(operationId) {
    if (typeof operationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(operationId)) throw coded('OPERATION_ID_INVALID');
    ensureOperationDirectory();
    return path.join(OPERATION_DIRECTORY, `${operationId}.json`);
}

function writeOperation(operation) {
    const filename = operationPath(operation.operationId);
    try {
        const current = fs.lstatSync(filename);
        if (!current.isFile() || current.isSymbolicLink()) throw coded('OPERATION_FILE_UNSAFE');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const bytes = Buffer.from(JSON.stringify(operation));
    if (bytes.length > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_RECORD_TOO_LARGE');
    const temporary = `${filename}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
        try { fs.chmodSync(filename, 0o600); } catch (_) {}
    } catch (error) {
        try { fs.unlinkSync(temporary); } catch (_) {}
        throw error;
    }
}

function readOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.script.create' || typeof operation.planHash !== 'string'
        || typeof operation.projectRoot !== 'string' || typeof operation.scriptPath !== 'string'
        || typeof operation.source !== 'string') throw coded('OPERATION_RECORD_INVALID');
    return operation;
}

function readSceneOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.set-active' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string'
        || typeof plan.nodePath !== 'string' || !plan.expectedBefore || !plan.expectedAfter
        || typeof plan.expectedBefore.active !== 'boolean' || typeof plan.expectedAfter.active !== 'boolean'
        || plan.expectedBefore.active === plan.expectedAfter.active || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function planFingerprint(plan) { return fileHash(Buffer.from(JSON.stringify(plan))); }

function safeNewScriptTarget(relative) {
    if (typeof relative !== 'string' || relative.length > 240 || relative.includes('\\') || relative.includes('\0')
        || !/^(?!\/)(?!.*\/\/)(?!.*(?:^|\/)\.\.?($|\/))(?!.*(?:^|\/)\.)[^\\]+\.(?:js|ts)$/i.test(relative))
        throw coded('UNSAFE_PROJECT_PATH');
    const parts = relative.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.'))) throw coded('UNSAFE_PROJECT_PATH');
    const root = projectRoot();
    const assets = path.join(root, 'assets');
    const assetsStat = fs.lstatSync(assets);
    if (!assetsStat.isDirectory() || assetsStat.isSymbolicLink()) throw coded('ASSETS_ROOT_UNSAFE');
    let current = assets;
    for (let index = 0; index < parts.length - 1; index += 1) {
        current = path.join(current, parts[index]);
        let stat;
        try { stat = fs.lstatSync(current); }
        catch (error) { if (error.code === 'ENOENT') throw coded('SCRIPT_PARENT_DIRECTORY_MISSING'); throw error; }
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('UNSAFE_PROJECT_PATH');
    }
    const filename = path.join(assets, ...parts);
    const metaFilename = `${filename}.meta`;
    for (const candidate of [filename, metaFilename]) {
        try {
            const stat = fs.lstatSync(candidate);
            if (stat.isSymbolicLink()) throw coded('UNSAFE_PROJECT_PATH');
            throw coded(candidate === filename ? 'SCRIPT_TARGET_ALREADY_EXISTS' : 'SCRIPT_META_ALREADY_EXISTS');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const url = `db://${['assets', ...parts].join('/')}`;
    if (!Editor.assetdb || typeof Editor.assetdb.exists !== 'function') throw coded('ASSETDB_EXISTS_UNAVAILABLE');
    if (Editor.assetdb.exists(url)) throw coded('SCRIPT_TARGET_ALREADY_EXISTS');
    return { root, filename, url };
}

function createScriptPlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.create !== 'function') throw coded('ASSETDB_CREATE_UNAVAILABLE');
    const sourceBytes = Buffer.from(input.source, 'utf8');
    if (sourceBytes.length > MAX_WRITE_SOURCE_BYTES || sourceBytes.toString('utf8') !== input.source || input.source.includes('\0'))
        throw coded('SCRIPT_SOURCE_INVALID');
    const target = safeNewScriptTarget(input.scriptPath);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + OPERATION_TTL_MS).toISOString();
    const operationId = uuid();
    const plan = {
        operationId,
        operation: 'creator.script.create',
        projectRoot: target.root,
        creatorVersion: editorVersion(),
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        scriptPath: input.scriptPath,
        targetUrl: target.url,
        scriptType: path.extname(input.scriptPath).slice(1).toLowerCase(),
        sourceBytes: sourceBytes.length,
        sourceSha256: fileHash(sourceBytes),
        expectedBefore: { assetExists: false, sourceExists: false, metaExists: false },
        expiresAt,
    };
    const operation = { schemaVersion: 1, ...plan, status: 'planned', createdAt,
        planHash: planFingerprint(plan), source: input.source, plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, scriptPath: plan.scriptPath,
        targetUrl: plan.targetUrl, scriptType: plan.scriptType, sourceBytes: plan.sourceBytes,
        sourceSha256: plan.sourceSha256, expectedBefore: plan.expectedBefore, expiresAt: plan.expiresAt,
        diff: { action: 'create', targetUrl: plan.targetUrl, before: 'absent', after: `new ${plan.scriptType} script asset` },
        sourcePreview: input.source,
        recovery: { operationId, sourceStoredOutsideProject: true, compensationAvailable: false,
            willRecord: ['Creator AssetDB UUID', 'importer', 'source SHA-256', '.meta SHA-256'],
            compensationCondition: 'AssetDB deletion is safe only while URL, UUID, source SHA-256, and .meta SHA-256 still match this operation receipt.' } };
}

async function createSceneNodeActivePlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (currentVersion !== EXPECTED_CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH');
    const current = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (typeof current.nodePath !== 'string' || typeof current.active !== 'boolean'
        || current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid)
        throw coded('SCENE_NODE_STATE_INVALID');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    if (current.active === input.active) throw coded('SCENE_NODE_ALREADY_IN_REQUESTED_STATE');
    const createdAt = new Date().toISOString();
    const plan = {
        operationId: uuid(),
        operation: 'creator.scene.node.set-active',
        projectRoot: currentRoot,
        creatorVersion: currentVersion,
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        sceneUuid: current.sceneUuid,
        sceneName: current.sceneName,
        nodeUuid: current.nodeUuid,
        nodePath: current.nodePath,
        expectedBefore: { active: current.active },
        expectedAfter: { active: input.active },
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    if (plan.creatorVersion !== EXPECTED_CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH');
    const operation = { schemaVersion: 1, operationId: plan.operationId, operation: plan.operation,
        plan, planHash: planFingerprint(plan), status: 'planned', createdAt, plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId: operation.operationId, operation: operation.operation, status: operation.status,
        planHash: operation.planHash, projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        expectedBefore: plan.expectedBefore, expectedAfter: plan.expectedAfter, expiresAt: plan.expiresAt,
        diff: { action: 'set-node-active', scene: plan.sceneName, node: plan.nodePath,
            before: plan.expectedBefore.active, after: plan.expectedAfter.active },
        recovery: { operationId: operation.operationId, automaticRetry: false,
            reconcileCommand: 'creator.scene.node.set-active.reconcile',
            sceneSaveAcknowledgement: 'Creator 2.4 scene:stash-and-save has no documented completion acknowledgement; receipt distinguishes save-requested from disk persistence.' } };
}

function verifySceneOperationIdentity(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || plan.creatorVersion !== EXPECTED_CREATOR_VERSION)
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
}

async function readPlannedSceneNode(plan) {
    const state = await callScene('nodeState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid || state.nodePath !== plan.nodePath)
        throw coded('OPERATION_TARGET_MISMATCH');
    return state;
}

function confirmSceneNodeActive(operation) {
    if (!Editor.Dialog || typeof Editor.Dialog.messageBox !== 'function') throw coded('CREATOR_APPROVAL_DIALOG_UNAVAILABLE');
    const plan = operation.plan;
    const detail = [
        `Project: ${plan.projectRoot}`,
        `Creator: ${plan.creatorVersion}`,
        `Scene: ${plan.sceneName} (${plan.sceneUuid})`,
        `Node: ${plan.nodePath} (${plan.nodeUuid})`,
        `Active: ${plan.expectedBefore.active} → ${plan.expectedAfter.active}`,
        `Operation: ${operation.operationId}`,
        '',
        'This changes one existing node active property and requests save of the current scene. Scene Script readback confirms in-memory state; Creator does not document a save completion acknowledgement here.',
    ].join('\n');
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            const response = Number.isInteger(result) ? result : result && Number.isInteger(result.response) ? result.response : -1;
            resolve(response === 1);
        };
        try {
            const result = Editor.Dialog.messageBox({ type: 'warning', title: 'Approve Cocos Creator scene change',
                message: `Set ${plan.nodePath}.active to ${plan.expectedAfter.active}?`, detail,
                buttons: ['Cancel', 'Apply scene change'], defaultId: 0, cancelId: 0, noLink: true }, finish);
            if (result && typeof result.then === 'function') result.then(finish, (error) => {
                if (settled) return;
                settled = true;
                reject(coded('CREATOR_APPROVAL_DIALOG_FAILED', String(error && error.message || error)));
            });
        } catch (error) { reject(coded('CREATOR_APPROVAL_DIALOG_FAILED', String(error.message || error))); }
    });
}

function sceneNodeActiveReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, sceneName: plan.sceneName, sceneUuid: plan.sceneUuid,
        nodePath: plan.nodePath, nodeUuid: plan.nodeUuid, beforeActive: plan.expectedBefore.active,
        active: state.active, sceneSaveRequestSent: !!operation.sceneSaveRequestSent,
        sceneSaveCompletionConfirmed: false, plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.node.set-active.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'The Creator 2.4 scene save IPC has no documented completion acknowledgement; scene readback is an in-memory Creator Scene Script observation.' } };
}

async function commitSceneNodeActive(input, context) {
    const operation = readSceneOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'mutation-applied' || operation.status === 'save-requested'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before = await readPlannedSceneNode(operation.plan);
    if (before.active !== operation.plan.expectedBefore.active) throw coded('OPERATION_PRECONDITION_FAILED');
    operation.status = 'awaiting-approval';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await confirmSceneNodeActive(operation);
    if (!approved) {
        operation.status = 'cancelled';
        operation.cancelledAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned';
        operation.abandonedAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    verifySceneOperationIdentity(operation);
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try {
        before = await readPlannedSceneNode(operation.plan);
        if (before.active !== operation.plan.expectedBefore.active) throw coded('OPERATION_PRECONDITION_FAILED');
    } catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'creator-native-dialog';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    const mutation = await callScene('setNodeActive', { sceneUuid: operation.plan.sceneUuid,
        nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
        expectedActive: operation.plan.expectedBefore.active, active: operation.plan.expectedAfter.active }, 20000);
    if (!mutation || mutation.available !== true || mutation.active !== operation.plan.expectedAfter.active) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw coded(mutation && mutation.reason || 'SCENE_NODE_WRITE_READBACK_FAILED');
    }
    operation.status = 'mutation-applied';
    operation.mutationAppliedAt = new Date().toISOString();
    writeOperation(operation);
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error)); }
    operation.status = 'save-requested';
    operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const readback = await readPlannedSceneNode(operation.plan);
    if (readback.active !== operation.plan.expectedAfter.active) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    return sceneNodeActiveReceipt(operation, readback);
}

async function reconcileSceneNodeActive(input) {
    const operation = readSceneOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneNode(operation.plan); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_NODE_STATE_UNAVAILABLE';
        writeOperation(operation);
        return { ...sceneNodeActiveReceipt(operation, { active: null }), status: operation.status,
            observed: null, reason: operation.reconcileReason };
    }
    if (observed.active === operation.plan.expectedBefore.active) {
        if (['applying', 'awaiting-approval'].includes(operation.status)) operation.status = 'not-applied';
        else if (['mutation-applied', 'save-requested', 'completed'].includes(operation.status)) operation.status = 'conflict';
    } else if (observed.active === operation.plan.expectedAfter.active) {
        if (operation.status === 'save-requested' || operation.status === 'completed') operation.status = 'completed';
        else if (operation.status === 'mutation-applied') operation.status = 'save-required';
        else operation.status = 'conflict';
    } else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return { ...sceneNodeActiveReceipt(operation, observed), observed: { active: observed.active,
        sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath },
        retry: 'Never retry this operation. If the scene remains unchanged, create a new plan; if save-required, save the scene in Creator and inspect the result.' };
}

function verifyPlanIdentity(operation, { requireCurrentContract = true } = {}) {
    if (projectRoot() !== operation.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== operation.creatorVersion || operation.creatorVersion !== EXPECTED_CREATOR_VERSION)
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (operation.extensionVersion !== extensionPackage.version
        || operation.contractFingerprint !== CONTRACT_FINGERPRINT))
        throw coded('OPERATION_CONTRACT_MISMATCH');
    const plan = {
        operationId: operation.operationId, operation: operation.operation, projectRoot: operation.projectRoot,
        creatorVersion: operation.creatorVersion, extensionVersion: operation.extensionVersion,
        contractFingerprint: operation.contractFingerprint, scriptPath: operation.scriptPath,
        targetUrl: operation.targetUrl, scriptType: operation.scriptType, sourceBytes: operation.sourceBytes,
        sourceSha256: operation.sourceSha256, expectedBefore: operation.expectedBefore, expiresAt: operation.expiresAt,
    };
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (fileHash(Buffer.from(operation.source, 'utf8')) !== operation.sourceSha256) throw coded('OPERATION_SOURCE_HASH_MISMATCH');
}

function verifyScriptAbsent(operation) {
    const target = safeNewScriptTarget(operation.scriptPath);
    if (target.root !== operation.projectRoot || target.url !== operation.targetUrl) throw coded('OPERATION_TARGET_MISMATCH');
}

function confirmScriptCreate(operation) {
    if (!Editor.Dialog || typeof Editor.Dialog.messageBox !== 'function') throw coded('CREATOR_APPROVAL_DIALOG_UNAVAILABLE');
    const detail = [
        `Project: ${operation.projectRoot}`,
        `Creator: ${operation.creatorVersion}`,
        `Asset: ${operation.targetUrl}`,
        `SHA-256: ${operation.sourceSha256}`,
        `Operation: ${operation.operationId}`,
        '',
        operation.source,
        '',
        'This approval creates one new script asset through Creator AssetDB. Existing assets and scenes are not modified.',
    ].join('\n');
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            const response = Number.isInteger(result) ? result : result && Number.isInteger(result.response) ? result.response : -1;
            resolve(response === 1);
        };
        try {
            const result = Editor.Dialog.messageBox({ type: 'warning', title: 'Approve Cocos Creator script creation',
                message: `Create ${operation.scriptPath}?`, detail, buttons: ['Cancel', 'Create script asset'],
                defaultId: 0, cancelId: 0, noLink: true }, finish);
            if (result && typeof result.then === 'function') result.then(finish, (error) => {
                if (settled) return;
                settled = true;
                reject(coded('CREATOR_APPROVAL_DIALOG_FAILED', String(error && error.message || error)));
            });
        } catch (error) { reject(coded('CREATOR_APPROVAL_DIALOG_FAILED', String(error.message || error))); }
    });
}

function createAssetThroughAssetDb(url, source) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_CREATE_TIMEOUT'));
        }, 60000);
        try {
            Editor.assetdb.create(url, source, (error, results) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_CREATE_FAILED', String(error.message || error))); return; }
                resolve(Array.isArray(results) ? results : (results ? [results] : []));
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_CREATE_FAILED', String(error.message || error)));
        }
    });
}

function scriptReceipt(operation, script) {
    return { operationId: operation.operationId, status: operation.status, projectRoot: operation.projectRoot,
        creatorVersion: operation.creatorVersion, scriptPath: script.scriptPath, targetUrl: operation.targetUrl,
        scriptUuid: script.scriptUuid, importer: operation.importer || script.scriptType,
        assetType: operation.assetType || null, sourceSha256: script.sourceSha256,
        metaSha256: script.metaSha256, plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, approvalSource: operation.approvalSource || null,
        completedAt: operation.completedAt || null,
        recovery: { targetUrl: operation.targetUrl, scriptUuid: script.scriptUuid,
            sourceSha256: script.sourceSha256, metaSha256: script.metaSha256,
            sourceStoredOutsideProject: true, compensationAvailable: false,
            compensationCondition: 'Only delete through Creator AssetDB after rechecking that URL, UUID, source SHA-256, and .meta SHA-256 all still match.' } };
}

async function commitScriptCreate(input, context) {
    const operation = readOperation(input.operationId);
    verifyPlanIdentity(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    verifyScriptAbsent(operation);
    operation.status = 'awaiting-approval';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await confirmScriptCreate(operation);
    if (!approved) {
        operation.status = 'cancelled';
        operation.cancelledAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned';
        operation.abandonedAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    verifyPlanIdentity(operation);
    if (Date.now() > Date.parse(operation.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try { verifyScriptAbsent(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'creator-native-dialog';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    const createdRows = await createAssetThroughAssetDb(operation.targetUrl, operation.source);
    const readback = readScript({ scriptPath: operation.scriptPath });
    if (readback.sourceSha256 !== operation.sourceSha256) throw coded('OPERATION_READBACK_SOURCE_MISMATCH');
    const assetDbRow = await queryAssetByUrl(operation.targetUrl);
    if (!assetDbRow || typeof assetDbRow.uuid !== 'string' || assetDbRow.uuid !== readback.scriptUuid)
        throw coded('ASSETDB_READBACK_IDENTITY_MISMATCH');
    if (createdRows.length && !createdRows.some((row) => row && row.url === operation.targetUrl
        && (!row.uuid || row.uuid === assetDbRow.uuid))) throw coded('ASSETDB_CREATE_IDENTITY_MISMATCH');
    if (assetDbRow.importer && assetDbRow.importer !== readback.scriptType) throw coded('ASSETDB_IMPORTER_MISMATCH');
    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    operation.scriptUuid = readback.scriptUuid;
    operation.importer = assetDbRow.importer || readback.scriptType;
    operation.assetType = typeof assetDbRow.type === 'string' ? assetDbRow.type : null;
    operation.sourceSha256 = readback.sourceSha256;
    operation.metaSha256 = readback.metaSha256;
    writeOperation(operation);
    return scriptReceipt(operation, readback);
}

async function reconcileScriptCreate(input) {
    const operation = readOperation(input.operationId);
    verifyPlanIdentity(operation, { requireCurrentContract: false });
    if (projectRoot() !== operation.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (!Editor.assetdb || typeof Editor.assetdb.exists !== 'function') throw coded('ASSETDB_EXISTS_UNAVAILABLE');
    const assetExists = !!Editor.assetdb.exists(operation.targetUrl);
    const assetDbRow = assetExists ? await queryAssetByUrl(operation.targetUrl) : null;
    let sourceExists = false;
    let metaExists = false;
    try { safeProjectFile(operation.scriptPath, /\.(?:js|ts)$/i); sourceExists = true; } catch (_) {}
    try { safeProjectFile(`${operation.scriptPath}.meta`); metaExists = true; } catch (_) {}
    if (!assetExists && !sourceExists && !metaExists) {
        if (operation.status === 'applying' || operation.status === 'awaiting-approval') operation.status = 'not-applied';
        else if (operation.status === 'completed') operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        return { operationId: operation.operationId, status: operation.status, targetUrl: operation.targetUrl,
            observed: { assetExists, sourceExists, metaExists }, retry: 'Create a new plan; this operation is never automatically retried.' };
    }
    if (operation.status !== 'applying' && operation.status !== 'completed') {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('OPERATION_TARGET_CHANGED');
    }
    let readback;
    try { readback = readScript({ scriptPath: operation.scriptPath }); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('OPERATION_READBACK_CONFLICT', error.code || error.message);
    }
    if (!assetExists || !assetDbRow || assetDbRow.uuid !== readback.scriptUuid
        || (assetDbRow.importer && assetDbRow.importer !== readback.scriptType)
        || readback.sourceSha256 !== operation.sourceSha256
        || (operation.scriptUuid && operation.scriptUuid !== readback.scriptUuid)
        || (operation.metaSha256 && operation.metaSha256 !== readback.metaSha256)) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('OPERATION_READBACK_CONFLICT');
    }
    operation.status = 'completed';
    operation.reconciledAt = new Date().toISOString();
    operation.completedAt = operation.completedAt || operation.reconciledAt;
    operation.scriptUuid = readback.scriptUuid;
    operation.importer = assetDbRow.importer || readback.scriptType;
    operation.assetType = typeof assetDbRow.type === 'string' ? assetDbRow.type : null;
    operation.metaSha256 = readback.metaSha256;
    operation.completedByInstanceId = operation.completedByInstanceId || operation.appliedByInstanceId || INSTANCE_ID;
    writeOperation(operation);
    return scriptReceipt(operation, readback);
}

function callScene(method, params, timeoutMs) {
    return new Promise((resolve, reject) => {
        if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') { reject(coded('SCENE_API_UNAVAILABLE')); return; }
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('SCENE_QUERY_TIMEOUT'));
        }, timeoutMs || 8000);
        try {
            Editor.Scene.callSceneScript(extensionPackage.name, method, params || {}, (error, result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) reject(coded('SCENE_QUERY_FAILED', String(error.message || error)));
                else resolve(result);
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('SCENE_QUERY_FAILED', String(error.message || error)));
        }
    });
}

function capabilityList() {
    const ready = {
        'creator.project.info': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.project.search': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.asset.search': !!(Editor && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.read': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.scene.snapshot': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.read': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-active.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-active.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'
            && Editor.Dialog && typeof Editor.Dialog.messageBox === 'function'),
        'creator.scene.node.set-active.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.script.create.plan': !!(Editor && Editor.assetdb && typeof Editor.assetdb.exists === 'function'
            && typeof Editor.assetdb.create === 'function'),
        'creator.script.create.commit': !!(Editor && Editor.assetdb && typeof Editor.assetdb.exists === 'function'
            && typeof Editor.assetdb.create === 'function' && typeof Editor.assetdb.queryAssets === 'function'
            && Editor.Dialog && typeof Editor.Dialog.messageBox === 'function'),
        'creator.script.create.reconcile': !!(Editor && Editor.assetdb && typeof Editor.assetdb.exists === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.diagnostics.read': !!(Editor && ((Editor.Builder && typeof Editor.Builder.on === 'function')
            || (Editor.Ipc && typeof Editor.Ipc.on === 'function'))),
        'creator.preview.start': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'
            && Editor.Dialog && typeof Editor.Dialog.messageBox === 'function'),
    };
    return contract.commands.map((command) => {
        if (command.execution === 'bridge') return { id: command.id, status: 'unavailable', reason: 'BRIDGE_OWNED_COMMAND' };
        const capability = { id: command.id, status: ready[command.id] ? 'available' : 'unavailable' };
        if (!ready[command.id]) capability.reason = 'CREATOR_API_UNAVAILABLE';
        return capability;
    });
}

function projectInfo() {
    const root = projectRoot();
    let metadata = {};
    try { metadata = JSON.parse(fs.readFileSync(path.join(root, 'project.json'), 'utf8')); } catch (_) {}
    const currentVersion = editorVersion();
    if (currentVersion !== EXPECTED_CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH', `Expected ${EXPECTED_CREATOR_VERSION}; detected ${currentVersion || 'unknown'}.`);
    return callScene('snapshot', { maxNodes: 1 }).catch(() => ({ sceneName: null, sceneUuid: null }))
        .then((scene) => { lastSceneName = scene.sceneName || null; return ({ projectRoot: root, projectName: typeof metadata.name === 'string' ? metadata.name : path.basename(root),
            creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
            activeScene: scene.sceneName || null, activeSceneUuid: scene.sceneUuid || null }); });
}

function searchProject(input) {
    const root = projectRoot();
    const assets = path.join(root, 'assets');
    if (!fs.existsSync(assets)) throw coded('ASSETS_DIRECTORY_MISSING');
    const assetsStat = fs.lstatSync(assets);
    if (!assetsStat.isDirectory() || assetsStat.isSymbolicLink()) throw coded('ASSETS_ROOT_UNSAFE');
    const query = input.query.toLocaleLowerCase();
    const scope = input.scope || 'all';
    const limit = input.limit || 20;
    const matches = [];
    let totalMatches = 0;
    let visited = 0;
    let scannedBytes = 0;
    let truncated = false;
    const codeExtensions = new Set(['.js', '.ts']);
    const ignored = new Set(['.git', 'node_modules', 'library', 'temp', 'local', 'build', 'settings']);
    function walk(directory, relative, depth) {
        if (depth > 14 || visited >= MAX_FILES) { truncated = true; return; }
        const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            if (visited >= MAX_FILES) { truncated = true; break; }
            if (entry.name.startsWith('.') || ignored.has(entry.name)) continue;
            const filename = path.join(directory, entry.name);
            const itemPath = relative ? `${relative}/${entry.name}` : entry.name;
            const stat = fs.lstatSync(filename);
            if (stat.isSymbolicLink()) continue;
            if (stat.isDirectory()) { walk(filename, itemPath, depth + 1); continue; }
            if (!stat.isFile() || entry.name.endsWith('.meta')) continue;
            visited += 1;
            const ext = path.extname(entry.name).toLowerCase();
            const isCode = codeExtensions.has(ext);
            if ((scope === 'code' && !isCode) || (scope === 'assets' && isCode)) continue;
            const pathHit = itemPath.toLocaleLowerCase().includes(query);
            let snippets = [];
            if (isCode && (scope === 'code' || scope === 'all') && stat.size <= 256 * 1024
                && scannedBytes + stat.size <= MAX_CODE_SCAN_BYTES) {
                scannedBytes += stat.size;
                const bytes = fs.readFileSync(filename);
                const source = bytes.toString('utf8');
                if (Buffer.from(source).equals(bytes)) snippets = source.split(/\r?\n/)
                    .flatMap((line, index) => line.toLocaleLowerCase().includes(query)
                        ? [{ line: index + 1, text: line.slice(0, 300) }] : []).slice(0, 3);
            } else if (isCode && (scope === 'code' || scope === 'all')) truncated = true;
            if (!pathHit && !snippets.length) continue;
            const result = { path: itemPath, kind: isCode ? 'code' : 'asset', sizeBytes: stat.size, nameMatch: pathHit };
            if (snippets.length) result.matches = snippets;
            try {
                const metaPath = `${filename}.meta`;
                const metaStat = fs.lstatSync(metaPath);
                if (metaStat.isFile() && !metaStat.isSymbolicLink() && metaStat.size <= 16384) {
                    const metaBytes = fs.readFileSync(metaPath);
                    const meta = JSON.parse(metaBytes.toString('utf8'));
                    result.uuid = typeof meta.uuid === 'string' ? meta.uuid : null;
                    result.importer = typeof meta.importer === 'string' ? meta.importer : null;
                    result.metaSha256 = fileHash(metaBytes);
                }
            } catch (_) {}
            totalMatches += 1;
            // Traversal is lexically sorted, so retaining only the requested
            // prefix bounds the response even in asset-heavy projects.
            if (matches.length < limit) matches.push(result);
        }
    }
    walk(assets, '', 0);
    return { query: input.query, scope, total: totalMatches, limit, truncated: truncated || totalMatches > limit, items: matches };
}

function searchAssets(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function') throw coded('ASSETDB_UNAVAILABLE');
    const query = (input.query || '').toLocaleLowerCase();
    const limit = input.limit || 30;
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_QUERY_TIMEOUT'));
        }, 12000);
        try {
            Editor.assetdb.queryAssets('db://assets/**/*', null, (error, rows) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error))); return; }
                if (!Array.isArray(rows)) { reject(coded('ASSETDB_RESULT_INVALID')); return; }
                const items = rows.filter((row) => row && typeof row.url === 'string' && row.url.startsWith('db://assets/'))
                    .filter((row) => !query || `${row.url} ${row.type || ''} ${row.uuid || ''}`.toLocaleLowerCase().includes(query))
                    .slice(0, limit).map((row) => ({ url: row.url, uuid: typeof row.uuid === 'string' ? row.uuid : null,
                        type: typeof row.type === 'string' ? row.type : null,
                        importer: typeof row.importer === 'string' ? row.importer : null }));
                resolve({ query: input.query || '', total: rows.length, returned: items.length,
                    truncated: rows.length > limit, items });
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error)));
        }
    });
}

function queryAssetByUrl(url) {
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function') throw coded('ASSETDB_QUERY_UNAVAILABLE');
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_QUERY_TIMEOUT'));
        }, 12000);
        try {
            Editor.assetdb.queryAssets(url, null, (error, rows) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error))); return; }
                if (!Array.isArray(rows)) { reject(coded('ASSETDB_RESULT_INVALID')); return; }
                resolve(rows.find((row) => row && row.url === url) || null);
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error)));
        }
    });
}

function readScript(input) {
    const relative = input.scriptPath;
    const filename = safeProjectFile(relative, /\.(?:js|ts)$/i);
    const metaFile = safeProjectFile(`${relative}.meta`);
    const sourceStat = fs.statSync(filename);
    const metaStat = fs.statSync(metaFile);
    if (sourceStat.size > MAX_SCRIPT_BYTES || metaStat.size > 16384) throw coded('SCRIPT_TOO_LARGE');
    const sourceBytes = fs.readFileSync(filename);
    const source = sourceBytes.toString('utf8');
    if (!Buffer.from(source).equals(sourceBytes)) throw coded('SCRIPT_NOT_UTF8');
    const metaBytes = fs.readFileSync(metaFile);
    const meta = JSON.parse(metaBytes.toString('utf8'));
    const expectedImporter = path.extname(relative).toLowerCase() === '.ts' ? 'typescript' : 'javascript';
    if (meta.importer !== expectedImporter || typeof meta.uuid !== 'string') throw coded('SCRIPT_METADATA_INVALID');
    return { scriptPath: relative, scriptType: expectedImporter, scriptUuid: meta.uuid,
        sourceSha256: fileHash(sourceBytes), metaSha256: fileHash(metaBytes), source };
}

function execute(command, input, context) {
    if (command === 'creator.project.info') return projectInfo();
    if (command === 'creator.project.search') return Promise.resolve(searchProject(input));
    if (command === 'creator.asset.search') return searchAssets(input);
    if (command === 'creator.script.read') return Promise.resolve(readScript(input));
    if (command === 'creator.scene.snapshot') return callScene('snapshot', { maxNodes: 100 });
    if (command === 'creator.scene.node.read') return callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (command === 'creator.scene.node.set-active.plan') return createSceneNodeActivePlan(input);
    if (command === 'creator.scene.node.set-active.commit') return commitSceneNodeActive(input, context);
    if (command === 'creator.scene.node.set-active.reconcile') return reconcileSceneNodeActive(input);
    if (command === 'creator.script.create.plan') return Promise.resolve(createScriptPlan(input));
    if (command === 'creator.script.create.commit') return commitScriptCreate(input, context);
    if (command === 'creator.script.create.reconcile') return Promise.resolve(reconcileScriptCreate(input));
    if (command === 'creator.diagnostics.read') return Promise.resolve(readDiagnostics(input));
    if (command === 'creator.preview.start') return startPreview(input, context);
    if (command.startsWith('creator.preview.')) throw coded('BRIDGE_OWNED_COMMAND');
    throw coded('UNKNOWN_COMMAND');
}

function pollLoop() {
    if (stopped || timer) return;
    timer = setTimeout(async () => {
        timer = null;
        try {
            const version = editorVersion();
            if (version !== EXPECTED_CREATOR_VERSION) throw coded('CREATOR_VERSION_MISMATCH', `Expected ${EXPECTED_CREATOR_VERSION}; detected ${version || 'unknown'}.`);
            const root = projectRoot();
            const state = readBridgeState();
            if (!state) { bridgeSession = null; pollLoop(); return; }
            if (!bridgeSession || bridgeSession.bridgeId !== state.bridgeId || bridgeSession.projectRoot !== root) {
                const registration = await requestJson(state, 'POST', '/v1/creator/register', {
                    instanceId: INSTANCE_ID, projectRoot: root, creatorVersion: version,
                    extensionVersion: extensionPackage.version, contractFingerprint: CONTRACT_FINGERPRINT,
                    capabilities: capabilityList(), activeScene: lastSceneName,
                }, 8000);
                bridgeSession = { bridgeId: state.bridgeId, sessionId: registration.sessionId, projectRoot: root };
                console.info(`[Cocos Creator Agent] Connected to local bridge for ${path.basename(root)} (${version}).`);
            }
            const result = await requestJson(state, 'POST', '/v1/creator/poll', {
                instanceId: INSTANCE_ID, sessionId: bridgeSession.sessionId, activeScene: lastSceneName,
            }, 30000);
            if (result && result.requestId) {
                let reply;
                try {
                    const output = await execute(result.command, result.input || {}, { requestId: result.requestId });
                    if (result.command === 'creator.scene.snapshot' && output && typeof output.sceneName === 'string') lastSceneName = output.sceneName;
                    if (result.command === 'creator.project.info' && output && typeof output.activeScene === 'string') lastSceneName = output.activeScene;
                    reply = { instanceId: INSTANCE_ID, sessionId: bridgeSession.sessionId,
                        requestId: result.requestId, ok: true, result: await output };
                } catch (error) {
                    reply = { instanceId: INSTANCE_ID, sessionId: bridgeSession.sessionId, requestId: result.requestId,
                        ok: false, error: { code: error.code || 'CREATOR_COMMAND_FAILED', message: String(error.message || error) } };
                }
                await requestJson(state, 'POST', '/v1/creator/respond', reply, 10000);
            }
            warned = '';
        } catch (error) {
            bridgeSession = null;
            const code = error.code || error.message || 'BRIDGE_CONNECT_FAILED';
            if (code !== warned && !stopped) {
                warned = code;
                console.warn(`[Cocos Creator Agent] Bridge unavailable (${String(code).slice(0, 120)}); retrying.`);
            }
        }
        pollLoop();
    }, bridgeSession ? 50 : 1500);
}

module.exports = {
    load() {
        stopped = false;
        timer = null;
        bridgeSession = null;
        setupDiagnosticListeners();
        pollLoop();
    },
    unload() {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
        if (activeRequest) activeRequest.destroy(coded('EXTENSION_UNLOADED'));
        activeRequest = null;
        removeDiagnosticListeners();
        bridgeSession = null;
    },
    messages: {
        showStatus() {
            const version = editorVersion() || 'unknown';
            const root = (() => { try { return projectRoot(); } catch (_) { return 'unavailable'; } })();
            console.info(`[Cocos Creator Agent] Creator ${version}; project ${root}; third-party bridge session ${bridgeSession ? 'connected' : 'waiting'}.`);
        },
    },
};
