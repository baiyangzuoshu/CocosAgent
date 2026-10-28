'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const extensionPackage = require('./package.json');
const authorizeCommit = require('./commit-authorization.cjs');
const { sceneAssetIdentityMatches, inspectSceneAssetIdentity, inspectSceneComposition, inspectSavedSceneNode, componentValueForDisk,
    validComponentDiskValue, sceneDiskTransformMatches } = require('./scene-persistence.cjs');
const { orderCreatedSubtreesForDeletion } = require('./scene-compose-compensation.cjs');
const { inspectPrefabSource: inspectPrefabSourceData } = require('./prefab-source.cjs');
const prefabPatch = require('./prefab-patch.cjs');
const prefabInstanceOperations = require('./prefab-instance-operations.cjs');
const editorScriptEval = require('./editor-script-eval.cjs');
const { scanAssetReferences } = require('./asset-references.cjs');
const assetImportOperations = require('./asset-import-operations.cjs');
const diagnosticAssets = require('./diagnostics-assets.cjs');
const contract = require('./command-contract.json');
const { normalizeProvider, validateArguments, canonical, PROVIDER_ID, COMMAND_ID } = require('./provider-contract.cjs');

const EXPECTED_CREATOR_VERSION = contract.creatorVersion;
const SUPPORTED_CREATOR_VERSIONS = new Set(contract.supportedCreatorVersions || []);
function isSupportedCreatorVersion(version) { return SUPPORTED_CREATOR_VERSIONS.has(version); }
const PROTOCOL_VERSION = '0.1';
const STATE_FILE = path.join(os.homedir(), '.cocos-creator-agent', 'third-party-bridge.json');
const OPERATION_DIRECTORY = path.join(os.homedir(), '.cocos-creator-agent', 'creator-operations');
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_FILES = 12000;
const MAX_CODE_SCAN_BYTES = 32 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 128 * 1024;
const MAX_WRITE_SOURCE_BYTES = 16 * 1024;
const MAX_ASSET_IMPORT_BYTES = 32 * 1024 * 1024;
const MAX_ASSET_TRACKED_BYTES = 128 * 1024 * 1024;
const MAX_TEXTURE_META_BYTES = 16 * 1024;
const MAX_SCENE_SERIALIZATION_BYTES = 16 * 1024 * 1024;
const MAX_SCENE_META_BYTES = 16 * 1024;
const MAX_SCENE_ASSET_CANDIDATES = 1024;
const MAX_SCENE_ASSET_SCAN_BYTES = 128 * 1024 * 1024;
const MAX_PREFAB_SERIALIZATION_BYTES = 8 * 1024 * 1024;
const MAX_PREFAB_META_BYTES = 16 * 1024;
const SCENE_SAVE_READBACK_TIMEOUT_MS = 15000;
const ASSET_DELETE_READBACK_TIMEOUT_MS = 10000;
const OPERATION_FILE_MAX_BYTES = 512 * 1024;
const OPERATION_TTL_MS = 15 * 60 * 1000;
const MAX_PROVIDER_PACKAGES = 16;
const MAX_PROVIDER_COMMANDS = 128;
const PROVIDER_IPC_TIMEOUT_MS = 800;
const UI_EVENT_PROPERTIES = Object.freeze({
    'cc.Button': ['clickEvents'], 'cc.Toggle': ['clickEvents', 'checkEvents'], 'cc.ToggleContainer': ['checkEvents'],
    'cc.Slider': ['slideEvents'], 'cc.ScrollView': ['scrollEvents'], 'cc.PageView': ['scrollEvents', 'pageEvents'],
    'cc.EditBox': ['editingDidBegan', 'textChanged', 'editingDidEnded', 'editingReturn'],
});
function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function creatorNodeId() {
    try {
        const generator = typeof Editor !== 'undefined' && Editor.Utils && Editor.Utils.UuidUtils;
        if (generator && typeof generator.uuid === 'function') {
            const value = generator.uuid();
            if (typeof value === 'string' && /^[A-Za-z0-9_+/=-]{1,128}$/.test(value)) return value;
        }
    } catch (_) {}
    return uuid();
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
let creatorIpcEmitter = null;
let prefabEditModeApiAvailable = false;

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

function mainProcessIpcEmitter() {
    // Creator broadcasts use its IPC listener bus, not Electron ipcMain's raw channels.
    if (Editor && typeof Editor.IpcListener === 'function') {
        if (!creatorIpcEmitter) {
            const subscriptions = [];
            creatorIpcEmitter = {
                on(eventName, listener) {
                    const ipc = new Editor.IpcListener();
                    ipc.on(eventName, listener);
                    subscriptions.push({ eventName, listener, ipc });
                },
                removeListener(eventName, listener) {
                    for (let index = subscriptions.length - 1; index >= 0; index -= 1) {
                        const entry = subscriptions[index];
                        if (entry.eventName !== eventName || entry.listener !== listener) continue;
                        entry.ipc.clear();
                        subscriptions.splice(index, 1);
                        break;
                    }
                },
            };
        }
        return creatorIpcEmitter;
    }
    try {
        const electron = require('electron');
        if (electron && electron.ipcMain && typeof electron.ipcMain.on === 'function') return electron.ipcMain;
    } catch (_) {}
    return Editor && Editor.Ipc && typeof Editor.Ipc.on === 'function' ? Editor.Ipc : null;
}

function setupDiagnosticListeners() {
    for (const eventName of ['compile-finished', 'build-finished']) {
        addDiagnosticListener(Editor && Editor.Builder, eventName, (...args) => {
            const safe = args.map((item) => diagnosticValue(item, 0));
            latestCompile = { event: eventName, at: new Date().toISOString(), details: safe };
            recordDiagnostic('creator-builder', 'info', [eventName, ...safe]);
        });
    }
    const ipcEmitter = mainProcessIpcEmitter();
    addDiagnosticListener(ipcEmitter, 'scene:ready', () => { refreshPrefabEditModeCapability(); });
    addDiagnosticListener(ipcEmitter, 'asset-db:script-import-failed', (...args) => {
        recordIpcDiagnostic('creator-assetdb', 'error', args);
    });
    for (const level of ['log', 'info', 'warn', 'error', 'success', 'failed']) {
        addDiagnosticListener(ipcEmitter, `editor:renderer-console-${level}`, (...args) => {
            recordIpcDiagnostic('creator-console', level === 'failed' ? 'error' : level, args);
        });
    }
}

async function refreshPrefabEditModeCapability() {
    prefabEditModeApiAvailable = false;
    if (!Editor || !Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function'
        || !Editor.Ipc || typeof Editor.Ipc.sendToAll !== 'function' || !mainProcessIpcEmitter()) return false;
    try {
        const state = await callScene('prefabEditModeState', {}, 10000);
        prefabEditModeApiAvailable = !!(state && state.available === true && state.saveAvailable === true
            && state.popAvailable === true && typeof state.modeName === 'string');
    } catch (_) { prefabEditModeApiAvailable = false; }
    return prefabEditModeApiAvailable;
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

async function readDomainDiagnosticsSnapshot(input) {
    const scene = await callScene('snapshot', { maxNodes: input.maxNodes || 100 }, 10000);
    if (!scene || scene.available !== true) return { schemaVersion: 1, available: false,
        reason: scene && scene.reason || 'SCENE_SNAPSHOT_UNAVAILABLE', source: 'creator-editor',
        instanceId: INSTANCE_ID, projectRoot: projectRoot(), creatorVersion: editorVersion(), scene };
    const collected = diagnosticAssets.collectDiagnosticAssetUuids(scene.nodes || []);
    const assetIndex = diagnosticAssets.queryDiagnosticAssets(collected.assetUuids,
        Editor && Editor.assetdb, collected.complete);
    let projectName = path.basename(projectRoot());
    try {
        const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot(), 'project.json'), 'utf8'));
        if (typeof metadata.name === 'string' && metadata.name) projectName = metadata.name;
    } catch (_) {}
    return { schemaVersion: 1, available: true, source: 'creator-editor', capturedAt: new Date().toISOString(),
        instanceId: INSTANCE_ID, projectRoot: projectRoot(), projectName, creatorVersion: editorVersion(),
        domains: input.domains, scene, assetIndex };
}


async function startPreview(input, context) {
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_PREVIEW_IPC_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const scene = await callScene('snapshot', { maxNodes: 1 });
    if (!scene || scene.available !== true || typeof scene.sceneName !== 'string' || typeof scene.sceneUuid !== 'string')
        throw coded('ACTIVE_SCENE_IDENTITY_UNAVAILABLE');
    const approved = await authorizeCommit();
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

function safeProjectExtensionScript(relative) {
    if (typeof relative !== 'string' || relative.length > 512 || relative.includes('\\') || relative.includes('\0')
        || !relative.startsWith('packages/') || !/\.js$/i.test(relative)) throw coded('UNSAFE_EDITOR_SCRIPT_PATH');
    const parts = relative.split('/');
    const editorScriptsIndex = parts.indexOf('editor-scripts');
    if (parts.length < 4 || parts[0] !== 'packages' || editorScriptsIndex < 2
        || editorScriptsIndex === parts.length - 1
        || parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.')))
        throw coded('UNSAFE_EDITOR_SCRIPT_PATH');
    const root = projectRoot();
    const packages = path.join(root, 'packages');
    const packagesStat = fs.lstatSync(packages);
    if (!packagesStat.isDirectory() || packagesStat.isSymbolicLink()) throw coded('UNSAFE_EDITOR_SCRIPT_PATH');
    let current = packages;
    for (let index = 1; index < parts.length; index += 1) {
        current = path.join(current, parts[index]);
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
            throw coded('UNSAFE_EDITOR_SCRIPT_PATH');
    }
    const real = fs.realpathSync(current);
    if (!real.startsWith(`${packages}${path.sep}`)) throw coded('UNSAFE_EDITOR_SCRIPT_PATH');
    return current;
}

function readProjectExtensionScript(relative) {
    const filename = safeProjectExtensionScript(relative);
    let fd;
    try {
        fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        const before = fs.fstatSync(fd);
        if (!before.isFile() || before.size > editorScriptEval.MAX_SOURCE_BYTES)
            throw coded('EDITOR_SCRIPT_SOURCE_INVALID');
        const buffer = Buffer.alloc(editorScriptEval.MAX_SOURCE_BYTES + 1);
        let bytesRead = 0;
        while (bytesRead < buffer.length) {
            const count = fs.readSync(fd, buffer, bytesRead, buffer.length - bytesRead, bytesRead);
            if (!count) break;
            bytesRead += count;
        }
        const after = fs.fstatSync(fd);
        if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
            || before.mtimeMs !== after.mtimeMs || bytesRead !== before.size)
            throw coded('EDITOR_SCRIPT_SOURCE_CHANGED');
        if (bytesRead > editorScriptEval.MAX_SOURCE_BYTES) throw coded('EDITOR_SCRIPT_SOURCE_INVALID');
        const bytes = buffer.subarray(0, bytesRead);
        const source = bytes.toString('utf8');
        if (!Buffer.from(source, 'utf8').equals(bytes)) throw coded('EDITOR_SCRIPT_SOURCE_INVALID');
        return source;
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
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

function readScriptModifyOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.script.modify' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation || typeof operation.planHash !== 'string'
        || typeof plan.projectRoot !== 'string' || typeof plan.creatorVersion !== 'string'
        || typeof plan.extensionVersion !== 'string' || typeof plan.contractFingerprint !== 'string'
        || typeof plan.creatorInstanceId !== 'string' || typeof plan.scriptPath !== 'string'
        || typeof plan.targetUrl !== 'string' || typeof plan.scriptUuid !== 'string' || typeof plan.importer !== 'string'
        || typeof plan.metaSha256 !== 'string' || !plan.expectedBefore || typeof plan.expectedBefore !== 'object'
        || typeof plan.expectedBefore.sourceSha256 !== 'string' || typeof plan.expectedBefore.metaSha256 !== 'string'
        || plan.expectedBefore.metaSha256 !== plan.metaSha256
        || typeof plan.expectedAfter !== 'object' || !plan.expectedAfter
        || typeof plan.expectedAfter.sourceSha256 !== 'string' || !Number.isInteger(plan.expectedAfter.sourceBytes)
        || !Number.isInteger(plan.compileCursor) || typeof plan.expiresAt !== 'string'
        || typeof operation.source !== 'string' || typeof operation.beforeSource !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (fileHash(Buffer.from(operation.source, 'utf8')) !== plan.expectedAfter.sourceSha256
        || Buffer.byteLength(operation.source, 'utf8') !== plan.expectedAfter.sourceBytes
        || fileHash(Buffer.from(operation.beforeSource, 'utf8')) !== plan.expectedBefore.sourceSha256)
        throw coded('OPERATION_SOURCE_HASH_MISMATCH');
    return operation;
}

function readScriptRecompileOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.script.recompile' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.scriptPath !== 'string' || typeof plan.targetUrl !== 'string'
        || typeof plan.scriptUuid !== 'string' || typeof plan.importer !== 'string'
        || typeof plan.sourceSha256 !== 'string' || typeof plan.metaSha256 !== 'string'
        || !Number.isInteger(plan.compileCursor) || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'failed', 'unconfirmed', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readAssetImportOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.asset.import' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sourcePath !== 'string' || typeof plan.sourceRealPath !== 'string'
        || typeof plan.assetPath !== 'string' || typeof plan.targetUrl !== 'string'
        || typeof plan.sourceSha256 !== 'string' || !Number.isInteger(plan.sourceBytes)
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readAssetMoveOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    const before = plan && plan.expectedBefore;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.asset.move' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sourceAssetPath !== 'string' || typeof plan.sourceUrl !== 'string'
        || typeof plan.destinationAssetPath !== 'string' || typeof plan.destinationUrl !== 'string'
        || !before || typeof before.assetUuid !== 'string' || typeof before.fileSha256 !== 'string'
        || typeof before.metaSha256 !== 'string' || typeof before.metaImporter !== 'string'
        || typeof before.assetType !== 'string' || typeof before.assetImporter !== 'string'
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readAssetDeleteOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    const before = plan && plan.expectedBefore;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.asset.delete' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.assetPath !== 'string' || typeof plan.assetUrl !== 'string'
        || !before || typeof before.assetUuid !== 'string' || typeof before.fileSha256 !== 'string'
        || typeof before.metaSha256 !== 'string' || typeof before.metaImporter !== 'string'
        || typeof before.assetType !== 'string' || typeof before.assetImporter !== 'string'
        || (before.subAssets !== undefined && (!Array.isArray(before.subAssets) || before.subAssets.length > 64
            || before.subAssets.some((item) => !item || typeof item.url !== 'string'
                || typeof item.uuid !== 'string' || typeof item.type !== 'string')))
        || !plan.referenceScan || plan.referenceScan.complete !== true || plan.referenceScan.referenceCount !== 0
        || typeof plan.referenceScan.scannedFiles !== 'number' || typeof plan.referenceScan.textBytes !== 'number'
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readTextureImportSettingsOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.asset.import-settings' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.assetPath !== 'string' || typeof plan.assetUrl !== 'string'
        || typeof plan.assetUuid !== 'string' || !plan.expectedBefore || !plan.expectedAfter
        || typeof plan.expectedBefore.fileSha256 !== 'string' || typeof plan.expectedBefore.metaSha256 !== 'string'
        || typeof plan.expectedBefore.assetUuid !== 'string' || typeof plan.expectedBefore.assetImporter !== 'string'
        || typeof plan.expectedBefore.assetType !== 'string' || typeof plan.expectedBefore.metaImporter !== 'string'
        || !plan.expectedMeta || !plan.expectedMeta.before || !plan.expectedMeta.after
        || typeof plan.expectedMeta.before !== 'object' || Array.isArray(plan.expectedMeta.before)
        || typeof plan.expectedMeta.after !== 'object' || Array.isArray(plan.expectedMeta.after)
        || !plan.expectedAfter.settings || typeof plan.expectedAfter.settings !== 'object'
        || !plan.changedFields || typeof plan.changedFields !== 'object' || Array.isArray(plan.changedFields)
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readPrefabCreateOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.prefab.create' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUuid !== 'string' || typeof plan.sceneName !== 'string'
        || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || typeof plan.prefabPath !== 'string' || typeof plan.targetUrl !== 'string'
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readPrefabSourcePatchOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.prefab.source.patch' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || !prefabPatch.UUID.test(plan.prefabUuid || '') || typeof plan.prefabPath !== 'string'
        || typeof plan.targetUrl !== 'string' || typeof plan.activeSceneUuid !== 'string'
        || typeof plan.targetNodePath !== 'string' || !prefabPatch.NODE_ID.test(plan.targetNodeUuid || '')
        || !['apply', 'compensate', 'replay'].includes(plan.action)
        || !prefabPatch.SHA256.test(plan.expectedSourceSha256 || '')
        || !prefabPatch.SHA256.test(plan.expectedMetaSha256 || '')
        || !prefabPatch.validateDiff(plan.expectedDiff)
        || !plan.expectedBeforeNode || typeof plan.expectedBeforeNode !== 'object'
        || plan.expectedBeforeNode.nodeUuid !== plan.targetNodeUuid
        || plan.expectedBeforeNode.nodePath !== plan.targetNodePath
        || !prefabPatch.matchesDiff(plan.expectedBeforeNode, plan.expectedDiff, 'before')
        || (plan.action === 'apply' && plan.sourceOperationId !== null)
        || (plan.action !== 'apply' && !/^[0-9a-f-]{36}$/i.test(plan.sourceOperationId || ''))
        || (plan.sourceOperationId !== null && !/^[0-9a-f-]{36}$/i.test(plan.sourceOperationId || ''))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-started', 'mutation-applied',
            'save-requested', 'source-saved', 'mode-reopened', 'completed', 'not-applied',
            'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readPrefabInstanceOverrideOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.prefab.instance.override' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || !prefabInstanceOperations.validPrefabInstanceOverridePlan(plan)
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUrl !== 'string' || typeof plan.sceneName !== 'string'
        || typeof plan.selectedNodePath !== 'string' || typeof plan.prefabPath !== 'string'
        || typeof plan.prefabRootPath !== 'string' || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'mutation-started',
            'effect-observed', 'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
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
        || (plan.diskBefore !== undefined && !validSceneNodeDiskBaseline(plan.diskBefore))
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneNodeTransformOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    const before = plan && plan.expectedBefore;
    const after = plan && plan.expectedAfter;
    const fields = before && typeof before === 'object' && !Array.isArray(before) ? Object.keys(before).sort() : [];
    const diskTransformFields = ['anchorX', 'anchorY', 'angle', 'height', 'scaleX', 'scaleY', 'width', 'x', 'y', 'z'];
    const diskBefore = plan && plan.diskBefore;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.set-transform' || !plan || plan.operation !== operation.operation
        || plan.operationId !== operationId || typeof operation.planHash !== 'string'
        || typeof plan.projectRoot !== 'string' || typeof plan.creatorVersion !== 'string'
        || typeof plan.extensionVersion !== 'string' || typeof plan.contractFingerprint !== 'string'
        || typeof plan.creatorInstanceId !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || !before || !after || fields.length < 1 || fields.length > 10
        || fields.some((field) => !['x', 'y', 'z', 'scaleX', 'scaleY', 'angle', 'width', 'height', 'anchorX', 'anchorY'].includes(field)
            || !Number.isFinite(before[field]) || Math.abs(before[field]) > 1000000
            || !Number.isFinite(after[field]) || Math.abs(after[field]) > 1000000
            || (['width', 'height'].includes(field) && after[field] < 0) || before[field] === after[field])
        || Object.keys(after).sort().join(',') !== fields.join(',') || typeof plan.expiresAt !== 'string'
        || (diskBefore !== undefined && (!diskBefore || typeof diskBefore !== 'object' || Array.isArray(diskBefore)
            || typeof diskBefore.sceneUrl !== 'string' || !diskBefore.sceneUrl.startsWith('db://assets/')
            || diskBefore.importer !== 'scene' || !prefabPatch.SHA256.test(diskBefore.sourceSha256 || '')
            || !prefabPatch.SHA256.test(diskBefore.metaSha256 || '') || typeof diskBefore.active !== 'boolean'
            || !diskBefore.transform || typeof diskBefore.transform !== 'object' || Array.isArray(diskBefore.transform)
            || Object.keys(diskBefore.transform).sort().join(',') !== diskTransformFields.join(',')
            || diskTransformFields.some((field) => !Number.isFinite(diskBefore.transform[field])
                || Math.abs(diskBefore.transform[field]) > 1000000)))
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function validButtonEventList(events, { allowUnbound = false } = {}) {
    return Array.isArray(events) && events.length <= 12 && events.every((event) => event && typeof event === 'object'
        && !Array.isArray(event) && Object.keys(event).sort().join(',') === 'component,customEventData,handler,targetUuid'
        && (event.targetUuid === null && allowUnbound || typeof event.targetUuid === 'string'
            && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(event.targetUuid)
                || /^[A-Za-z0-9+/]{22,23}$/.test(event.targetUuid)))
        && typeof event.component === 'string' && event.component.length <= 120
        && typeof event.handler === 'string' && event.handler.length <= 64
        && typeof event.customEventData === 'string' && event.customEventData.length <= 512);
}

function readSceneButtonEventsOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.button-events.set' || !plan || plan.operation !== operation.operation
        || plan.operationId !== operationId || typeof operation.planHash !== 'string'
        || typeof plan.projectRoot !== 'string' || typeof plan.creatorVersion !== 'string'
        || typeof plan.extensionVersion !== 'string' || typeof plan.contractFingerprint !== 'string'
        || typeof plan.creatorInstanceId !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || typeof plan.componentInstanceId !== 'string' || !validButtonEventList(plan.expectedBefore, { allowUnbound: true })
        || !validButtonEventList(plan.expectedAfter) || sceneComponentValuesEqual(plan.expectedBefore, plan.expectedAfter)
        || (plan.diskBefore !== undefined && (!validSceneNodeDiskBaseline(plan.diskBefore)
            || !Array.isArray(plan.diskBefore.buttonEvents)))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneUiEventsOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    const componentEvents = plan && plan.diskBefore && plan.diskBefore.componentEvents;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.ui-events.set' || !plan || plan.operation !== operation.operation
        || plan.operationId !== operationId || typeof operation.planHash !== 'string'
        || typeof plan.projectRoot !== 'string' || typeof plan.creatorVersion !== 'string'
        || typeof plan.extensionVersion !== 'string' || typeof plan.contractFingerprint !== 'string'
        || typeof plan.creatorInstanceId !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || typeof plan.componentClassName !== 'string'
        || !(UI_EVENT_PROPERTIES[plan.componentClassName] || []).includes(plan.eventProperty)
        || typeof plan.serializedClassId !== 'string' || typeof plan.componentInstanceId !== 'string'
        || !validButtonEventList(plan.expectedBefore, { allowUnbound: true })
        || !validButtonEventList(plan.expectedAfter) || sceneComponentValuesEqual(plan.expectedBefore, plan.expectedAfter)
        || !componentEvents || componentEvents.componentInstanceId !== plan.componentInstanceId
        || componentEvents.serializedClassId !== plan.serializedClassId || componentEvents.eventProperty !== plan.eventProperty
        || !validButtonEventList(componentEvents.events, { allowUnbound: true })
        || !validSceneNodeDiskBaseline(plan.diskBefore)
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (!sceneComponentValuesEqual(componentEvents.events, plan.expectedBefore))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneNodeDeleteOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    const before = plan && plan.expectedBefore;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.delete' || !plan || plan.operation !== operation.operation
        || plan.operationId !== operationId || typeof operation.planHash !== 'string'
        || typeof plan.projectRoot !== 'string' || typeof plan.creatorVersion !== 'string'
        || typeof plan.extensionVersion !== 'string' || typeof plan.contractFingerprint !== 'string'
        || typeof plan.creatorInstanceId !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string' || !before
        || typeof before.nodeName !== 'string' || typeof before.nodePath !== 'string'
        || typeof before.parentUuid !== 'string' || !Number.isInteger(before.childCount) || before.childCount < 0
        || !Array.isArray(before.subtree) || before.subtree.length < 1 || before.subtree.length > 256
        || (plan.diskBefore !== undefined && (!validSceneNodeDiskBaseline(plan.diskBefore)
            || !Array.isArray(plan.diskBefore.subtree)
            || JSON.stringify(plan.diskBefore.subtree) !== JSON.stringify(before.subtree)))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneComponentRemoveOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.remove-component' || !plan || plan.operation !== operation.operation
        || plan.operationId !== operationId || typeof operation.planHash !== 'string'
        || typeof plan.projectRoot !== 'string' || typeof plan.creatorVersion !== 'string'
        || typeof plan.extensionVersion !== 'string' || typeof plan.contractFingerprint !== 'string'
        || typeof plan.creatorInstanceId !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string'
        || typeof plan.nodePath !== 'string' || typeof plan.componentClassName !== 'string'
        || typeof plan.componentInstanceId !== 'string' || !plan.expectedBefore || plan.expectedBefore.present !== true
        || !Array.isArray(plan.expectedBefore.dependentComponents) || plan.expectedBefore.dependentComponents.length !== 0
        || (plan.diskBefore !== undefined && (!validSceneNodeDiskBaseline(plan.diskBefore)
            || !Array.isArray(plan.diskBefore.components)
            || typeof plan.serializedClassId !== 'string' || !plan.serializedClassId
            || !plan.diskBefore.components.some((component) => component.componentInstanceId === plan.componentInstanceId
                && component.serializedClassId === plan.serializedClassId)))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneNodeRenameOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.rename' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUuid !== 'string' || typeof plan.sceneName !== 'string'
        || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || !plan.expectedBefore || !plan.expectedAfter
        || typeof plan.expectedBefore.name !== 'string' || typeof plan.expectedBefore.parentUuid !== 'string'
        || typeof plan.expectedBefore.nodePath !== 'string'
        || typeof plan.expectedAfter.name !== 'string' || typeof plan.expectedAfter.parentUuid !== 'string'
        || typeof plan.expectedAfter.nodePath !== 'string'
        || plan.expectedBefore.name === plan.expectedAfter.name
        || plan.expectedBefore.parentUuid !== plan.expectedAfter.parentUuid
        || (plan.diskBefore !== undefined && !validSceneNodeDiskBaseline(plan.diskBefore))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneNodeReparentOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    const before = plan && plan.expectedBefore;
    const after = plan && plan.expectedAfter;
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.reparent' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUuid !== 'string' || typeof plan.sceneName !== 'string'
        || typeof plan.nodeUuid !== 'string' || !before || !after
        || ['nodeName', 'nodePath', 'parentUuid', 'parentPath', 'targetParentUuid', 'targetParentPath', 'afterNodePath']
            .some((key) => typeof before[key] !== 'string' || typeof after[key] !== 'string')
        || before.nodeName !== after.nodeName || before.parentUuid === after.parentUuid
        || before.targetParentUuid !== after.targetParentUuid || before.targetParentPath !== after.targetParentPath
        || before.afterNodePath !== after.afterNodePath || after.nodePath !== after.afterNodePath
        || after.parentUuid !== after.targetParentUuid || after.parentPath !== after.targetParentPath
        || (plan.diskBefore !== undefined && !validSceneNodeDiskBaseline(plan.diskBefore))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneComponentOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.add-component' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.sceneUuid !== 'string'
        || typeof plan.sceneName !== 'string' || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || typeof plan.componentClassName !== 'string' || !plan.expectedBefore || !plan.expectedAfter
        || !Number.isInteger(plan.expectedBefore.componentCount) || plan.expectedBefore.componentCount !== 0
        || !Number.isInteger(plan.expectedAfter.componentCount) || plan.expectedAfter.componentCount !== 1
        || (plan.diskBefore !== undefined && (!validSceneNodeDiskBaseline(plan.diskBefore)
            || !Array.isArray(plan.diskBefore.components)
            || typeof plan.serializedClassId !== 'string' || !plan.serializedClassId
            || plan.diskBefore.components.some((component) => component.serializedClassId === plan.serializedClassId)))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function validSceneComponentValue(value, depth = 0) {
    if (depth > 1) return false;
    if (typeof value === 'string') return Buffer.byteLength(value, 'utf8') <= 1024;
    if (typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= 1000000000;
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.kind !== 'string') return false;
    const keys = Object.keys(value).sort().join(',');
    if (value.kind === 'vec2') return keys === 'kind,x,y'
        && ['x', 'y'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'vec3') return keys === 'kind,x,y,z'
        && ['x', 'y', 'z'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'vec4') return keys === 'kind,w,x,y,z'
        && ['x', 'y', 'z', 'w'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'rect') return keys === 'height,kind,width,x,y'
        && ['x', 'y', 'width', 'height'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'size') return keys === 'height,kind,width'
        && ['width', 'height'].every((field) => Number.isFinite(value[field]) && Math.abs(value[field]) <= 1000000);
    if (value.kind === 'color') return keys === 'a,b,g,kind,r'
        && ['r', 'g', 'b', 'a'].every((field) => Number.isInteger(value[field]) && value[field] >= 0 && value[field] <= 255);
    if (value.kind === 'array') return keys === 'items,kind' && Array.isArray(value.items)
        && value.items.length <= 32 && value.items.every((item) => typeof item === 'string'
            ? Buffer.byteLength(item, 'utf8') <= 1024 : typeof item === 'boolean'
              || (typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1000000000)
              || (validSceneComponentValue(item, depth + 1) && item.kind !== 'array'));
    if (value.kind === 'asset') return (keys === 'assetClass,kind' || keys === 'assetClass,assetUuid,kind')
        && typeof value.assetClass === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(value.assetClass)
        && (value.assetUuid === undefined || (typeof value.assetUuid === 'string'
            && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.assetUuid)
                || /^[A-Za-z0-9+/]{22,23}$/.test(value.assetUuid))));
    if (value.kind === 'node-ref') return (keys === 'kind' || keys === 'kind,nodeUuid')
        && (value.nodeUuid === undefined || typeof value.nodeUuid === 'string'
            && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.nodeUuid)
                || /^[A-Za-z0-9+/]{22,23}$/.test(value.nodeUuid)));
    if (value.kind === 'component-ref') return (keys === 'componentClassName,kind'
        || keys === 'componentClassName,componentInstanceId,kind,nodeUuid')
        && typeof value.componentClassName === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]{0,119}$/.test(value.componentClassName)
        && (value.nodeUuid === undefined || typeof value.nodeUuid === 'string'
            && (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.nodeUuid)
                || /^[A-Za-z0-9+/]{22,23}$/.test(value.nodeUuid)))
        && (value.componentInstanceId === undefined || typeof value.componentInstanceId === 'string'
            && value.componentInstanceId.length > 0 && value.componentInstanceId.length <= 128);
    return false;
}

function sceneComponentValuesEqual(left, right) {
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return Object.is(left, right);
    function normalize(value) {
        if (Array.isArray(value)) return value.map(normalize);
        if (!value || typeof value !== 'object') return value;
        const result = {};
        for (const key of Object.keys(value).sort()) result[key] = normalize(value[key]);
        return result;
    }
    try { return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right)); }
    catch (_) { return false; }
}

function sceneNodePathsMatch(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') return false;
    const leftParts = left.split('/');
    const rightParts = right.split('/');
    return leftParts.length === rightParts.length
        && leftParts.slice(1).every((part, index) => part === rightParts[index + 1]);
}

function prefabNodePathsMatch(actual, expected) {
    if (typeof actual !== 'string' || typeof expected !== 'string') return false;
    const actualParts = actual.split('/');
    const expectedParts = expected.split('/');
    return actualParts.length >= expectedParts.length
        && expectedParts.every((part, index) => actualParts[actualParts.length - expectedParts.length + index] === part);
}

function sceneComponentValueKind(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value.kind : typeof value;
}

function readSceneComponentPropertyOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || typeof operation !== 'object' || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.node.set-component-property' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUuid !== 'string' || typeof plan.sceneName !== 'string'
        || typeof plan.nodeUuid !== 'string' || typeof plan.nodePath !== 'string'
        || typeof plan.componentClassName !== 'string' || typeof plan.componentInstanceId !== 'string'
        || typeof plan.property !== 'string' || !plan.expectedBefore || !plan.expectedAfter
        || typeof plan.propertyKind !== 'string' || !validSceneComponentValue(plan.expectedBefore.value)
        || !validSceneComponentValue(plan.expectedAfter.value)
        || sceneComponentValueKind(plan.expectedBefore.value) !== plan.propertyKind
        || sceneComponentValueKind(plan.expectedAfter.value) !== plan.propertyKind
        || (plan.propertyKind === 'asset' && plan.expectedBefore.value.assetClass !== plan.expectedAfter.value.assetClass)
        || (sceneComponentValuesEqual(plan.expectedBefore.value, plan.expectedAfter.value)
            && plan.restoreSerializedOmission !== true)
        || (plan.restoreSerializedOmission === true
            && !['node-ref', 'component-ref', 'asset'].includes(plan.propertyKind))
        || (plan.diskBefore !== undefined && (!validSceneNodeDiskBaseline(plan.diskBefore)
            || !validSavedComponentProperty(plan.diskBefore.componentProperty)
            || plan.diskBefore.componentProperty.componentInstanceId !== plan.componentInstanceId
            || plan.diskBefore.componentProperty.property !== plan.property
            || !validComponentDiskValue(plan.expectedAfter.serializedValue)))
        || (plan.compensationFor !== undefined && (!plan.compensationFor || typeof plan.compensationFor !== 'object'
            || !/^[0-9a-f-]{36}$/i.test(plan.compensationFor.sourceOperationId || '')
            || !/^[a-f0-9]{64}$/.test(plan.compensationFor.sourcePlanHash || '')))
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'completed', 'not-applied', 'save-required', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function readSceneComposeOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.compose' || !plan || typeof plan !== 'object'
        || plan.operationId !== operationId || plan.operation !== operation.operation
        || typeof operation.planHash !== 'string' || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUuid !== 'string' || typeof plan.sceneName !== 'string'
        || !plan.request || !Array.isArray(plan.request.nodes) || !Array.isArray(plan.request.components)
        || (plan.request.buttonEvents !== undefined && !Array.isArray(plan.request.buttonEvents))
        || (plan.request.uiEvents !== undefined && !Array.isArray(plan.request.uiEvents))
        || !Array.isArray(plan.assetIdentities)
        || !plan.expectedState || typeof plan.expiresAt !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'mutation-applied',
            'save-requested', 'save-unconfirmed', 'completed', 'not-applied', 'save-required', 'needs-reconciliation', 'conflict'].includes(operation.status))
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

function assetTargetPaths(relative) {
    if (typeof relative !== 'string' || relative.length > 240 || relative.includes('\\') || relative.includes('\0')
        || !/^(?!\/)(?!.*\/\/)(?!.*(?:^|\/)\.\.?($|\/))(?!.*(?:^|\/)\.)[^\\]+\.[A-Za-z0-9]{1,10}$/.test(relative))
        throw coded('UNSAFE_PROJECT_PATH');
    const parts = relative.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..' || part.startsWith('.')))
        throw coded('UNSAFE_PROJECT_PATH');
    const root = projectRoot();
    const assets = path.join(root, 'assets');
    const assetsStat = fs.lstatSync(assets);
    if (!assetsStat.isDirectory() || assetsStat.isSymbolicLink()) throw coded('ASSETS_ROOT_UNSAFE');
    let current = assets;
    for (let index = 0; index < parts.length - 1; index += 1) {
        current = path.join(current, parts[index]);
        let stat;
        try { stat = fs.lstatSync(current); }
        catch (error) { if (error.code === 'ENOENT') throw coded('ASSET_IMPORT_PARENT_DIRECTORY_MISSING'); throw error; }
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded('UNSAFE_PROJECT_PATH');
    }
    const filename = path.join(assets, ...parts);
    const metaFilename = `${filename}.meta`;
    const url = `db://${['assets', ...parts].join('/')}`;
    return { root, assets, filename, metaFilename, url, extension: path.extname(relative).toLowerCase() };
}

function safeNewAssetTarget(relative) {
    const target = assetTargetPaths(relative);
    const { filename, metaFilename, url } = target;
    for (const candidate of [filename, metaFilename]) {
        try {
            const stat = fs.lstatSync(candidate);
            if (stat.isSymbolicLink()) throw coded('UNSAFE_PROJECT_PATH');
            throw coded(candidate === filename ? 'ASSET_IMPORT_TARGET_ALREADY_EXISTS' : 'ASSET_IMPORT_META_ALREADY_EXISTS');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!Editor.assetdb || typeof Editor.assetdb.exists !== 'function') throw coded('ASSETDB_EXISTS_UNAVAILABLE');
    if (Editor.assetdb.exists(url)) throw coded('ASSET_IMPORT_TARGET_ALREADY_EXISTS');
    return target;
}

function inspectImportSource(sourcePath, projectRootPath) {
    if (typeof sourcePath !== 'string' || sourcePath.length > 4096 || sourcePath.includes('\0')
        || /[\r\n]/.test(sourcePath) || !path.isAbsolute(sourcePath)) throw coded('ASSET_IMPORT_SOURCE_PATH_INVALID');
    let initialStat;
    try { initialStat = fs.lstatSync(sourcePath); }
    catch (error) { if (error.code === 'ENOENT') throw coded('ASSET_IMPORT_SOURCE_NOT_FOUND'); throw error; }
    if (!initialStat.isFile() || initialStat.isSymbolicLink()) throw coded('ASSET_IMPORT_SOURCE_UNSAFE');
    const realPath = fs.realpathSync(sourcePath);
    if (realPath === projectRootPath || realPath.startsWith(`${projectRootPath}${path.sep}`))
        throw coded('ASSET_IMPORT_SOURCE_INSIDE_PROJECT');
    const before = fs.statSync(realPath);
    if (!before.isFile() || before.size < 1 || before.size > MAX_ASSET_IMPORT_BYTES)
        throw coded('ASSET_IMPORT_SOURCE_SIZE_INVALID');
    const bytes = fs.readFileSync(realPath);
    const after = fs.statSync(realPath);
    if (bytes.length !== before.size || before.dev !== after.dev || before.ino !== after.ino
        || before.size !== after.size || before.mtimeMs !== after.mtimeMs)
        throw coded('ASSET_IMPORT_SOURCE_CHANGED');
    return { realPath, sourceBytes: bytes.length, sourceSha256: fileHash(bytes), extension: path.extname(realPath).toLowerCase() };
}

function verifyAssetImportPlan(operation, { requireCurrentContract = true, requireAbsent = true, verifySource = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    let source = null;
    if (verifySource) {
        source = inspectImportSource(plan.sourcePath, plan.projectRoot);
        if (source.realPath !== plan.sourceRealPath || source.sourceBytes !== plan.sourceBytes
            || source.sourceSha256 !== plan.sourceSha256 || source.extension !== plan.extension)
            throw coded('ASSET_IMPORT_SOURCE_CHANGED');
    }
    const target = requireAbsent ? safeNewAssetTarget(plan.assetPath) : assetTargetPaths(plan.assetPath);
    if (target.root !== plan.projectRoot || target.url !== plan.targetUrl || target.extension !== plan.extension)
        throw coded('ASSET_IMPORT_TARGET_CHANGED');
    return { source, target };
}

async function createAssetImportPlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.import !== 'function'
        || typeof Editor.assetdb.queryAssets !== 'function') throw coded('ASSETDB_IMPORT_UNAVAILABLE');
    const root = projectRoot();
    const version = editorVersion();
    if (!isSupportedCreatorVersion(version)) throw coded('CREATOR_VERSION_MISMATCH');
    const target = safeNewAssetTarget(input.assetPath);
    const source = inspectImportSource(input.sourcePath, root);
    if (!source.extension || source.extension !== target.extension) throw coded('ASSET_IMPORT_EXTENSION_MISMATCH');
    const existing = await queryAssetByUrl(target.url);
    if (existing) throw coded('ASSET_IMPORT_TARGET_ALREADY_EXISTS');
    if (projectRoot() !== root || editorVersion() !== version) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.asset.import', projectRoot: root, creatorVersion: version,
        extensionVersion: extensionPackage.version, contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID, sourcePath: input.sourcePath, sourceRealPath: source.realPath,
        assetPath: input.assetPath, targetUrl: target.url, extension: target.extension,
        sourceBytes: source.sourceBytes, sourceSha256: source.sourceSha256,
        expectedBefore: { assetExists: false, fileExists: false, metaExists: false },
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: root, creatorVersion: version, creatorInstanceId: INSTANCE_ID,
        sourcePath: plan.sourcePath, assetPath: plan.assetPath, targetUrl: plan.targetUrl,
        sourceBytes: plan.sourceBytes, sourceSha256: plan.sourceSha256, expiresAt: plan.expiresAt,
        diff: { action: 'import-asset', source: { path: plan.sourcePath, bytes: plan.sourceBytes, sha256: plan.sourceSha256 },
            target: { url: plan.targetUrl, before: 'absent', after: 'Creator AssetDB import' } },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.asset.import.reconcile',
            metaHandling: 'Creator AssetDB generates and owns the target .meta; the operation never fabricates or replaces it.' } };
}


function importedAssetReadback(operation) {
    const plan = operation.plan;
    const target = safeProjectFile(plan.assetPath);
    const metaFile = safeProjectFile(`${plan.assetPath}.meta`);
    const sourceBytes = fs.readFileSync(target);
    const metaBytes = fs.readFileSync(metaFile);
    if (sourceBytes.length !== plan.sourceBytes || fileHash(sourceBytes) !== plan.sourceSha256)
        throw coded('ASSET_IMPORT_SOURCE_READBACK_MISMATCH');
    if (metaBytes.length > 16384) throw coded('ASSET_IMPORT_META_TOO_LARGE');
    let meta;
    try { meta = JSON.parse(metaBytes.toString('utf8')); }
    catch (_) { throw coded('ASSET_IMPORT_META_INVALID'); }
    if (!meta || typeof meta.uuid !== 'string' || !meta.uuid) throw coded('ASSET_IMPORT_META_UUID_MISSING');
    return { assetPath: plan.assetPath, targetUrl: plan.targetUrl, assetUuid: meta.uuid,
        sourceBytes: sourceBytes.length, sourceSha256: fileHash(sourceBytes), metaSha256: fileHash(metaBytes) };
}

async function waitForImportedAssetReadback(operation, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    let lastPendingError = null;
    do {
        const asset = await queryAssetByUrl(operation.plan.targetUrl);
        if (asset) {
            try {
                const readback = importedAssetReadback(operation);
                if (typeof asset.uuid !== 'string' || asset.uuid !== readback.assetUuid)
                    throw coded('ASSETDB_READBACK_IDENTITY_MISMATCH');
                return { asset, readback };
            } catch (error) {
                if (!assetImportOperations.isPendingAssetImportReadback(error)) throw error;
                lastPendingError = error;
            }
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
    } while (Date.now() <= deadline);
    throw coded('ASSET_IMPORT_READBACK_TIMEOUT', lastPendingError && lastPendingError.code || 'AssetDB import did not settle');
}

function createTemporaryImportSource(assetPath, sourceBytes) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-creator-agent-import-'));
    const filename = path.posix.basename(assetPath);
    const sourcePath = path.join(directory, filename);
    try {
        fs.writeFileSync(sourcePath, sourceBytes, { flag: 'wx', mode: 0o600 });
        const stat = fs.lstatSync(sourcePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== sourceBytes.length
            || fileHash(fs.readFileSync(sourcePath)) !== fileHash(sourceBytes))
            throw coded('ASSET_IMPORT_TEMP_SOURCE_MISMATCH');
    } catch (error) {
        try { fs.unlinkSync(sourcePath); } catch (_) {}
        try { fs.rmdirSync(directory); } catch (_) {}
        throw error;
    }
    return { sourcePath, targetFolderUrl: path.posix.dirname(`db://${['assets', ...assetPath.split('/')].join('/')}`), directory };
}

function cleanupTemporaryImportSource(source) {
    if (!source || typeof source !== 'object') return;
    try { fs.unlinkSync(source.sourcePath); } catch (_) {}
    try { fs.rmdirSync(source.directory); } catch (_) {}
}

function importAssetThroughAssetDb(sourcePath, targetFolderUrl) {
    if (!Editor.assetdb || typeof Editor.assetdb.import !== 'function') throw coded('ASSETDB_IMPORT_UNAVAILABLE');
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_IMPORT_TIMEOUT'));
        }, 60000);
        try {
            Editor.assetdb.import([sourcePath], targetFolderUrl, (error, results) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_IMPORT_FAILED', String(error.message || error))); return; }
                resolve(Array.isArray(results) ? results : (results ? [results] : []));
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_IMPORT_FAILED', String(error.message || error)));
        }
    });
}

function assetImportReceipt(operation, readback) {
    const plan = operation.plan;
    const result = readback || operation.assetReadback || null;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, sourcePath: plan.sourcePath, assetPath: plan.assetPath,
        targetUrl: plan.targetUrl, sourceBytes: plan.sourceBytes, sourceSha256: plan.sourceSha256,
        assetUuid: result && result.assetUuid || operation.assetUuid || null,
        assetType: operation.assetType || null, importer: operation.importer || null,
        metaSha256: result && result.metaSha256 || operation.metaSha256 || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        effectObservedAt: operation.effectObservedAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.asset.import.reconcile',
            compensationAvailable: false,
            compensationCondition: 'Delete only through Creator AssetDB after rechecking URL, UUID, asset SHA-256, and .meta SHA-256.' } };
}

async function commitAssetImport(input, context) {
    const operation = readAssetImportOperation(input.operationId);
    verifyAssetImportPlan(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { verifyAssetImportPlan(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'ASSET_IMPORT_PRECONDITION_FAILED'; writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    try {
        const bytes = fs.readFileSync(operation.plan.sourceRealPath);
        if (bytes.length !== operation.plan.sourceBytes || fileHash(bytes) !== operation.plan.sourceSha256)
            throw coded('ASSET_IMPORT_SOURCE_CHANGED');
        const temporarySource = createTemporaryImportSource(operation.plan.assetPath, bytes);
        try {
            const createdRows = await importAssetThroughAssetDb(temporarySource.sourcePath, temporarySource.targetFolderUrl);
            const { asset, readback } = await waitForImportedAssetReadback(operation);
            if (createdRows.length && !createdRows.some((row) => row && row.url === operation.plan.targetUrl
                && (!row.uuid || row.uuid === asset.uuid))) throw coded('ASSETDB_IMPORT_IDENTITY_MISMATCH');
            operation.status = 'completed'; operation.completedAt = new Date().toISOString();
            operation.completedByInstanceId = INSTANCE_ID; operation.assetUuid = asset.uuid;
            operation.assetType = typeof asset.type === 'string' ? asset.type : null;
            operation.importer = typeof asset.importer === 'string' ? asset.importer : null;
            operation.metaSha256 = readback.metaSha256; operation.assetReadback = readback; writeOperation(operation);
            return assetImportReceipt(operation, readback);
        } finally {
            cleanupTemporaryImportSource(temporarySource);
        }
    } catch (error) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = error.code || 'ASSET_IMPORT_RESULT_UNCERTAIN';
        operation.failureAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
}

async function reconcileAssetImport(input) {
    const operation = readAssetImportOperation(input.operationId);
    verifyAssetImportPlan(operation, { requireCurrentContract: false, requireAbsent: false, verifySource: false });
    if (projectRoot() !== operation.plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    let asset = null;
    let readback = null;
    let filePresent = false;
    let metaPresent = false;
    try {
        const target = assetTargetPaths(operation.plan.assetPath);
        for (const [candidate, key] of [[target.filename, 'file'], [target.metaFilename, 'meta']]) {
            try {
                const stat = fs.lstatSync(candidate);
                if (!stat.isFile() || stat.isSymbolicLink()) throw coded('ASSET_IMPORT_TARGET_UNSAFE');
                if (key === 'file') filePresent = true;
                else metaPresent = true;
            } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        asset = await queryAssetByUrl(operation.plan.targetUrl);
        if (asset) readback = importedAssetReadback(operation);
    } catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'ASSET_IMPORT_READBACK_FAILED'; writeOperation(operation);
        return { ...assetImportReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    if (!asset && !filePresent && !metaPresent && ['applying', 'needs-reconciliation'].includes(operation.status))
        operation.status = 'not-applied';
    else if (!asset && (filePresent || metaPresent)) {
        operation.status = 'conflict'; operation.reconcileReason = 'ASSET_IMPORT_PARTIAL_TARGET_PRESENT';
    }
    else if (asset && readback && asset.uuid === readback.assetUuid
        && assetImportOperations.canCompleteAssetImport(operation)) {
        operation.status = 'completed'; operation.assetUuid = asset.uuid;
        operation.assetType = typeof asset.type === 'string' ? asset.type : null;
        operation.importer = typeof asset.importer === 'string' ? asset.importer : null;
        operation.metaSha256 = readback.metaSha256; operation.assetReadback = readback;
        operation.completedAt = operation.completedAt || new Date().toISOString();
        operation.completedByInstanceId = operation.completedByInstanceId || INSTANCE_ID;
    } else if (asset || readback || operation.status === 'completed') {
        operation.status = 'conflict'; operation.reconcileReason = 'ASSET_IMPORT_TARGET_CHANGED';
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...assetImportReceipt(operation, readback), observed: { assetPresent: !!asset,
        filePresent, metaPresent, assetUuid: asset && asset.uuid || null, assetReadback: readback },
        retry: 'Never replay this operation; create a new plan only after reviewing the target.' };
}

function readAssetFiles(assetPath) {
    const target = assetTargetPaths(assetPath);
    let fileStat = null;
    let metaStat = null;
    for (const [filename, key] of [[target.filename, 'file'], [target.metaFilename, 'meta']]) {
        try {
            const stat = fs.lstatSync(filename);
            if (!stat.isFile() || stat.isSymbolicLink()) throw coded('ASSET_FILE_UNSAFE');
            if (key === 'file') fileStat = stat;
            else metaStat = stat;
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!fileStat && !metaStat) return null;
    if (!fileStat || !metaStat || metaStat.size > 16384) throw coded('ASSET_FILE_PAIR_INVALID');
    if (fileStat.size > MAX_ASSET_TRACKED_BYTES) throw coded('ASSET_FILE_TOO_LARGE');
    const fileBytes = fs.readFileSync(target.filename);
    const metaBytes = fs.readFileSync(target.metaFilename);
    let meta;
    try { meta = JSON.parse(metaBytes.toString('utf8')); }
    catch (_) { throw coded('ASSET_META_INVALID'); }
    if (!meta || typeof meta.uuid !== 'string' || !meta.uuid) throw coded('ASSET_META_UUID_MISSING');
    return { root: target.root, url: target.url, assetPath, fileBytes: fileBytes.length,
        fileSha256: fileHash(fileBytes), metaSha256: fileHash(metaBytes), assetUuid: meta.uuid,
        metaIdentitySha256: assetMetaIdentityHash(meta, assetPath),
        metaImporter: typeof meta.importer === 'string' ? meta.importer : '' };
}

function assetMetaIdentityHash(meta, assetPath) {
    const basename = path.posix.basename(assetPath, path.posix.extname(assetPath));
    const subMetas = meta && meta.subMetas;
    if (subMetas && typeof subMetas === 'object' && !Array.isArray(subMetas)
        && Object.prototype.hasOwnProperty.call(subMetas, basename)) {
        const marker = '__creator_asset_basename__';
        if (!Object.prototype.hasOwnProperty.call(subMetas, marker)) {
            const normalized = JSON.parse(JSON.stringify(meta));
            normalized.subMetas[marker] = normalized.subMetas[basename];
            delete normalized.subMetas[basename];
            return fileHash(Buffer.from(canonical(normalized), 'utf8'));
        }
    }
    return fileHash(Buffer.from(canonical(meta), 'utf8'));
}

async function readAssetLocation(assetPath, url) {
    const files = readAssetFiles(assetPath);
    const asset = await queryAssetByUrl(url);
    if (!files && !asset) return null;
    if (!files || !asset || typeof asset.uuid !== 'string' || asset.uuid !== files.assetUuid)
        throw coded('ASSET_LOCATION_IDENTITY_MISMATCH');
    return { ...files, assetType: typeof asset.type === 'string' ? asset.type : '',
        assetImporter: typeof asset.importer === 'string' ? asset.importer : '' };
}

function assetMoveStateMatches(actual, expected, { allowPathDerivedMetaKey = false } = {}) {
    return !!actual && actual.assetUuid === expected.assetUuid && actual.fileSha256 === expected.fileSha256
        && (allowPathDerivedMetaKey && expected.metaIdentitySha256
            ? actual.metaIdentitySha256 === expected.metaIdentitySha256 : actual.metaSha256 === expected.metaSha256)
        && actual.metaImporter === expected.metaImporter
        && actual.assetType === expected.assetType && actual.assetImporter === expected.assetImporter;
}

async function verifyAssetMoveBefore(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    const sourceTarget = assetTargetPaths(plan.sourceAssetPath);
    const destinationTarget = assetTargetPaths(plan.destinationAssetPath);
    if (sourceTarget.root !== plan.projectRoot || sourceTarget.url !== plan.sourceUrl
        || destinationTarget.root !== plan.projectRoot || destinationTarget.url !== plan.destinationUrl
        || sourceTarget.extension !== destinationTarget.extension) throw coded('ASSET_MOVE_TARGET_CHANGED');
    const source = await readAssetLocation(plan.sourceAssetPath, plan.sourceUrl);
    if (!assetMoveStateMatches(source, plan.expectedBefore)) throw coded('ASSET_MOVE_PRECONDITION_FAILED');
    const destination = await readAssetLocation(plan.destinationAssetPath, plan.destinationUrl);
    if (destination) throw coded('ASSET_MOVE_DESTINATION_EXISTS');
    return { sourceTarget, destinationTarget, source };
}

async function createAssetMovePlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.move !== 'function'
        || typeof Editor.assetdb.queryAssets !== 'function') throw coded('ASSETDB_MOVE_UNAVAILABLE');
    const root = projectRoot();
    const version = editorVersion();
    if (!isSupportedCreatorVersion(version)) throw coded('CREATOR_VERSION_MISMATCH');
    const sourceTarget = assetTargetPaths(input.sourceAssetPath);
    const destinationTarget = assetTargetPaths(input.destinationAssetPath);
    if (sourceTarget.root !== root || destinationTarget.root !== root) throw coded('OPERATION_PROJECT_MISMATCH');
    if (sourceTarget.url === destinationTarget.url) throw coded('ASSET_MOVE_NO_CHANGE');
    if (sourceTarget.extension !== destinationTarget.extension) throw coded('ASSET_MOVE_EXTENSION_MISMATCH');
    const source = await readAssetLocation(input.sourceAssetPath, sourceTarget.url);
    if (!source) throw coded('ASSET_MOVE_SOURCE_NOT_FOUND');
    if (source.assetType === 'folder' || (typeof Editor.assetdb.isSubAsset === 'function'
        && Editor.assetdb.isSubAsset(sourceTarget.url))) throw coded('ASSET_MOVE_SUB_ASSET_UNSUPPORTED');
    const destination = await readAssetLocation(input.destinationAssetPath, destinationTarget.url);
    if (destination) throw coded('ASSET_MOVE_DESTINATION_EXISTS');
    if (projectRoot() !== root || editorVersion() !== version) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const expectedBefore = { assetUuid: source.assetUuid, fileSha256: source.fileSha256,
        metaSha256: source.metaSha256, metaIdentitySha256: source.metaIdentitySha256,
        metaImporter: source.metaImporter,
        assetType: source.assetType, assetImporter: source.assetImporter };
    const plan = { operationId, operation: 'creator.asset.move', projectRoot: root,
        creatorVersion: version, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sourceAssetPath: input.sourceAssetPath, sourceUrl: sourceTarget.url,
        destinationAssetPath: input.destinationAssetPath, destinationUrl: destinationTarget.url,
        expectedBefore, expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: root, creatorVersion: version, creatorInstanceId: INSTANCE_ID,
        sourceAssetPath: plan.sourceAssetPath, sourceUrl: plan.sourceUrl,
        destinationAssetPath: plan.destinationAssetPath, destinationUrl: plan.destinationUrl,
        expectedBefore, expectedAfter: { assetUuid: expectedBefore.assetUuid, fileSha256: expectedBefore.fileSha256,
            metaIdentitySha256: expectedBefore.metaIdentitySha256, metaImporter: expectedBefore.metaImporter,
            assetType: expectedBefore.assetType, assetImporter: expectedBefore.assetImporter,
            assetPath: plan.destinationAssetPath, url: plan.destinationUrl },
        expiresAt: plan.expiresAt,
        diff: { action: 'move-or-rename-asset', assetUuid: expectedBefore.assetUuid,
            before: { path: plan.sourceAssetPath, url: plan.sourceUrl },
            after: { path: plan.destinationAssetPath, url: plan.destinationUrl },
            fileSha256: expectedBefore.fileSha256, metaIdentitySha256: expectedBefore.metaIdentitySha256 },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.asset.move.reconcile',
            identityPreservedBy: 'Creator AssetDB move; .meta and UUID read back after the operation.' } };
}


function moveAssetThroughAssetDb(sourceUrl, destinationUrl) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_MOVE_TIMEOUT'));
        }, 60000);
        const finish = (error, rows) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error) { reject(coded('ASSETDB_MOVE_FAILED', String(error.message || error))); return; }
            if (rows !== undefined && !Array.isArray(rows)) { reject(coded('ASSETDB_MOVE_RESULT_INVALID')); return; }
            resolve(rows || []);
        };
        try {
            const result = Editor.assetdb.move(sourceUrl, destinationUrl, finish);
            if (result && typeof result.then === 'function') result.then((rows) => finish(null, rows), finish);
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_MOVE_FAILED', String(error.message || error)));
        }
    });
}

function assetMoveReceipt(operation, state) {
    const plan = operation.plan;
    const after = state || operation.assetReadback || null;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        assetUuid: plan.expectedBefore.assetUuid,
        before: { assetPath: plan.sourceAssetPath, url: plan.sourceUrl, ...plan.expectedBefore },
        after: after ? { assetPath: plan.destinationAssetPath, url: plan.destinationUrl,
            fileSha256: after.fileSha256, metaSha256: after.metaSha256,
            metaIdentitySha256: after.metaIdentitySha256, metaImporter: after.metaImporter,
            assetType: after.assetType, assetImporter: after.assetImporter, assetUuid: after.assetUuid } : null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedAt: operation.completedAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.asset.move.reconcile',
            note: 'Reconciliation observes both AssetDB paths and file/.meta identities; it never repeats the move.' } };
}

async function commitAssetMove(input, context) {
    const operation = readAssetMoveOperation(input.operationId);
    await verifyAssetMoveBefore(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'needs-reconciliation'].includes(operation.status)
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    operation.status = 'applying'; operation.approvalRequestedAt = new Date().toISOString(); writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { await verifyAssetMoveBefore(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'ASSET_MOVE_PRECONDITION_FAILED'; writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    try {
        await moveAssetThroughAssetDb(operation.plan.sourceUrl, operation.plan.destinationUrl);
        const source = await readAssetLocation(operation.plan.sourceAssetPath, operation.plan.sourceUrl);
        const destination = await readAssetLocation(operation.plan.destinationAssetPath, operation.plan.destinationUrl);
        if (source || !assetMoveStateMatches(destination, operation.plan.expectedBefore,
            { allowPathDerivedMetaKey: true }))
            throw coded('ASSET_MOVE_READBACK_MISMATCH');
        operation.status = 'completed'; operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID; operation.assetReadback = destination; writeOperation(operation);
        return assetMoveReceipt(operation, destination);
    } catch (error) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = error.code || 'ASSET_MOVE_RESULT_UNCERTAIN';
        operation.failureAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
}

async function reconcileAssetMove(input) {
    const operation = readAssetMoveOperation(input.operationId);
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    let source = null;
    let destination = null;
    try {
        source = await readAssetLocation(plan.sourceAssetPath, plan.sourceUrl);
        destination = await readAssetLocation(plan.destinationAssetPath, plan.destinationUrl);
    } catch (error) {
        operation.status = 'conflict'; operation.reconcileReason = error.code || 'ASSET_MOVE_READBACK_FAILED';
    }
    if (!operation.reconcileReason) {
        if (assetMoveStateMatches(source, plan.expectedBefore) && !destination) {
            if (['applying', 'needs-reconciliation'].includes(operation.status)) operation.status = 'not-applied';
        } else if (!source && assetMoveStateMatches(destination, plan.expectedBefore,
            { allowPathDerivedMetaKey: true })
            && ['applying', 'needs-reconciliation', 'completed'].includes(operation.status)) {
            operation.status = 'completed'; operation.assetReadback = destination;
            operation.completedAt = operation.completedAt || new Date().toISOString();
            operation.completedByInstanceId = operation.completedByInstanceId || INSTANCE_ID;
        } else {
            operation.status = 'conflict'; operation.reconcileReason = 'ASSET_MOVE_STATE_AMBIGUOUS';
        }
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...assetMoveReceipt(operation, destination && !source ? destination : null),
        observed: { sourcePresent: !!source, destinationPresent: !!destination,
            sourceAssetUuid: source && source.assetUuid || null,
            destinationAssetUuid: destination && destination.assetUuid || null },
        ...(operation.reconcileReason ? { reason: operation.reconcileReason } : {}),
        retry: 'Never replay this move; create a new plan only after reviewing both paths.' };
}

function readAssetMetaSubAssets(assetPath, assetUrl) {
    const target = assetTargetPaths(assetPath);
    const meta = JSON.parse(fs.readFileSync(target.metaFilename, 'utf8'));
    const subMetas = meta && meta.subMetas;
    if (subMetas === undefined) return [];
    if (!subMetas || typeof subMetas !== 'object' || Array.isArray(subMetas))
        throw coded('ASSET_DELETE_SUB_ASSET_IDENTITY_MISMATCH');
    return Object.entries(subMetas).map(([key, value]) => {
        if (!key || key.includes('/') || key.includes('\\') || !value || typeof value.uuid !== 'string'
            || !value.uuid || typeof value.importer !== 'string') throw coded('ASSET_DELETE_SUB_ASSET_IDENTITY_MISMATCH');
        return { url: `${assetUrl}/${key}`, uuid: value.uuid, type: value.importer };
    }).sort((a, b) => a.url.localeCompare(b.url));
}

function queryAssetSubAssets(assetUrl) {
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function'
        || typeof Editor.assetdb.isSubAsset !== 'function') throw coded('ASSETDB_QUERY_UNAVAILABLE');
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_QUERY_TIMEOUT'));
        }, 20000);
        try {
            Editor.assetdb.queryAssets('db://assets/**/*', null, (error, rows) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error))); return; }
                if (!Array.isArray(rows)) { reject(coded('ASSETDB_RESULT_INVALID')); return; }
                const prefix = `${assetUrl}/`;
                const candidates = rows.filter((row) => row && typeof row.url === 'string' && row.url.startsWith(prefix));
                if (candidates.length > 64 || candidates.some((row) => !Editor.assetdb.isSubAsset(row.url)
                    || typeof row.uuid !== 'string' || typeof row.type !== 'string')) {
                    reject(coded('ASSET_DELETE_SUB_ASSET_IDENTITY_MISMATCH'));
                    return;
                }
                resolve(candidates.map((row) => ({ url: row.url, uuid: row.uuid, type: row.type }))
                    .sort((a, b) => a.url.localeCompare(b.url)));
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error)));
        }
    });
}

function sameAssetSubAssets(actual, expected) {
    const left = Array.isArray(actual) ? actual : [];
    const right = Array.isArray(expected) ? expected : [];
    return left.length === right.length && left.every((item, index) => item.url === right[index].url
        && item.uuid === right[index].uuid && item.type === right[index].type);
}

function scanAssetDeleteReferences(root, assetPath, assetUuid, subAssets = []) {
    const ignorePaths = [assetPath, `${assetPath}.meta`];
    const uuids = [assetUuid, ...subAssets.map((item) => item.uuid)];
    let firstScan = null;
    for (const uuidValue of [...new Set(uuids)]) {
        const scan = scanAssetReferences(path.join(root, 'assets'), uuidValue, { ignorePaths });
        if (!firstScan) firstScan = scan;
        if (!scan.complete) throw coded('ASSET_DELETE_REFERENCE_SCAN_INCOMPLETE',
            `Scanned ${scan.scannedFiles} files and ${scan.textBytes} text bytes; delete is refused unless every main and sub-asset reference scan is complete.`);
        if (scan.references.length) throw coded('ASSET_DELETE_HAS_REFERENCES',
            `${uuidValue}: ${scan.references.slice(0, 12).map((item) => `${item.assetPath} (${item.occurrences})`).join(', ')}`);
    }
    return { ...(firstScan || { complete: true, references: [], scannedFiles: 0, textBytes: 0, binaryFiles: 0 }),
        assetUuidCount: uuids.length };
}

async function verifyAssetDeleteBefore(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    const target = assetTargetPaths(plan.assetPath);
    if (target.root !== plan.projectRoot || target.url !== plan.assetUrl) throw coded('ASSET_DELETE_TARGET_CHANGED');
    if (!Editor.assetdb || typeof Editor.assetdb.delete !== 'function'
        || typeof Editor.assetdb.isSubAsset !== 'function' || typeof Editor.assetdb.containsSubAssets !== 'function')
        throw coded('ASSETDB_DELETE_UNAVAILABLE');
    if (Editor.assetdb.isSubAsset(plan.assetUrl)) throw coded('ASSET_DELETE_SUB_ASSET_UNSUPPORTED');
    const source = await readAssetLocation(plan.assetPath, plan.assetUrl);
    if (!assetMoveStateMatches(source, plan.expectedBefore)) throw coded('ASSET_DELETE_PRECONDITION_FAILED');
    if (source.assetType === 'folder') throw coded('ASSET_DELETE_FILE_ONLY');
    const subAssets = await queryAssetSubAssets(plan.assetUrl);
    const metaSubAssets = readAssetMetaSubAssets(plan.assetPath, plan.assetUrl);
    if (!sameAssetSubAssets(subAssets, metaSubAssets)
        || !sameAssetSubAssets(subAssets, plan.expectedBefore.subAssets || []))
        throw coded('ASSET_DELETE_SUB_ASSET_IDENTITY_MISMATCH');
    const referenceScan = scanAssetDeleteReferences(plan.projectRoot, plan.assetPath, source.assetUuid, subAssets);
    return { target, source, subAssets, referenceScan };
}

async function createAssetDeletePlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function'
        || typeof Editor.assetdb.delete !== 'function' || typeof Editor.assetdb.isSubAsset !== 'function'
        || typeof Editor.assetdb.containsSubAssets !== 'function') throw coded('ASSETDB_DELETE_UNAVAILABLE');
    const root = projectRoot();
    const version = editorVersion();
    if (!isSupportedCreatorVersion(version)) throw coded('CREATOR_VERSION_MISMATCH');
    const asset = await queryAssetByUuid(input.assetUuid);
    if (!asset) throw coded('ASSET_UUID_NOT_FOUND');
    if (asset.isSubAsset === true || Editor.assetdb.isSubAsset(asset.url)) throw coded('ASSET_DELETE_SUB_ASSET_UNSUPPORTED');
    if (typeof asset.url !== 'string' || !asset.url.startsWith('db://assets/')) throw coded('ASSET_DELETE_URL_UNSUPPORTED');
    const assetPath = asset.url.slice('db://assets/'.length);
    const source = await readAssetLocation(assetPath, asset.url);
    if (!source || source.assetUuid !== input.assetUuid) throw coded('ASSET_DELETE_SOURCE_IDENTITY_MISMATCH');
    if (source.assetType === 'folder') throw coded('ASSET_DELETE_FILE_ONLY');
    const subAssets = await queryAssetSubAssets(asset.url);
    const metaSubAssets = readAssetMetaSubAssets(assetPath, asset.url);
    if (!sameAssetSubAssets(subAssets, metaSubAssets)) throw coded('ASSET_DELETE_SUB_ASSET_IDENTITY_MISMATCH');
    const referenceScan = scanAssetDeleteReferences(root, assetPath, input.assetUuid, subAssets);
    if (projectRoot() !== root || editorVersion() !== version) throw coded('CREATOR_IDENTITY_CHANGED');
    const expectedBefore = { assetUuid: source.assetUuid, fileBytes: source.fileBytes,
        fileSha256: source.fileSha256, metaSha256: source.metaSha256, metaImporter: source.metaImporter,
        assetType: source.assetType, assetImporter: source.assetImporter, subAssets };
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.asset.delete', projectRoot: root,
        creatorVersion: version, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        assetPath, assetUrl: asset.url, expectedBefore,
        referenceScan: { complete: true, referenceCount: 0, scannedFiles: referenceScan.scannedFiles,
            textBytes: referenceScan.textBytes, binaryFiles: referenceScan.binaryFiles,
            assetUuidCount: referenceScan.assetUuidCount },
        expectedAfter: { filePresent: false, metaPresent: false, assetPresent: false },
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: root, creatorVersion: version, creatorInstanceId: INSTANCE_ID,
        assetPath, assetUrl: plan.assetUrl, expectedBefore, referenceScan: plan.referenceScan,
        expiresAt: plan.expiresAt,
        diff: { action: 'delete-asset', irreversible: true, assetUuid: expectedBefore.assetUuid,
            before: { assetPath, assetUrl: plan.assetUrl, fileSha256: expectedBefore.fileSha256,
                metaSha256: expectedBefore.metaSha256, subAssetUuids: subAssets.map((item) => item.uuid) }, after: 'asset, sub-assets, and .meta absent',
            inboundReferences: 0, skippedBinaryFiles: referenceScan.binaryFiles },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.asset.delete.reconcile',
            note: 'Deletion uses Creator AssetDB. The operation verifies the exact .meta/AssetDB sub-asset set and refuses incomplete scans or references to any main/sub-asset UUID.' } };
}


function deleteAssetThroughAssetDb(url) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_DELETE_TIMEOUT'));
        }, 60000);
        const finish = (error, rows) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error) { reject(coded('ASSETDB_DELETE_FAILED', String(error.message || error))); return; }
            if (rows !== undefined && !Array.isArray(rows)) { reject(coded('ASSETDB_DELETE_RESULT_INVALID')); return; }
            resolve(rows || []);
        };
        try {
            const result = Editor.assetdb.delete([url], finish);
            if (result && typeof result.then === 'function') result.then((rows) => finish(null, rows), finish);
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_DELETE_FAILED', String(error.message || error)));
        }
    });
}

async function waitForAssetDeleteReadback(plan, timeoutMs = ASSET_DELETE_READBACK_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    let observed = null;
    do {
        const files = readAssetFiles(plan.assetPath);
        const asset = await queryAssetByUrl(plan.assetUrl);
        const subAssets = await queryAssetSubAssets(plan.assetUrl);
        observed = { filePresent: !!files, metaPresent: !!files, assetPresent: !!asset,
            assetUuid: asset && asset.uuid || files && files.assetUuid || null, subAssets };
        if (!files && !asset && subAssets.length === 0) return observed;
        if (Date.now() >= deadline) throw coded('ASSET_DELETE_READBACK_MISMATCH');
        await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    throw coded('ASSET_DELETE_READBACK_MISMATCH', JSON.stringify(observed));
}

function assetDeleteReceipt(operation, observed = null) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        assetPath: plan.assetPath, assetUrl: plan.assetUrl, assetUuid: plan.expectedBefore.assetUuid,
        expectedBefore: plan.expectedBefore, observed,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedAt: operation.completedAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.asset.delete.reconcile',
            note: 'Reconciliation observes AssetDB, file, and .meta state and never repeats deletion.' } };
}

async function commitAssetDelete(input, context) {
    const operation = readAssetDeleteOperation(input.operationId);
    await verifyAssetDeleteBefore(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'needs-reconciliation'].includes(operation.status)
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    operation.status = 'applying'; operation.approvalRequestedAt = new Date().toISOString(); writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { await verifyAssetDeleteBefore(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'ASSET_DELETE_PRECONDITION_FAILED'; writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    try {
        await deleteAssetThroughAssetDb(operation.plan.assetUrl);
        const observed = await waitForAssetDeleteReadback(operation.plan);
        operation.status = 'completed'; operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID; operation.deletedAssetUuid = operation.plan.expectedBefore.assetUuid;
        delete operation.reconcileReason;
        writeOperation(operation);
        return assetDeleteReceipt(operation, observed);
    } catch (error) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = error.code || 'ASSET_DELETE_RESULT_UNCERTAIN';
        operation.failureAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
}

async function reconcileAssetDelete(input) {
    const operation = readAssetDeleteOperation(input.operationId);
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    let files = null;
    let asset = null;
    let subAssets = [];
    let readbackFailure = null;
    try {
        files = readAssetFiles(plan.assetPath);
        asset = await queryAssetByUrl(plan.assetUrl);
        subAssets = await queryAssetSubAssets(plan.assetUrl);
    } catch (error) {
        readbackFailure = error.code || 'ASSET_DELETE_READBACK_FAILED';
    }
    let observed = { filePresent: !!files, metaPresent: !!files, assetPresent: !!asset,
        assetUuid: asset && asset.uuid || files && files.assetUuid || null, subAssets };
    if (readbackFailure) {
        operation.status = 'conflict'; operation.reconcileReason = readbackFailure;
    } else {
        delete operation.reconcileReason;
        if (!files && !asset && ['applying', 'needs-reconciliation', 'completed'].includes(operation.status)) {
            if (subAssets.length) {
                operation.status = 'conflict'; operation.reconcileReason = 'ASSET_DELETE_STATE_AMBIGUOUS';
            } else {
                operation.status = 'completed'; operation.deletedAssetUuid = plan.expectedBefore.assetUuid;
                operation.completedAt = operation.completedAt || new Date().toISOString();
                operation.completedByInstanceId = operation.completedByInstanceId || INSTANCE_ID;
            }
        } else if (files && asset && assetMoveStateMatches({ ...files,
            assetType: typeof asset.type === 'string' ? asset.type : '',
            assetImporter: typeof asset.importer === 'string' ? asset.importer : '' }, plan.expectedBefore)
            && ['applying', 'needs-reconciliation'].includes(operation.status)) {
            operation.status = sameAssetSubAssets(subAssets, plan.expectedBefore.subAssets || [])
                ? 'not-applied' : 'conflict';
            if (operation.status === 'conflict') operation.reconcileReason = 'ASSET_DELETE_STATE_AMBIGUOUS';
        } else {
            operation.status = 'conflict'; operation.reconcileReason = 'ASSET_DELETE_STATE_AMBIGUOUS';
        }
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...assetDeleteReceipt(operation, observed),
        ...(operation.reconcileReason ? { reason: operation.reconcileReason } : {}),
        retry: 'Never replay this deletion; review the main asset, all sub-assets, AssetDB, and disk state before creating a new plan.' };
}

const TEXTURE_IMPORT_SETTING_VALUES = {
    wrapMode: new Set(['clamp', 'repeat']),
    filterMode: new Set(['point', 'bilinear', 'trilinear']),
};
const TEXTURE_IMPORT_BOOLEAN_SETTINGS = new Set(['premultiplyAlpha', 'genMipmaps', 'packable']);

function validateTextureImportSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw coded('ASSET_TEXTURE_SETTINGS_INVALID');
    const fields = Object.keys(settings);
    if (!fields.length || fields.length > 5) throw coded('ASSET_TEXTURE_SETTINGS_INVALID');
    for (const field of fields) {
        if (TEXTURE_IMPORT_SETTING_VALUES[field]) {
            if (typeof settings[field] !== 'string' || !TEXTURE_IMPORT_SETTING_VALUES[field].has(settings[field]))
                throw coded('ASSET_TEXTURE_SETTING_VALUE_INVALID', field);
        } else if (TEXTURE_IMPORT_BOOLEAN_SETTINGS.has(field)) {
            if (typeof settings[field] !== 'boolean') throw coded('ASSET_TEXTURE_SETTING_VALUE_INVALID', field);
        } else throw coded('ASSET_TEXTURE_SETTING_UNSUPPORTED', field);
    }
    return fields;
}

async function readTextureImportState(assetPath, assetUrl, assetUuid) {
    const target = assetTargetPaths(assetPath);
    if (target.url !== assetUrl || !['.png', '.jpg', '.jpeg'].includes(target.extension))
        throw coded('ASSET_TEXTURE_TARGET_UNSUPPORTED');
    if (!Editor.assetdb || typeof Editor.assetdb.isSubAsset !== 'function' || Editor.assetdb.isSubAsset(assetUrl))
        throw coded('ASSET_TEXTURE_SUB_ASSET_UNSUPPORTED');
    const location = await readAssetLocation(assetPath, assetUrl);
    // Creator 2.4.15's queryAssets rows identify PNG/JPEG assets with type
    // "texture" but do not expose an importer field. The .meta importer is
    // the authoritative importer identity; requiring row.importer ===
    // "texture" makes every real texture fail with ASSET_TEXTURE_IDENTITY_MISMATCH.
    if (!location || location.assetUuid !== assetUuid || location.assetType !== 'texture'
        || location.metaImporter !== 'texture') throw coded('ASSET_TEXTURE_IDENTITY_MISMATCH');
    const metaPath = `${target.filename}.meta`;
    const metaStat = fs.lstatSync(metaPath);
    if (!metaStat.isFile() || metaStat.isSymbolicLink() || metaStat.size > MAX_TEXTURE_META_BYTES)
        throw coded('ASSET_TEXTURE_META_UNSAFE');
    const metaBytes = fs.readFileSync(metaPath);
    let meta;
    try { meta = JSON.parse(metaBytes.toString('utf8')); }
    catch (_) { throw coded('ASSET_TEXTURE_META_INVALID'); }
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)
        || meta.uuid !== assetUuid || meta.importer !== 'texture') throw coded('ASSET_TEXTURE_META_IDENTITY_MISMATCH');
    for (const [field, values] of Object.entries(TEXTURE_IMPORT_SETTING_VALUES)) {
        if (typeof meta[field] !== 'string' || !values.has(meta[field]))
            throw coded('ASSET_TEXTURE_SETTING_SCHEMA_UNSUPPORTED', field);
    }
    for (const field of TEXTURE_IMPORT_BOOLEAN_SETTINGS) {
        if (typeof meta[field] !== 'boolean') throw coded('ASSET_TEXTURE_SETTING_SCHEMA_UNSUPPORTED', field);
    }
    return { assetPath, assetUrl, assetUuid, fileSha256: location.fileSha256,
        metaSha256: location.metaSha256, metaImporter: location.metaImporter,
        assetType: location.assetType, assetImporter: location.assetImporter, meta };
}

async function createTextureImportSettingsPlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function'
        || typeof Editor.assetdb.isSubAsset !== 'function') throw coded('ASSETDB_QUERY_UNAVAILABLE');
    const fields = validateTextureImportSettings(input.settings);
    const root = projectRoot();
    const version = editorVersion();
    if (!isSupportedCreatorVersion(version)) throw coded('CREATOR_VERSION_MISMATCH');
    const asset = await queryAssetByUuid(input.assetUuid);
    if (!asset || typeof asset.url !== 'string' || !asset.url.startsWith('db://assets/')) throw coded('ASSET_UUID_NOT_FOUND');
    const assetPath = asset.url.slice('db://assets/'.length);
    const state = await readTextureImportState(assetPath, asset.url, input.assetUuid);
    const beforeSettings = {};
    const afterSettings = {};
    const changedFields = {};
    const afterMeta = JSON.parse(JSON.stringify(state.meta));
    for (const field of fields) {
        if (Object.is(state.meta[field], input.settings[field])) continue;
        beforeSettings[field] = state.meta[field];
        afterSettings[field] = input.settings[field];
        afterMeta[field] = input.settings[field];
        changedFields[field] = { before: state.meta[field], after: input.settings[field] };
    }
    if (!Object.keys(changedFields).length) throw coded('ASSET_TEXTURE_SETTINGS_NO_CHANGE');
    if (projectRoot() !== root || editorVersion() !== version) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.asset.import-settings', projectRoot: root,
        creatorVersion: version, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        assetPath, assetUrl: asset.url, assetUuid: input.assetUuid,
        expectedBefore: { assetUuid: state.assetUuid, fileSha256: state.fileSha256,
            metaSha256: state.metaSha256, metaImporter: state.metaImporter,
            assetType: state.assetType, assetImporter: state.assetImporter, settings: beforeSettings },
        expectedAfter: { settings: afterSettings },
        expectedMeta: { before: state.meta, after: afterMeta },
        changedFields,
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: root, creatorVersion: version, creatorInstanceId: INSTANCE_ID,
        assetPath, assetUrl: plan.assetUrl, assetUuid: plan.assetUuid,
        expectedBefore: plan.expectedBefore, expectedAfter: plan.expectedAfter,
        changedFields: plan.changedFields, expiresAt: plan.expiresAt,
        diff: { action: 'change-texture-import-settings', assetUuid: plan.assetUuid,
            assetUrl: plan.assetUrl, fields: plan.changedFields,
            preservedMetaFields: Object.keys(state.meta).length - fields.length },
        recovery: { operationId, automaticRetry: false,
            reconcileCommand: 'creator.asset.import-settings.reconcile',
            note: 'The operation saves only allowlisted top-level texture importer fields through Creator AssetDB and verifies the full .meta readback.' } };
}

async function verifyTextureImportSettingsBefore(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    const target = assetTargetPaths(plan.assetPath);
    if (target.root !== plan.projectRoot || target.url !== plan.assetUrl) throw coded('ASSET_TEXTURE_TARGET_CHANGED');
    const state = await readTextureImportState(plan.assetPath, plan.assetUrl, plan.assetUuid);
    if (state.assetUuid !== plan.expectedBefore.assetUuid || state.fileSha256 !== plan.expectedBefore.fileSha256
        || state.metaSha256 !== plan.expectedBefore.metaSha256 || state.metaImporter !== plan.expectedBefore.metaImporter
        || state.assetType !== plan.expectedBefore.assetType || state.assetImporter !== plan.expectedBefore.assetImporter
        || canonical(state.meta) !== canonical(plan.expectedMeta.before)) throw coded('ASSET_TEXTURE_SETTINGS_PRECONDITION_FAILED');
    return state;
}


function textureImportSettingsReceipt(operation, state = null) {
    const plan = operation.plan;
    const current = state && state.meta || operation.afterMeta || null;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, assetPath: plan.assetPath, assetUrl: plan.assetUrl,
        assetUuid: plan.assetUuid, changedFields: plan.changedFields,
        beforeMetaSha256: plan.expectedBefore.metaSha256, afterMetaSha256: state && state.metaSha256 || operation.afterMetaSha256 || null,
        currentSettings: current ? Object.fromEntries(Object.keys(plan.changedFields).map((field) => [field, current[field]])) : null,
        appliedByInstanceId: operation.appliedByInstanceId || null, completedAt: operation.completedAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.asset.import-settings.reconcile',
            note: 'Reconciliation checks the exact texture UUID, source hash, full metadata object, and settings; it never calls saveMeta again.' } };
}

function saveTextureMetaThroughAssetDb(assetUuid, jsonString) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_SAVE_META_TIMEOUT'));
        }, 45000);
        const finish = (error, meta) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (error) { reject(coded('ASSETDB_SAVE_META_FAILED', String(error.message || error))); return; }
            resolve(meta || null);
        };
        try {
            const result = Editor.assetdb.saveMeta(assetUuid, jsonString, finish);
            if (result && typeof result.then === 'function') result.then((meta) => finish(null, meta), finish);
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_SAVE_META_FAILED', String(error.message || error)));
        }
    });
}

function textureImportSettingsAfterMatches(state, plan) {
    return !!state && state.assetUuid === plan.assetUuid
        && state.fileSha256 === plan.expectedBefore.fileSha256
        && state.assetType === plan.expectedBefore.assetType
        && state.assetImporter === plan.expectedBefore.assetImporter
        && state.metaImporter === plan.expectedBefore.metaImporter
        && canonical(state.meta) === canonical(plan.expectedMeta.after);
}

async function commitTextureImportSettings(input, context) {
    const operation = readTextureImportSettingsOperation(input.operationId);
    await verifyTextureImportSettingsBefore(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'needs-reconciliation'].includes(operation.status)
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    operation.status = 'applying'; operation.approvalRequestedAt = new Date().toISOString(); writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { await verifyTextureImportSettingsBefore(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'ASSET_TEXTURE_SETTINGS_PRECONDITION_FAILED'; writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    try {
        await saveTextureMetaThroughAssetDb(operation.plan.assetUuid, JSON.stringify(operation.plan.expectedMeta.after, null, 2));
        const state = await readTextureImportState(operation.plan.assetPath, operation.plan.assetUrl, operation.plan.assetUuid);
        if (!textureImportSettingsAfterMatches(state, operation.plan)) throw coded('ASSET_TEXTURE_SETTINGS_READBACK_MISMATCH');
        operation.status = 'completed'; operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID; operation.afterMetaSha256 = state.metaSha256;
        operation.afterMeta = state.meta; writeOperation(operation);
        return textureImportSettingsReceipt(operation, state);
    } catch (error) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = error.code || 'ASSET_TEXTURE_SETTINGS_RESULT_UNCERTAIN';
        operation.failureAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
}

async function reconcileTextureImportSettings(input) {
    const operation = readTextureImportSettingsOperation(input.operationId);
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    operation.reconcileReason = null;
    let state = null;
    try { state = await readTextureImportState(plan.assetPath, plan.assetUrl, plan.assetUuid); }
    catch (error) {
        operation.status = 'conflict'; operation.reconcileReason = error.code || 'ASSET_TEXTURE_SETTINGS_READBACK_FAILED';
    }
    if (!operation.reconcileReason && state) {
        const beforeMatches = state.assetUuid === plan.expectedBefore.assetUuid
            && state.fileSha256 === plan.expectedBefore.fileSha256
            && state.metaSha256 === plan.expectedBefore.metaSha256
            && canonical(state.meta) === canonical(plan.expectedMeta.before);
        if (beforeMatches && ['planned', 'awaiting-approval', 'applying', 'needs-reconciliation'].includes(operation.status)) {
            operation.status = 'not-applied';
        } else if (textureImportSettingsAfterMatches(state, plan)
            && ['applying', 'needs-reconciliation', 'completed'].includes(operation.status)) {
            operation.status = 'completed'; operation.afterMeta = state.meta; operation.afterMetaSha256 = state.metaSha256;
            operation.completedAt = operation.completedAt || new Date().toISOString();
            operation.completedByInstanceId = operation.completedByInstanceId || INSTANCE_ID;
        } else {
            operation.status = 'conflict'; operation.reconcileReason = 'ASSET_TEXTURE_SETTINGS_STATE_AMBIGUOUS';
        }
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...textureImportSettingsReceipt(operation, state),
        ...(operation.reconcileReason ? { reason: operation.reconcileReason } : {}),
        retry: 'Never replay saveMeta; review the exact .meta state before creating a new plan.' };
}

async function prefabNodeState(sceneUuid, nodeUuid) {
    const state = await callScene('nodeState', { sceneUuid, nodeUuid }, 20000);
    if (!state || state.available !== true || state.sceneUuid !== sceneUuid || state.nodeUuid !== nodeUuid
        || typeof state.nodePath !== 'string') throw coded(state && state.reason || 'PREFAB_SOURCE_NODE_UNAVAILABLE');
    return state;
}

function validatePrefabTarget(prefabPath, requireAbsent) {
    if (path.extname(prefabPath).toLowerCase() !== '.prefab') throw coded('PREFAB_TARGET_EXTENSION_INVALID');
    const target = requireAbsent ? safeNewAssetTarget(prefabPath) : assetTargetPaths(prefabPath);
    if (!requireAbsent && target.root !== projectRoot()) throw coded('OPERATION_PROJECT_MISMATCH');
    return target;
}

async function verifyPrefabCreatePlan(operation, { requireCurrentContract = true, requireAbsent = true, verifySourceNode = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    const target = validatePrefabTarget(plan.prefabPath, requireAbsent);
    if (target.root !== plan.projectRoot || target.url !== plan.targetUrl) throw coded('PREFAB_TARGET_CHANGED');
    if (!verifySourceNode) return { target, node: null };
    const node = await prefabNodeState(plan.sceneUuid, plan.nodeUuid);
    if (node.sceneName !== plan.sceneName || node.nodePath !== plan.nodePath)
        throw coded('PREFAB_SOURCE_NODE_CHANGED');
    return { target, node };
}

async function createPrefabPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function'
        || !Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function'
        || !Editor.assetdb || typeof Editor.assetdb.exists !== 'function'
        || typeof Editor.assetdb.queryAssets !== 'function') throw coded('PREFAB_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const node = await prefabNodeState(input.sceneUuid, input.nodeUuid);
    const target = validatePrefabTarget(input.prefabPath, true);
    if (target.root !== currentRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (path.basename(input.prefabPath, path.extname(input.prefabPath)) !== path.basename(node.nodePath))
        throw coded('PREFAB_TARGET_NAME_MISMATCH');
    if (await queryAssetByUrl(target.url)) throw coded('PREFAB_TARGET_ALREADY_EXISTS');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.prefab.create', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: node.sceneUuid, sceneName: node.sceneName, nodeUuid: node.nodeUuid,
        nodePath: node.nodePath, prefabPath: input.prefabPath, targetUrl: target.url,
        expectedBefore: { assetExists: false }, expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid, nodePath: plan.nodePath,
        prefabPath: plan.prefabPath, targetUrl: plan.targetUrl, expiresAt: plan.expiresAt,
        diff: { action: 'create-prefab', source: { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid, nodePath: plan.nodePath },
            target: { url: plan.targetUrl, before: 'absent', after: 'Creator-authored Prefab asset' } },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.prefab.create.reconcile',
            editorAuthored: true, note: 'Creation uses the Creator Scene panel IPC; no serialized Prefab source is fabricated or patched.' } };
}

async function inspectPrefabSourceCommand(input, { allowAmbiguousPaths = false } = {}) {
    if (!Editor.Project || !Editor.Project.path || !Editor.assetdb
        || typeof Editor.assetdb.queryAssets !== 'function') throw coded('PREFAB_SOURCE_INSPECT_UNAVAILABLE');
    if (!isSupportedCreatorVersion(editorVersion())) throw coded('CREATOR_VERSION_MISMATCH');
    if (typeof input.prefabUuid !== 'string'
        || !/^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/.test(input.prefabUuid))
        throw coded('PREFAB_UUID_INVALID');
    const currentRoot = projectRoot();
    const row = await queryAssetByUuid(input.prefabUuid);
    if (!row || !row.url.startsWith('db://assets/') || !/\.prefab$/i.test(row.url)
        || (row.importer && row.importer !== 'prefab')) throw coded('PREFAB_ASSET_IDENTITY_MISMATCH');
    const prefabPath = row.url.slice('db://assets/'.length);
    const prefabFile = safeProjectFile(prefabPath, /\.prefab$/i);
    const metaFile = safeProjectFile(`${prefabPath}.meta`);
    const prefabBytes = readStableProjectFile(prefabFile, MAX_PREFAB_SERIALIZATION_BYTES, 'PREFAB_SERIALIZATION_FILE_UNSAFE');
    const metaBytes = readStableProjectFile(metaFile, MAX_PREFAB_META_BYTES, 'PREFAB_META_FILE_UNSAFE');
    const state = inspectPrefabSourceData({ prefabBytes, metaBytes, prefabUuid: input.prefabUuid,
        allowAmbiguousPaths,
        maxComponentsPerNode: input.nodeUuid !== undefined ? 64 : 8,
        ...(input.nodeUuid !== undefined ? { targetNodeUuid: input.nodeUuid } : {}),
        ...(input.expectedDiff !== undefined ? { expectedDiff: input.expectedDiff } : {}) });
    if (!state.available) throw coded(state.reason || 'PREFAB_SOURCE_INSPECT_FAILED');
    let nodes = state.nodes;
    let nodePage;
    let truncated = false;
    if (input.nodeUuid !== undefined) {
        if (input.offset !== undefined || input.limit !== undefined)
            throw coded('PREFAB_NODE_PAGE_AND_UUID_CONFLICT');
        if (typeof input.nodeUuid !== 'string') throw coded('PREFAB_NODE_UUID_INVALID');
        nodes = nodes.filter((node) => node.nodeUuid === input.nodeUuid);
        if (nodes.length !== 1) throw coded('PREFAB_NODE_NOT_FOUND');
        nodePage = { offset: 0, limit: 1, total: 1, returned: 1, nextOffset: null };
    } else {
        const offset = input.offset === undefined ? 0 : input.offset;
        const limit = input.limit === undefined ? 100 : input.limit;
        if (!Number.isInteger(offset) || offset < 0 || offset > state.nodeCount
            || !Number.isInteger(limit) || limit < 1 || limit > 100)
            throw coded('PREFAB_NODE_PAGE_INVALID');
        nodes = nodes.slice(offset, offset + limit);
        const nextOffset = offset + nodes.length < state.nodeCount ? offset + nodes.length : null;
        truncated = offset > 0 || nextOffset !== null;
        nodePage = { offset, limit, total: state.nodeCount, returned: nodes.length, nextOffset };
    }
    const freshRow = await queryAssetByUuid(input.prefabUuid);
    if (!freshRow || freshRow.url !== row.url || freshRow.uuid !== row.uuid
        || projectRoot() !== currentRoot || !isSupportedCreatorVersion(editorVersion()))
        throw coded('PREFAB_ASSET_IDENTITY_CHANGED');
    const freshPrefabBytes = readStableProjectFile(prefabFile, MAX_PREFAB_SERIALIZATION_BYTES, 'PREFAB_SERIALIZATION_FILE_UNSAFE');
    const freshMetaBytes = readStableProjectFile(metaFile, MAX_PREFAB_META_BYTES, 'PREFAB_META_FILE_UNSAFE');
    if (fileHash(freshPrefabBytes) !== fileHash(prefabBytes) || fileHash(freshMetaBytes) !== fileHash(metaBytes))
        throw coded('PREFAB_SOURCE_CHANGED_DURING_INSPECT');
    return { ...state, nodes, nodePage, truncated, projectRoot: currentRoot, creatorVersion: editorVersion(), prefabPath,
        targetUrl: row.url, importer: typeof row.importer === 'string' ? row.importer : null,
        assetType: typeof row.type === 'string' ? row.type : null,
        sourceSha256: fileHash(prefabBytes), metaSha256: fileHash(metaBytes), sourceScope: 'saved-disk-only' };
}

async function inspectPrefabEditableCommand(input) {
    const saved = await inspectPrefabSourceCommand({ prefabUuid: input.prefabUuid, nodeUuid: input.nodeUuid });
    const node = singlePrefabNode(saved, input.nodeUuid);
    const mode = await currentPrefabEditMode();
    if (mode.modeName !== 'scene' || typeof mode.sceneUuid !== 'string') throw coded('EDITOR_BUSY');
    let entered = false;
    try {
        await enterPrefabSourceMode(input.prefabUuid, mode.sceneUuid);
        entered = true;
        const editableState = await callScene('prefabSourceEditableState', { prefabUuid: input.prefabUuid,
            targetNodeUuid: input.nodeUuid, targetNodePath: node.nodePath }, 30000);
        if (!editableState || editableState.available !== true)
            throw coded(editableState && editableState.reason || 'PREFAB_EDITABLE_INSPECT_FAILED');
        if (editableState.prefabUuid !== input.prefabUuid)
            throw coded('PREFAB_EDITABLE_ASSET_IDENTITY_MISMATCH', JSON.stringify({
                expectedPrefabUuid: input.prefabUuid, actualPrefabUuid: editableState.prefabUuid,
            }));
        if (editableState.nodeUuid !== input.nodeUuid)
            throw coded('PREFAB_EDITABLE_NODE_IDENTITY_MISMATCH', JSON.stringify({
                expectedNodeUuid: input.nodeUuid, actualNodeUuid: editableState.nodeUuid,
                liveNodeUuid: editableState.liveNodeUuid,
            }));
        if (!prefabNodePathsMatch(editableState.nodePath, node.nodePath))
            throw coded('PREFAB_EDITABLE_NODE_PATH_MISMATCH', JSON.stringify({
                expectedNodePath: node.nodePath, actualNodePath: editableState.nodePath,
            }));
        if (!Array.isArray(editableState.components) || editableState.components.length !== node.components.length)
            throw coded('PREFAB_COMPONENT_IDENTITY_MISMATCH', JSON.stringify({
                nodeUuid: input.nodeUuid, nodePath: node.nodePath,
                savedComponentCount: node.components.length,
                liveComponentCount: Array.isArray(editableState.components) ? editableState.components.length : null,
                liveComponents: Array.isArray(editableState.components)
                    ? editableState.components.map((component) => component && component.componentClassName) : null,
            }));
        for (const liveComponent of editableState.components) {
            const savedComponent = node.components[liveComponent.componentIndex];
            const liveSerializedClassId = liveComponent.serializedClassId || liveComponent.componentClassName;
            if (!savedComponent || savedComponent.classId !== liveSerializedClassId
                || (savedComponent.instanceIdSynthetic !== true
                    && savedComponent.instanceId !== liveComponent.componentInstanceId))
                throw coded('PREFAB_COMPONENT_IDENTITY_MISMATCH', JSON.stringify({
                    nodeUuid: input.nodeUuid, nodePath: node.nodePath,
                    componentIndex: liveComponent.componentIndex,
                    savedComponent: savedComponent && { classId: savedComponent.classId, instanceId: savedComponent.instanceId },
                    liveComponent: { classId: liveSerializedClassId, componentClassName: liveComponent.componentClassName,
                        instanceId: liveComponent.componentInstanceId },
                }));
            liveComponent.liveComponentInstanceId = liveComponent.componentInstanceId;
            liveComponent.componentInstanceId = savedComponent.instanceId;
            liveComponent.componentInstanceIdSynthetic = savedComponent.instanceIdSynthetic === true;
            liveComponent.serializedClassId = savedComponent.classId;
        }
        return { ...saved, editableState, editableStateScope: 'creator-prefab-edit-mode-read-only' };
    } finally {
        if (entered) await exitPrefabSourceMode(input.prefabUuid, mode.sceneUuid);
    }
}

async function inspectPrefabInstanceCommand(input) {
    if (!isSupportedCreatorVersion(editorVersion())) throw coded('CREATOR_VERSION_MISMATCH');
    if (!input || typeof input.sceneUuid !== 'string' || typeof input.nodeUuid !== 'string')
        throw coded('PREFAB_INSTANCE_INPUT_INVALID');
    const live = await callScene('prefabInstanceState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!live || live.available !== true) throw coded(live && live.reason || 'PREFAB_INSTANCE_INSPECT_FAILED');
    const result = { ...live, projectRoot: projectRoot(), creatorVersion: editorVersion(), liveStateScope: 'active-editor-memory' };
    if (!live.linked) return result;
    const prefab = await inspectPrefabSourceCommand({ prefabUuid: live.prefabUuid });
    result.prefabAsset = { uuid: prefab.prefabUuid, url: prefab.targetUrl, path: prefab.prefabPath,
        sourceSha256: prefab.sourceSha256, metaSha256: prefab.metaSha256,
        nodeCount: prefab.nodeCount, sourceScope: prefab.sourceScope };
    try {
        const savedScene = await sceneNodeDiskState(input.sceneUuid, live.prefabRootUuid,
            { includeComponents: true, includeSubtree: true });
        result.savedScene = { sceneUuid: input.sceneUuid, url: savedScene.sceneUrl || null,
            sourceSha256: savedScene.sourceSha256, metaSha256: savedScene.metaSha256,
            subtreeNodeCount: savedScene.subtree && savedScene.subtree.length || null,
            verified: true, scope: 'assetdb-disk-readback' };
    } catch (error) {
        result.savedScene = { verified: false, reason: error && error.code || 'SCENE_DISK_READBACK_UNAVAILABLE',
            scope: 'assetdb-disk-readback' };
    }
    return result;
}

function singlePrefabNode(source, nodeUuid) {
    const nodes = source && Array.isArray(source.nodes) ? source.nodes : [];
    const matches = nodes.filter((node) => node && node.nodeUuid === nodeUuid);
    if (matches.length !== 1) throw coded('PREFAB_NODE_NOT_FOUND_OR_AMBIGUOUS');
    return matches[0];
}

async function currentPrefabEditMode() {
    const state = await callScene('prefabEditModeState', {}, 10000);
    if (!state || state.available !== true || state.saveAvailable !== true || state.popAvailable !== true
        || typeof state.modeName !== 'string') throw coded('PREFAB_EDIT_MODE_API_UNAVAILABLE');
    prefabEditModeApiAvailable = true;
    return state;
}

async function createPrefabSourcePatchPlan(input) {
    if (!prefabPatch.validInput(input)) throw coded('PREFAB_SOURCE_PATCH_INPUT_INVALID');
    if (!isSupportedCreatorVersion(editorVersion())) throw coded('CREATOR_VERSION_MISMATCH');
    const mode = await currentPrefabEditMode();
    if (mode.modeName !== 'scene' || typeof mode.sceneUuid !== 'string') throw coded('EDITOR_BUSY');
    let source = await inspectPrefabSourceCommand({ prefabUuid: input.prefabUuid, nodeUuid: input.targetNodeUuid });
    let expectedDiff = input.expectedDiff;
    let sourceOperationId = null;
    let compensationTransform = null;
    if (input.action === 'apply') {
        if (input.expectedSourceSha256 !== source.sourceSha256) throw coded('PREFAB_SOURCE_STALE');
        const childDiff = expectedDiff.find((item) => item.path === 'node.child');
        if (childDiff) {
            const change = prefabPatch.childStateChange(childDiff.before, childDiff.after);
            if (change && change.kind === 'insert' && change.child.nodeUuid === prefabPatch.AUTO_CHILD_NODE_ID) {
                expectedDiff = expectedDiff.map((item) => item === childDiff ? { ...item,
                    after: { ...item.after, children: item.after.children.map((child) => child === change.child
                        ? { ...child, nodeUuid: creatorNodeId() } : child) } } : item);
                if (!prefabPatch.validateDiff(expectedDiff)) throw coded('PREFAB_CHILD_CREATE_DIFF_INVALID');
            }
        }
        const subtreeDiff = expectedDiff.find((item) => item.path === 'node.subtree');
        if (subtreeDiff) {
            const change = prefabPatch.subtreeStateChange(subtreeDiff.before, subtreeDiff.after);
            if (!change || change.kind !== 'insert') throw coded('PREFAB_SUBTREE_CREATE_DIFF_INVALID');
            const replaceIds = (row) => ({ ...row,
                nodeUuid: row.nodeUuid === prefabPatch.AUTO_CHILD_NODE_ID ? creatorNodeId() : row.nodeUuid,
                children: row.children.map(replaceIds) });
            expectedDiff = expectedDiff.map((item) => item === subtreeDiff ? { ...item,
                after: { ...item.after, children: item.after.children.map((row) => row === change.subtree
                    ? replaceIds(row) : row) } } : item);
            if (!prefabPatch.validateDiff(expectedDiff)) throw coded('PREFAB_SUBTREE_CREATE_DIFF_INVALID');
        }
        const componentStructureDiff = expectedDiff.find((item) => item.path === 'component.structure');
        if (componentStructureDiff) {
            const change = prefabPatch.componentStateChange(componentStructureDiff.before, componentStructureDiff.after);
            if (!change) throw coded('PREFAB_COMPONENT_STRUCTURE_DIFF_INVALID');
            if (change.kind === 'add') {
                if (change.component.componentInstanceId !== prefabPatch.AUTO_COMPONENT_INSTANCE_ID
                    || change.component.componentClassName === 'cc.Component')
                    throw coded('PREFAB_COMPONENT_STRUCTURE_ADD_INVALID');
                expectedDiff = expectedDiff.map((item) => item === componentStructureDiff ? { ...item,
                    after: { ...item.after, components: item.after.components.map((component) => component === change.component
                        ? { ...component, componentInstanceId: prefabPatch.componentIdFor(input.prefabUuid, input.targetNodeUuid,
                            component.componentIndex, component.serializedClassId, null) } : component) } } : item);
            } else {
                const sourceNode = singlePrefabNode(source, input.targetNodeUuid);
                const serialized = sourceNode.components.find((component) => component.index === change.component.componentIndex
                    && component.instanceId === change.component.componentInstanceId
                    && component.classId === change.component.serializedClassId);
                if (!serialized || !/^cc\.[A-Za-z_$][A-Za-z0-9_$.]{0,117}$/.test(change.component.componentClassName))
                    throw coded('PREFAB_COMPONENT_DIRECT_REMOVE_UNSUPPORTED');
                const editable = await inspectPrefabEditableCommand({ prefabUuid: input.prefabUuid,
                    nodeUuid: input.targetNodeUuid });
                const liveComponent = editable.editableState.components.find((component) =>
                    component.componentIndex === change.component.componentIndex
                    && component.componentInstanceId === change.component.componentInstanceId);
                const serializableProperties = liveComponent && liveComponent.propertySchema
                    && liveComponent.propertySchema.serializablePublicProperties;
                if (!liveComponent || liveComponent.propertiesTruncated || !Array.isArray(serializableProperties)
                    || serializableProperties.length > 64)
                    throw coded('PREFAB_COMPONENT_RESTORE_STATE_UNAVAILABLE');
                const propertyRows = new Map((liveComponent.properties || []).map((property) => [property.name, property]));
                const restoreProperties = [];
                for (const propertyName of serializableProperties) {
                    if (propertyName === 'enabled') continue;
                    const property = propertyRows.get(propertyName);
                    const serializedProperty = property && property.inspector && property.inspector.serializedProperty;
                    const restorableKind = property && (property.kind === 'boolean' || property.kind === 'number'
                        || property.kind === 'string' || ['vec2', 'vec3', 'vec4', 'size', 'rect', 'color'].includes(property.kind));
                    if (!property || !restorableKind || property.inspector.editable !== true
                        || typeof serializedProperty !== 'string')
                        throw coded('PREFAB_COMPONENT_RESTORE_STATE_UNAVAILABLE', propertyName);
                    const omitted = !serialized.serializedProperties.includes(serializedProperty);
                    restoreProperties.push({ property: propertyName, value: property.value,
                        serializedProperty, serializedWasOmitted: omitted });
                }
                const eventLists = serialized.eventLists || {};
                if (Object.values(eventLists).some((events) => !Array.isArray(events) || events.length > 0)
                    || Object.keys(serialized.eventListsUnavailable || {}).length > 0)
                    throw coded('PREFAB_COMPONENT_EVENT_LIST_RESTORE_UNSUPPORTED');
                expectedDiff = expectedDiff.map((item) => item === componentStructureDiff ? { ...item,
                    before: { ...item.before, components: item.before.components.map((component) =>
                        component.componentIndex === change.component.componentIndex
                            ? { ...component, enabled: serialized.enabled,
                                componentIdSynthetic: serialized.instanceIdSynthetic,
                                restoreProperties } : component) } } : item);
                source = await inspectPrefabSourceCommand({ prefabUuid: input.prefabUuid,
                    nodeUuid: input.targetNodeUuid, expectedDiff: expectedDiff.filter((item) => item.path === 'component.structure') });
            }
            if (!prefabPatch.validateDiff(expectedDiff)) throw coded('PREFAB_COMPONENT_STRUCTURE_DIFF_INVALID');
        }
    } else {
        sourceOperationId = input.sourceOperationId;
        const sourceOperation = readPrefabSourcePatchOperation(sourceOperationId);
        const sourcePlan = sourceOperation.plan;
        const allowedSourceAction = input.action === 'compensate'
            ? ['apply', 'replay'].includes(sourcePlan.action) : sourcePlan.action === 'compensate';
        const sourceAfterPath = prefabPatch.targetPathAt(sourcePlan.targetNodePath, sourcePlan.expectedDiff, 'after');
        if (sourceOperation.status !== 'completed' || sourcePlan.projectRoot !== projectRoot()
            || !isSupportedCreatorVersion(sourcePlan.creatorVersion) || sourcePlan.prefabUuid !== input.prefabUuid
            || sourcePlan.targetNodeUuid !== input.targetNodeUuid || !allowedSourceAction
            || sourceOperation.afterSourceSha256 !== source.sourceSha256 || sourceAfterPath !== input.targetNodePath)
            throw coded('PREFAB_SOURCE_OPERATION_MISMATCH');
        expectedDiff = prefabPatch.invertDiff(sourcePlan.expectedDiff);
        if (input.action === 'compensate') {
            const sourceTransform = sourcePlan.expectedBeforeNode && sourcePlan.expectedBeforeNode.transform;
            if (!prefabPatch.validTransformSnapshot(sourceTransform)) throw coded('PREFAB_COMPENSATION_TRANSFORM_UNAVAILABLE');
            compensationTransform = { x: sourceTransform.x, y: sourceTransform.y,
                scaleX: sourceTransform.scaleX, scaleY: sourceTransform.scaleY,
                width: sourceTransform.width, height: sourceTransform.height };
        }
        if (input.expectedSourceSha256 !== undefined && input.expectedSourceSha256 !== source.sourceSha256)
            throw coded('PREFAB_SOURCE_STALE');
    }
    if (input.action !== 'compensate' && expectedDiff.some((item) => item.path === 'component.eventList'
        && item.after.items.some((event) => event.targetUuid === null)))
        throw coded('PREFAB_UI_EVENT_TARGET_REQUIRED');
    for (const item of expectedDiff.filter((entry) => entry.path === 'component.structure')) {
        const change = prefabPatch.componentStateChange(item.before, item.after);
        const safeDirectRemoval = change && change.kind === 'remove'
            && /^cc\.[A-Za-z_$][A-Za-z0-9_$.]{0,117}$/.test(change.component.componentClassName)
            && typeof change.component.enabled === 'boolean'
            && Array.isArray(change.component.restoreProperties);
        if (!change || (input.action === 'apply' && change.kind !== 'add' && !safeDirectRemoval)
            || (change.kind === 'add' && change.component.componentClassName === 'cc.Component'))
            throw coded('PREFAB_COMPONENT_STRUCTURE_ACTION_INVALID');
    }
    let node = singlePrefabNode(source, input.targetNodeUuid);
    if (node.nodePath !== input.targetNodePath) throw coded('PREFAB_EXPECTED_STATE_MISMATCH');
    if (expectedDiff.some((item) => item.path === 'node.parent')) {
        source = await inspectPrefabSourceCommand({ prefabUuid: input.prefabUuid });
        node = singlePrefabNode(source, input.targetNodeUuid);
        if (node.nodePath !== input.targetNodePath) throw coded('PREFAB_EXPECTED_STATE_MISMATCH');
    }
    const hasComponentDiff = expectedDiff.some((item) => ['component.property', 'component.eventList', 'component.structure'].includes(item.path));
    if (input.action === 'apply' && hasComponentDiff) {
        let entered = false;
        try {
            await enterPrefabSourceMode(input.prefabUuid, mode.sceneUuid);
            entered = true;
            const live = await callScene('prefabSourcePatchPreflight', { prefabUuid: input.prefabUuid,
                targetNodePath: input.targetNodePath, targetNodeUuid: input.targetNodeUuid,
                action: input.action, expectedDiff }, 20000);
            if (!live || live.available !== true || !live.node
                || !prefabPatch.matchesDiff(live.node, expectedDiff, 'before'))
                throw coded(live && live.reason || 'PREFAB_EXPECTED_STATE_MISMATCH');
            expectedDiff = expectedDiff.map((item) => {
                if (item.path !== 'component.property') return item;
                const binding = live.node.componentPropertyBindings
                    && live.node.componentPropertyBindings[item.componentInstanceId]
                    && live.node.componentPropertyBindings[item.componentInstanceId][item.property];
                if (!binding || !binding.serializedProperty || !Array.isArray(binding.serializedPropertyCandidates))
                    throw coded('PREFAB_COMPONENT_PROPERTY_BINDING_UNAVAILABLE');
                const component = node.components.find((entry) => entry.instanceId === item.componentInstanceId
                    && entry.index === item.componentIndex);
                if (!component || component.serializedPropertiesTruncated)
                    throw coded('PREFAB_COMPONENT_PROPERTY_IDENTITY_MISMATCH');
                const omitted = !component.serializedProperties.includes(binding.serializedProperty);
                return { ...item, serializedProperty: binding.serializedProperty,
                    serializedClassId: component.classId,
                    serializedPropertyCandidates: binding.serializedPropertyCandidates,
                    serializedWasOmitted: omitted,
                    ...(omitted ? { serializedDefaultValue: item.before } : {}) };
            });
            const sourceSelectors = prefabPatch.sourceInspectionDiff(expectedDiff);
            source = await inspectPrefabSourceCommand({ prefabUuid: input.prefabUuid,
                nodeUuid: input.targetNodeUuid, ...(sourceSelectors.length ? { expectedDiff: sourceSelectors } : {}) });
            node = singlePrefabNode(source, input.targetNodeUuid);
        } finally {
            if (entered) await exitPrefabSourceMode(input.prefabUuid, mode.sceneUuid);
        }
    } else if (hasComponentDiff) {
        const sourceSelectors = prefabPatch.sourceInspectionDiff(expectedDiff);
        source = await inspectPrefabSourceCommand({ prefabUuid: input.prefabUuid,
            nodeUuid: input.targetNodeUuid, ...(sourceSelectors.length ? { expectedDiff: sourceSelectors } : {}) });
        node = singlePrefabNode(source, input.targetNodeUuid);
    }
    if (!prefabPatch.matchesDiff(node, expectedDiff, 'before')) throw coded('PREFAB_SOURCE_STALE');
    for (const item of expectedDiff.filter((entry) => entry.path === 'node.parent')) {
        const beforeParent = source.nodes.find((entry) => entry.nodeUuid === item.before.parentUuid);
        const afterParent = source.nodes.find((entry) => entry.nodeUuid === item.after.parentUuid);
        const afterChildCount = source.nodes.filter((entry) => entry.parentUuid === item.after.parentUuid).length;
        const beforeParentPath = node.nodePath.split('/').slice(0, -1).join('/');
        if (node.identityKind === 'prefab-root' || !beforeParent || !afterParent
            || node.parentUuid !== item.before.parentUuid || node.siblingIndex !== item.before.siblingIndex
            || beforeParent.nodePath !== beforeParentPath || item.before.parentPath !== beforeParent.nodePath
            || item.after.parentPath !== afterParent.nodePath || afterParent.nodePath === node.nodePath
            || afterParent.nodePath.startsWith(`${node.nodePath}/`) || item.after.siblingIndex > afterChildCount)
            throw coded('PREFAB_REPARENT_TARGET_INVALID');
    }
    for (const item of expectedDiff.filter((entry) => entry.path === 'node.siblingIndex')) {
        if (node.parentUuid !== item.parentUuid || !Number.isInteger(node.siblingCount)
            || item.after >= node.siblingCount)
            throw coded('PREFAB_SIBLING_INDEX_OUT_OF_RANGE');
    }
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.prefab.source.patch', projectRoot: projectRoot(),
        creatorVersion: editorVersion(), extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        prefabUuid: input.prefabUuid, prefabPath: source.prefabPath, targetUrl: source.targetUrl,
        activeSceneUuid: mode.sceneUuid, targetNodePath: input.targetNodePath, targetNodeUuid: input.targetNodeUuid,
        action: input.action, sourceOperationId, expectedSourceSha256: source.sourceSha256,
        expectedMetaSha256: source.metaSha256, expectedDiff, compensationTransform,
        expectedBeforeNode: node, expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        prefabUuid: plan.prefabUuid, prefabPath: plan.prefabPath, targetUrl: plan.targetUrl,
        activeSceneUuid: plan.activeSceneUuid, targetNodePath: plan.targetNodePath, targetNodeUuid: plan.targetNodeUuid,
        action: plan.action, sourceOperationId, sourceSha256: plan.expectedSourceSha256,
        diff: plan.expectedDiff, compensationTransform: plan.compensationTransform, expiresAt: plan.expiresAt,
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.prefab.source.patch.reconcile',
            note: 'Writes are made only in Creator Prefab edit mode and require save, exit, reopen, and disk readback.' } };
}

async function verifyPrefabSourcePatchPlan(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (plan.action === 'compensate' && !prefabPatch.validTransformSnapshot(plan.compensationTransform))
        throw coded('PREFAB_COMPENSATION_TRANSFORM_UNAVAILABLE');
    const propertyDiff = prefabPatch.sourceInspectionDiff(plan.expectedDiff);
    const source = await inspectPrefabSourceCommand({ prefabUuid: plan.prefabUuid, nodeUuid: plan.targetNodeUuid,
        ...(propertyDiff.length ? { expectedDiff: propertyDiff } : {}) });
    const node = singlePrefabNode(source, plan.targetNodeUuid);
    if (source.prefabPath !== plan.prefabPath || source.targetUrl !== plan.targetUrl
        || source.metaSha256 !== plan.expectedMetaSha256 || source.sourceSha256 !== plan.expectedSourceSha256
        || node.nodePath !== plan.targetNodePath || !prefabPatch.matchesDiff(node, plan.expectedDiff, 'before'))
        throw coded('PREFAB_SOURCE_STALE');
    const mode = await currentPrefabEditMode();
    if (mode.modeName !== 'scene' || mode.sceneUuid !== plan.activeSceneUuid) throw coded('EDITOR_BUSY');
    return { source, node, mode };
}


function prefabSourcePatchReceipt(operation) {
    const plan = operation.plan;
    return { operationId: operation.operationId, operation: operation.operation, status: operation.status,
        action: plan.action, sourceOperationId: plan.sourceOperationId, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, prefabUuid: plan.prefabUuid, prefabPath: plan.prefabPath,
        targetUrl: plan.targetUrl, targetNodePath: plan.targetNodePath, targetNodeUuid: plan.targetNodeUuid,
        expectedDiff: plan.expectedDiff, beforeSourceSha256: plan.expectedSourceSha256,
        afterSourceSha256: operation.afterSourceSha256 || null,
        saveCallbackConfirmed: operation.saveCallbackConfirmed === true,
        sceneSavedEventConfirmed: operation.sceneSavedEventConfirmed === true,
        editorExitedToScene: operation.editorExitedToScene === true,
        editorReopened: operation.editorReopened === true,
        editorExitedAfterReopen: operation.editorExitedAfterReopen === true,
        diskReadback: operation.diskReadback || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedAt: operation.completedAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.prefab.source.patch.reconcile',
            note: operation.status === 'completed' ? 'Creator save, exit, reopen, live readback, and saved-file readback all matched.'
                : 'Do not resend the write. Reconcile this operation and inspect the current Prefab edit mode before continuing.' } };
}

async function waitForPrefabSourcePatchDisk(operation, timeoutMs = SCENE_SAVE_READBACK_TIMEOUT_MS) {
    const plan = operation.plan;
    const deadline = Date.now() + timeoutMs;
    let lastReason = 'PREFAB_DISK_READBACK_PENDING';
    do {
        try {
            const propertyDiff = prefabPatch.sourceInspectionDiff(plan.expectedDiff);
            const source = await inspectPrefabSourceCommand({ prefabUuid: plan.prefabUuid, nodeUuid: plan.targetNodeUuid,
                ...(propertyDiff.length ? { expectedDiff: propertyDiff } : {}) });
            const node = singlePrefabNode(source, plan.targetNodeUuid);
            const afterPath = prefabPatch.targetPathAt(plan.targetNodePath, plan.expectedDiff, 'after');
            if (source.prefabPath !== plan.prefabPath || source.targetUrl !== plan.targetUrl
                || source.metaSha256 !== plan.expectedMetaSha256) throw coded('PREFAB_ASSET_IDENTITY_CHANGED');
            if (source.sourceSha256 !== plan.expectedSourceSha256 && node.nodePath === afterPath
                && prefabPatch.matchesDiff(node, plan.expectedDiff, 'after'))
                return { source, node, verifiedAt: new Date().toISOString() };
            lastReason = source.sourceSha256 === plan.expectedSourceSha256
                ? 'PREFAB_DISK_READBACK_PENDING' : 'PREFAB_DISK_READBACK_MISMATCH';
        } catch (error) {
            lastReason = error.code || 'PREFAB_DISK_READBACK_FAILED';
            if (['PREFAB_ASSET_IDENTITY_MISMATCH', 'PREFAB_ASSET_IDENTITY_CHANGED', 'UNSAFE_PROJECT_PATH',
                'PREFAB_META_IDENTITY_MISMATCH'].includes(error.code)) throw error;
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
    } while (Date.now() <= deadline);
    throw coded(lastReason);
}

async function commitPrefabSourcePatch(input, context) {
    const operation = readPrefabSourcePatchOperation(input.operationId);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'mutation-started', 'mutation-applied', 'save-requested',
        'source-saved', 'mode-reopened', 'needs-reconciliation'].includes(operation.status)
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    await verifyPrefabSourcePatchPlan(operation);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { await verifyPrefabSourcePatchPlan(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'PREFAB_SOURCE_PRECONDITION_FAILED'; writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    let mutationStarted = false;
    try {
        await enterPrefabSourceMode(operation.plan.prefabUuid, operation.plan.activeSceneUuid);
        const params = { prefabUuid: operation.plan.prefabUuid, targetNodePath: operation.plan.targetNodePath,
            targetNodeUuid: operation.plan.targetNodeUuid, action: operation.plan.action, expectedDiff: operation.plan.expectedDiff,
            ...(operation.plan.compensationTransform ? { restoreTransform: operation.plan.compensationTransform } : {}) };
        const preflight = await callScene('prefabSourcePatchPreflight', params, 20000);
        if (!preflight || preflight.available !== true || preflight.prefabUuid !== operation.plan.prefabUuid
            || !preflight.node || preflight.node.nodeUuid !== operation.plan.targetNodeUuid
            || !prefabPatch.matchesBeforeOrGeometryAfter(preflight.node, operation.plan.expectedDiff)) {
            operation.status = 'conflict'; operation.reconcileReason = preflight && preflight.reason || 'PREFAB_EDITOR_PREFLIGHT_FAILED';
            operation.preflightDiagnostic = preflight && preflight.diagnostic || null;
            writeOperation(operation);
            await exitPrefabSourceMode(operation.plan.prefabUuid, operation.plan.activeSceneUuid);
            throw coded(operation.reconcileReason);
        }
        operation.status = 'mutation-started'; operation.mutationStartedAt = new Date().toISOString(); writeOperation(operation);
        mutationStarted = true;
        const changed = await callScene('prefabSourcePatchMutate', params, 30000);
        if (!changed || changed.available !== true || changed.prefabUuid !== operation.plan.prefabUuid
            || !changed.node || changed.node.nodeUuid !== operation.plan.targetNodeUuid
            || !prefabPatch.matchesDiff(changed.node, operation.plan.expectedDiff, 'after')) {
            operation.mutationDiagnostic = changed && changed.diagnostic || null;
            if (changed && changed.mutationStarted === false) {
                operation.status = 'not-applied'; operation.reconcileReason = changed.reason || 'PREFAB_EDITOR_MUTATION_NOT_STARTED';
                mutationStarted = false;
                writeOperation(operation);
                await exitPrefabSourceMode(operation.plan.prefabUuid, operation.plan.activeSceneUuid);
                throw coded(operation.reconcileReason);
            }
            throw coded(changed && changed.reason || 'PREFAB_EDITOR_MUTATION_UNCERTAIN');
        }
        operation.status = 'mutation-applied'; operation.mutationReadback = changed.node;
        operation.mutationAppliedAt = new Date().toISOString(); writeOperation(operation);
        operation.status = 'save-requested'; operation.saveRequestedAt = new Date().toISOString(); writeOperation(operation);
        const save = await savePrefabSourceMode(operation);
        operation.saveCallbackConfirmed = true; operation.sceneSavedEventConfirmed = save.eventConfirmed;
        operation.status = 'source-saved'; operation.sourceSavedAt = new Date().toISOString(); writeOperation(operation);
        const disk = save.disk;
        operation.afterSourceSha256 = disk.source.sourceSha256;
        operation.diskReadback = { verified: true, prefabUuid: operation.plan.prefabUuid,
            targetNodePath: disk.node.nodePath, targetNodeUuid: disk.node.nodeUuid,
            sourceSha256: disk.source.sourceSha256, metaSha256: disk.source.metaSha256,
            verifiedAt: disk.verifiedAt };
        writeOperation(operation);
        await exitPrefabSourceMode(operation.plan.prefabUuid, operation.plan.activeSceneUuid);
        operation.editorExitedToScene = true;
        operation.firstExitAt = new Date().toISOString(); writeOperation(operation);
        await enterPrefabSourceMode(operation.plan.prefabUuid, operation.plan.activeSceneUuid);
        const reopened = await callScene('prefabSourcePatchSnapshot', { ...params, side: 'after' }, 20000);
        if (!reopened || reopened.available !== true || reopened.prefabUuid !== operation.plan.prefabUuid
            || reopened.verifiedSide !== 'after' || !reopened.node
            || reopened.node.nodeUuid !== operation.plan.targetNodeUuid
            || !prefabPatch.matchesDiff(reopened.node, operation.plan.expectedDiff, 'after'))
            throw coded(reopened && reopened.reason || 'PREFAB_REOPEN_READBACK_MISMATCH');
        if (operation.plan.compensationTransform
            && !prefabPatch.matchesTransformSnapshot(reopened.node, operation.plan.compensationTransform))
            throw coded('PREFAB_COMPENSATION_TRANSFORM_READBACK_MISMATCH');
        operation.editorReopened = true; operation.reopenedNode = reopened.node;
        operation.status = 'mode-reopened'; operation.modeReopenedAt = new Date().toISOString(); writeOperation(operation);
        await exitPrefabSourceMode(operation.plan.prefabUuid, operation.plan.activeSceneUuid);
        operation.editorExitedAfterReopen = true;
        operation.finalExitAt = new Date().toISOString(); writeOperation(operation);
        const propertyDiff = prefabPatch.sourceInspectionDiff(operation.plan.expectedDiff);
        const finalDisk = await inspectPrefabSourceCommand({ prefabUuid: operation.plan.prefabUuid,
            nodeUuid: operation.plan.targetNodeUuid, ...(propertyDiff.length ? { expectedDiff: propertyDiff } : {}) });
        const finalNode = singlePrefabNode(finalDisk, operation.plan.targetNodeUuid);
        if (finalDisk.sourceSha256 !== operation.afterSourceSha256 || finalDisk.metaSha256 !== operation.plan.expectedMetaSha256
            || finalNode.nodePath !== prefabPatch.targetPathAt(operation.plan.targetNodePath, operation.plan.expectedDiff, 'after')
            || !prefabPatch.matchesDiff(finalNode, operation.plan.expectedDiff, 'after')
            || operation.plan.compensationTransform
                && !prefabPatch.matchesTransformSnapshot(finalNode, operation.plan.compensationTransform))
            throw coded('PREFAB_FINAL_DISK_READBACK_MISMATCH');
        operation.status = 'completed'; operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID; writeOperation(operation);
        return prefabSourcePatchReceipt(operation);
    } catch (error) {
        if (!['conflict', 'not-applied'].includes(operation.status)) {
            operation.status = mutationStarted ? 'needs-reconciliation' : 'conflict';
            operation.reconcileReason = error.code || 'PREFAB_SOURCE_PATCH_FAILED';
            operation.failureAt = new Date().toISOString(); writeOperation(operation);
        }
        if (mutationStarted) throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason || String(error.message || error));
        throw error;
    }
}

async function reconcilePrefabSourcePatch(input) {
    const operation = readPrefabSourcePatchOperation(input.operationId);
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot || editorVersion() !== plan.creatorVersion) throw coded('OPERATION_TARGET_MISMATCH');
    const failureReason = ['needs-reconciliation', 'mutation-started', 'mutation-applied', 'save-requested',
        'source-saved', 'mode-reopened'].includes(operation.status) ? operation.reconcileReason || null : null;
    let source;
    try {
        const propertyDiff = prefabPatch.sourceInspectionDiff(plan.expectedDiff);
        source = await inspectPrefabSourceCommand({ prefabUuid: plan.prefabUuid, nodeUuid: plan.targetNodeUuid,
            ...(propertyDiff.length ? { expectedDiff: propertyDiff } : {}) });
    }
    catch (error) {
        operation.status = 'conflict'; operation.reconcileReason = error.code || 'PREFAB_DISK_READBACK_FAILED';
        operation.reconciledAt = new Date().toISOString(); writeOperation(operation); throw error;
    }
    const node = singlePrefabNode(source, plan.targetNodeUuid);
    const structureItem = plan.expectedDiff.find((item) => item.path === 'component.structure');
    if (structureItem) {
        const change = prefabPatch.componentStateChange(structureItem.before, structureItem.after);
        if (change && change.kind === 'add') {
            const descriptor = change.component;
            const serializedIdentity = prefabPatch.componentIdFor(plan.prefabUuid, plan.targetNodeUuid,
                descriptor.componentIndex, descriptor.serializedClassId, null);
            const observedRows = node.componentState && node.componentState.components;
            const expectedPrefix = structureItem.before.components;
            const observedAdded = Array.isArray(observedRows) ? observedRows[descriptor.componentIndex] : null;
            if (observedAdded && observedAdded.componentIndex === descriptor.componentIndex
                && observedAdded.componentClassName === descriptor.componentClassName
                && observedAdded.serializedClassId === descriptor.serializedClassId
                && observedAdded.componentInstanceId === serializedIdentity
                && observedRows.length === expectedPrefix.length + 1
                && expectedPrefix.every((row, index) => prefabPatch.canonicalValue(row) === prefabPatch.canonicalValue(observedRows[index]))) {
                plan.expectedDiff = plan.expectedDiff.map((item) => item === structureItem ? { ...item,
                    after: { ...item.after, components: item.after.components.map((row) => row.componentIndex === descriptor.componentIndex
                        ? { ...row, componentInstanceId: serializedIdentity } : row) } } : item);
                operation.planHash = planFingerprint(plan);
            }
        }
    }
    const afterPath = prefabPatch.targetPathAt(plan.targetNodePath, plan.expectedDiff, 'after');
    const beforeMatches = source.sourceSha256 === plan.expectedSourceSha256 && source.metaSha256 === plan.expectedMetaSha256
        && node.nodePath === plan.targetNodePath
        && prefabPatch.matchesDiff(node, plan.expectedDiff, 'before');
    const afterMatches = source.sourceSha256 !== plan.expectedSourceSha256 && node.nodePath === afterPath
        && prefabPatch.matchesDiff(node, plan.expectedDiff, 'after') && source.metaSha256 === plan.expectedMetaSha256;
    if (afterMatches && !prefabPatch.hasMatchingDiskReadback(operation, source)) {
        operation.status = 'conflict';
        operation.reconcileReason = 'PREFAB_AFTER_STATE_UNATTRIBUTED';
    } else if (afterMatches) {
        operation.afterSourceSha256 = source.sourceSha256;
        operation.diskReadback = { verified: true, prefabUuid: plan.prefabUuid, targetNodePath: node.nodePath,
            targetNodeUuid: node.nodeUuid, sourceSha256: source.sourceSha256, metaSha256: source.metaSha256,
            verifiedAt: new Date().toISOString() };
        if (operation.editorReopened === true && operation.editorExitedAfterReopen !== true) {
            try {
                const mode = await currentPrefabEditMode();
                operation.editorExitedAfterReopen = mode.modeName === 'scene' && mode.sceneUuid === plan.activeSceneUuid;
            } catch (_) {}
        }
        let editorFlowComplete = operation.editorExitedToScene === true && operation.editorReopened === true
            && operation.editorExitedAfterReopen === true;
        if (!editorFlowComplete) {
            try {
                const mode = await currentPrefabEditMode();
                if (mode.modeName === 'scene' && mode.sceneUuid === plan.activeSceneUuid) {
                    const params = { prefabUuid: plan.prefabUuid, targetNodePath: plan.targetNodePath,
                        targetNodeUuid: plan.targetNodeUuid, expectedDiff: plan.expectedDiff };
                    await enterPrefabSourceMode(plan.prefabUuid, plan.activeSceneUuid);
                    operation.editorExitedToScene = true;
                    const reopened = await callScene('prefabSourcePatchSnapshot', { ...params, side: 'after' }, 20000);
                    if (!reopened || reopened.available !== true || reopened.prefabUuid !== plan.prefabUuid
                        || reopened.verifiedSide !== 'after' || !reopened.node
                        || !prefabPatch.matchesDiff(reopened.node, plan.expectedDiff, 'after'))
                        throw coded(reopened && reopened.reason || 'PREFAB_REOPEN_READBACK_MISMATCH');
                    operation.editorReopened = true;
                    await exitPrefabSourceMode(plan.prefabUuid, plan.activeSceneUuid);
                    operation.editorExitedAfterReopen = true;
                    editorFlowComplete = true;
                }
            } catch (error) {
                operation.reconcileReason = error.code || 'PREFAB_EDITOR_EXIT_REOPEN_READBACK_REQUIRED';
            }
        }
        operation.status = editorFlowComplete ? 'completed' : 'needs-reconciliation';
        operation.reconcileReason = editorFlowComplete ? null : operation.reconcileReason || 'PREFAB_EDITOR_EXIT_REOPEN_READBACK_REQUIRED';
    } else if (beforeMatches) {
        let liveState = 'unavailable';
        try {
            const mode = await currentPrefabEditMode();
            if (mode.modeName === 'scene' && mode.sceneUuid === plan.activeSceneUuid) liveState = 'scene';
            else if (mode.modeName === 'prefab' && mode.prefabUuid === plan.prefabUuid) {
                const params = { prefabUuid: plan.prefabUuid, targetNodePath: plan.targetNodePath,
                    targetNodeUuid: plan.targetNodeUuid, expectedDiff: plan.expectedDiff };
                const before = await callScene('prefabSourcePatchSnapshot', { ...params, side: 'before' }, 20000);
                if (before && before.available === true && before.prefabUuid === plan.prefabUuid
                    && before.verifiedSide === 'before' && before.node)
                    liveState = prefabPatch.classifyDiffState(before.node, plan.expectedDiff);
                else {
                    const after = await callScene('prefabSourcePatchSnapshot', { ...params, side: 'after' }, 20000);
                    liveState = after && after.available === true && after.prefabUuid === plan.prefabUuid
                        && after.verifiedSide === 'after' && after.node
                        ? prefabPatch.classifyDiffState(after.node, plan.expectedDiff) : 'conflict';
                }
            } else liveState = 'conflict';
        } catch (_) { liveState = 'unavailable'; }
        if (liveState === 'scene' || liveState === 'before') {
            operation.status = 'not-applied'; operation.reconcileReason = null;
        } else if (liveState === 'after' || liveState === 'unavailable') {
            operation.status = 'needs-reconciliation';
            operation.reconcileReason = liveState === 'after'
                ? 'PREFAB_HAS_UNSAVED_OR_UNCERTAIN_EDITOR_STATE' : 'PREFAB_LIVE_STATE_UNAVAILABLE';
        } else {
            operation.status = 'conflict'; operation.reconcileReason = 'PREFAB_LIVE_STATE_CONFLICT';
        }
    } else {
        operation.status = 'conflict'; operation.reconcileReason = 'PREFAB_SOURCE_STATE_CONFLICT';
    }
    operation.reconciledAt = new Date().toISOString();
    if (operation.status === 'completed') operation.completedAt = operation.completedAt || operation.reconciledAt;
    writeOperation(operation);
    return { ...prefabSourcePatchReceipt(operation), failureReason, observed: { sourceSha256: source.sourceSha256,
        metaSha256: source.metaSha256, targetNodePath: node.nodePath, targetNodeUuid: node.nodeUuid,
        diskMatchesBefore: beforeMatches, diskMatchesAfter: afterMatches } };
}

async function capturePrefabInstanceOverrideSnapshot(sceneUuid, selectedNodeUuid) {
    const instance = await inspectPrefabInstanceCommand({ sceneUuid, nodeUuid: selectedNodeUuid });
    if (!instance || instance.available !== true || instance.linked !== true)
        throw coded(instance && instance.reason || 'PREFAB_INSTANCE_NOT_LINKED');
    if (!instance.savedScene || instance.savedScene.verified !== true)
        throw coded(instance.savedScene && instance.savedScene.reason || 'PREFAB_INSTANCE_SCENE_NOT_SAVED');
    if (!instance.prefabAsset || typeof instance.prefabAsset.path !== 'string'
        || !prefabPatch.SHA256.test(instance.prefabAsset.sourceSha256 || '')
        || !prefabPatch.SHA256.test(instance.prefabAsset.metaSha256 || '')
        || !prefabPatch.SHA256.test(instance.savedScene.sourceSha256 || '')
        || !prefabPatch.SHA256.test(instance.savedScene.metaSha256 || '')
        || !prefabPatch.SHA256.test(instance.stateSha256 || '')
        || !Array.isArray(instance.nodes) || !instance.nodes.length)
        throw coded('PREFAB_INSTANCE_SNAPSHOT_INVALID');
    return {
        sceneUuid: instance.sceneUuid,
        sceneName: instance.sceneName,
        sceneUrl: instance.savedScene.url,
        sceneSourceSha256: instance.savedScene.sourceSha256,
        sceneMetaSha256: instance.savedScene.metaSha256,
        selectedNodeUuid: instance.selectedNodeUuid,
        selectedNodePath: instance.selectedNodePath,
        prefabRootUuid: instance.prefabRootUuid,
        prefabRootPath: instance.prefabRootPath,
        prefabUuid: instance.prefabUuid,
        prefabPath: instance.prefabAsset.path,
        targetUrl: instance.prefabAsset.url,
        prefabSourceSha256: instance.prefabAsset.sourceSha256,
        prefabMetaSha256: instance.prefabAsset.metaSha256,
        instanceStateSha256: instance.stateSha256,
        nodeCount: instance.nodeCount,
        liveStateScope: instance.liveStateScope,
    };
}

function prefabInstanceOverrideReceipt(operation, observed = null) {
    const plan = operation.plan;
    return {
        operationId: operation.operationId,
        operation: operation.operation,
        action: plan.action,
        status: operation.status,
        projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion,
        sceneUuid: plan.sceneUuid,
        sceneName: plan.sceneName,
        selectedNodeUuid: plan.selectedNodeUuid,
        selectedNodePath: plan.selectedNodePath,
        prefabRootUuid: plan.prefabRootUuid,
        prefabRootPath: plan.prefabRootPath,
        prefabUuid: plan.prefabUuid,
        prefabPath: plan.prefabPath,
        targetUrl: plan.targetUrl,
        expectedBefore: plan.expectedBefore,
        nativeRequestSent: operation.nativeRequestSent === true,
        nativeActionObservedAt: operation.nativeActionObservedAt || null,
        sceneSaveRequestSent: operation.sceneSaveRequestSent === true,
        creatorIpcAcknowledgementConfirmed: false,
        effectObserved: operation.status === 'effect-observed',
        observed,
        semanticOverrideValuesVerified: false,
        plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedAt: operation.completedAt || null,
        ...(operation.preflightDiagnostic ? { preflightDiagnostic: operation.preflightDiagnostic } : {}),
        ...(operation.mutationDiagnostic ? { mutationDiagnostic: operation.mutationDiagnostic } : {}),
        recovery: {
            automaticRetry: false,
            reconcileCommand: 'creator.prefab.instance.override.reconcile',
            note: operation.status === 'effect-observed'
                ? 'Creator changed the expected saved asset and the change was read back. Inspect the resulting Prefab or instance values in Creator; this command does not decode every possible component override.'
                : 'Do not resend the native action. Reconcile its observed hashes and inspect the exact Prefab instance in Creator before creating a new plan.',
        },
    };
}

async function createPrefabInstanceOverridePlan(input) {
    if (!input || typeof input.sceneUuid !== 'string' || typeof input.nodeUuid !== 'string'
        || !['apply', 'revert'].includes(input.action)) throw coded('PREFAB_INSTANCE_OVERRIDE_INPUT_INVALID');
    if (!isSupportedCreatorVersion(editorVersion())) throw coded('CREATOR_VERSION_MISMATCH');
    const snapshot = await capturePrefabInstanceOverrideSnapshot(input.sceneUuid, input.nodeUuid);
    const operationId = uuid();
    const plan = {
        operationId,
        operation: 'creator.prefab.instance.override',
        projectRoot: projectRoot(),
        creatorVersion: editorVersion(),
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID,
        action: input.action,
        sceneUuid: snapshot.sceneUuid,
        sceneName: snapshot.sceneName,
        sceneUrl: snapshot.sceneUrl,
        selectedNodeUuid: snapshot.selectedNodeUuid,
        selectedNodePath: snapshot.selectedNodePath,
        prefabRootUuid: snapshot.prefabRootUuid,
        prefabRootPath: snapshot.prefabRootPath,
        prefabUuid: snapshot.prefabUuid,
        prefabPath: snapshot.prefabPath,
        targetUrl: snapshot.targetUrl,
        expectedBefore: {
            instanceStateSha256: snapshot.instanceStateSha256,
            sceneSourceSha256: snapshot.sceneSourceSha256,
            sceneMetaSha256: snapshot.sceneMetaSha256,
            prefabSourceSha256: snapshot.prefabSourceSha256,
            prefabMetaSha256: snapshot.prefabMetaSha256,
        },
        nodeCount: snapshot.nodeCount,
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(),
        plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, action: plan.action, status: operation.status,
        planHash: operation.planHash, projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion,
        creatorInstanceId: plan.creatorInstanceId, sceneUuid: plan.sceneUuid, sceneName: plan.sceneName,
        selectedNodeUuid: plan.selectedNodeUuid, selectedNodePath: plan.selectedNodePath,
        prefabRootUuid: plan.prefabRootUuid, prefabRootPath: plan.prefabRootPath,
        prefabUuid: plan.prefabUuid, prefabPath: plan.prefabPath, targetUrl: plan.targetUrl,
        expectedBefore: plan.expectedBefore, nodeCount: plan.nodeCount, expiresAt: plan.expiresAt,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.prefab.instance.override.reconcile',
            note: 'Review the exact Prefab instance and source identity, then commit once. Creator IPC does not document a completion acknowledgement; reconciliation relies on saved file and live instance readback.' } };
}

async function verifyPrefabInstanceOverridePlan(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    const snapshot = await capturePrefabInstanceOverrideSnapshot(plan.sceneUuid, plan.selectedNodeUuid);
    if (snapshot.sceneUuid !== plan.sceneUuid || snapshot.sceneUrl !== plan.sceneUrl
        || snapshot.selectedNodePath !== plan.selectedNodePath || snapshot.prefabRootUuid !== plan.prefabRootUuid
        || snapshot.prefabRootPath !== plan.prefabRootPath || snapshot.prefabUuid !== plan.prefabUuid
        || snapshot.prefabPath !== plan.prefabPath || snapshot.targetUrl !== plan.targetUrl
        || snapshot.instanceStateSha256 !== plan.expectedBefore.instanceStateSha256
        || snapshot.sceneSourceSha256 !== plan.expectedBefore.sceneSourceSha256
        || snapshot.sceneMetaSha256 !== plan.expectedBefore.sceneMetaSha256
        || snapshot.prefabSourceSha256 !== plan.expectedBefore.prefabSourceSha256
        || snapshot.prefabMetaSha256 !== plan.expectedBefore.prefabMetaSha256)
        throw coded('PREFAB_INSTANCE_OVERRIDE_PRECONDITION_FAILED');
    return snapshot;
}


async function observePrefabInstanceOverride(operation) {
    const snapshot = await capturePrefabInstanceOverrideSnapshot(operation.plan.sceneUuid,
        operation.plan.selectedNodeUuid);
    const classification = prefabInstanceOperations.classifyPrefabInstanceOverride(operation.plan, snapshot);
    operation.lastObservation = { ...snapshot, classification, observedAt: new Date().toISOString() };
    if (classification === 'effect-observed') {
        operation.status = 'effect-observed';
        operation.effectObservedAt = operation.effectObservedAt || operation.lastObservation.observedAt;
    } else if (classification === 'not-applied') operation.status = 'not-applied';
    else operation.status = classification;
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return prefabInstanceOverrideReceipt(operation, operation.lastObservation);
}

async function waitForPrefabInstanceOverrideAction(operation, timeoutMs = SCENE_SAVE_READBACK_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    let lastSnapshot = null;
    let lastError = null;
    do {
        try {
            lastSnapshot = await capturePrefabInstanceOverrideSnapshot(operation.plan.sceneUuid,
                operation.plan.selectedNodeUuid);
            const classification = prefabInstanceOperations.classifyPrefabInstanceOverrideAction(
                operation.plan, lastSnapshot);
            if (classification !== 'pending') return { snapshot: lastSnapshot, classification };
        } catch (error) {
            lastError = error;
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 150));
    } while (Date.now() <= deadline);
    return { snapshot: lastSnapshot, classification: 'pending', error: lastError };
}

async function commitPrefabInstanceOverride(input, context) {
    const operation = readPrefabInstanceOverrideOperation(input.operationId);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['mutation-started', 'needs-reconciliation', 'conflict']
        .includes(operation.status) ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    await verifyPrefabInstanceOverridePlan(operation);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    if (!await authorizeCommit()) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { await verifyPrefabInstanceOverridePlan(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'PREFAB_INSTANCE_OVERRIDE_PRECONDITION_FAILED'; writeOperation(operation);
        throw error;
    }
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_IPC_UNAVAILABLE');
    operation.status = 'mutation-started';
    operation.mutationStartedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    try {
        const message = operation.plan.action === 'apply' ? 'scene:apply-prefab' : 'scene:revert-prefab';
        Editor.Ipc.sendToPanel('scene', message, operation.plan.prefabRootUuid);
        operation.nativeRequestSent = true;
        operation.nativeRequestSentAt = new Date().toISOString();
        writeOperation(operation);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'PREFAB_INSTANCE_OVERRIDE_IPC_UNCERTAIN';
        operation.failureAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    const actionObservation = await waitForPrefabInstanceOverrideAction(operation);
    if (actionObservation.classification !== 'action-observed') {
        operation.status = actionObservation.classification === 'conflict' ? 'conflict' : 'needs-reconciliation';
        operation.reconcileReason = actionObservation.error && (actionObservation.error.code || actionObservation.error.message)
            || (actionObservation.classification === 'conflict' ? 'PREFAB_INSTANCE_OVERRIDE_ACTION_CONFLICT'
                : 'PREFAB_INSTANCE_OVERRIDE_ACTION_UNCONFIRMED');
        operation.failureAt = new Date().toISOString();
        if (actionObservation.snapshot) operation.lastObservation = { ...actionObservation.snapshot,
            classification: actionObservation.classification, observedAt: operation.failureAt };
        writeOperation(operation);
        return prefabInstanceOverrideReceipt(operation, actionObservation.snapshot
            ? { ...actionObservation.snapshot, classification: actionObservation.classification }
            : { verified: false, reason: operation.reconcileReason });
    }
    operation.nativeActionObservedAt = new Date().toISOString();
    operation.nativeActionObservation = actionObservation.snapshot;
    writeOperation(operation);
    try {
        Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
        operation.sceneSaveRequestSent = true;
        operation.sceneSaveRequestedAt = new Date().toISOString();
        writeOperation(operation);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'PREFAB_INSTANCE_OVERRIDE_SAVE_IPC_UNCERTAIN';
        operation.failureAt = new Date().toISOString();
        writeOperation(operation);
        return prefabInstanceOverrideReceipt(operation, { ...actionObservation.snapshot,
            classification: 'action-observed-save-unconfirmed' });
    }
    const deadline = Date.now() + SCENE_SAVE_READBACK_TIMEOUT_MS;
    let lastReceipt = null;
    do {
        try {
            lastReceipt = await observePrefabInstanceOverride(operation);
            if (['effect-observed', 'conflict'].includes(lastReceipt.status)) return lastReceipt;
        } catch (error) {
            operation.reconcileReason = error.code || 'PREFAB_INSTANCE_OVERRIDE_READBACK_UNAVAILABLE';
            operation.lastObservationErrorAt = new Date().toISOString();
            writeOperation(operation);
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 300));
    } while (Date.now() <= deadline);
    if (lastReceipt && lastReceipt.status === 'not-applied') return lastReceipt;
    operation.status = 'needs-reconciliation';
    operation.reconcileReason = operation.reconcileReason || 'PREFAB_INSTANCE_OVERRIDE_EFFECT_UNCONFIRMED';
    operation.failureAt = new Date().toISOString();
    writeOperation(operation);
    return prefabInstanceOverrideReceipt(operation, lastReceipt && lastReceipt.observed || null);
}

async function reconcilePrefabInstanceOverride(input) {
    const operation = readPrefabInstanceOverrideOperation(input.operationId);
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot || editorVersion() !== plan.creatorVersion)
        throw coded('OPERATION_TARGET_MISMATCH');
    try { return await observePrefabInstanceOverride(operation); }
    catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'PREFAB_INSTANCE_OVERRIDE_READBACK_UNAVAILABLE';
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        return prefabInstanceOverrideReceipt(operation, { verified: false, reason: operation.reconcileReason });
    }
}


function readPrefabAsset(operation, row) {
    const plan = operation.plan;
    const targetPath = safeProjectFile(plan.prefabPath, /\.prefab$/i);
    const metaPath = safeProjectFile(`${plan.prefabPath}.meta`);
    const stat = fs.statSync(targetPath);
    const metaStat = fs.statSync(metaPath);
    if (stat.size < 1 || stat.size > 8 * 1024 * 1024 || metaStat.size > 16384)
        throw coded('PREFAB_READBACK_SIZE_INVALID');
    const prefabBytes = fs.readFileSync(targetPath);
    const metaBytes = fs.readFileSync(metaPath);
    let serialized;
    try { serialized = JSON.parse(prefabBytes.toString('utf8')); }
    catch (_) { throw coded('PREFAB_SERIALIZATION_INVALID'); }
    const meta = JSON.parse(metaBytes.toString('utf8'));
    if (!meta || typeof meta.uuid !== 'string' || !meta.uuid || !row || row.url !== plan.targetUrl
        || typeof row.uuid !== 'string' || row.uuid !== meta.uuid) throw coded('PREFAB_ASSETDB_IDENTITY_MISMATCH');
    const objectRecords = Array.isArray(serialized) ? serialized : [serialized];
    if (objectRecords.length > 20000) throw coded('PREFAB_OBJECT_COUNT_INVALID');
    const typeCounts = Object.create(null);
    let nodeCount = 0;
    for (const item of objectRecords) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        const type = typeof item.__type__ === 'string' ? item.__type__.slice(0, 160) : null;
        if (type) {
            if (!Object.prototype.hasOwnProperty.call(typeCounts, type) && Object.keys(typeCounts).length >= 256)
                throw coded('PREFAB_TYPE_COUNT_INVALID');
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        }
        if (type === 'cc.Node') nodeCount += 1;
    }
    return { prefabPath: plan.prefabPath, targetUrl: plan.targetUrl, assetUuid: meta.uuid,
        importer: typeof row.importer === 'string' ? row.importer : null,
        assetType: typeof row.type === 'string' ? row.type : null,
        serializedBytes: prefabBytes.length, serializedSha256: fileHash(prefabBytes),
        metaSha256: fileHash(metaBytes), semanticSummary: { serializedObjectCount: objectRecords.length,
            nodeCount, typeCounts } };
}

async function waitForPrefabAsset(operation, timeoutMs = 45000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const row = await queryAssetByUrl(operation.plan.targetUrl);
        if (row) {
            try { return { row, readback: readPrefabAsset(operation, row) }; }
            catch (error) {
                if (!['UNSAFE_PROJECT_PATH', 'PREFAB_ASSETDB_IDENTITY_MISMATCH'].includes(error.code)) throw error;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw coded('PREFAB_READBACK_TIMEOUT');
}

function prefabCreateReceipt(operation, readback) {
    const value = readback || operation.prefabReadback || null;
    return { operationId: operation.operationId, status: operation.status, projectRoot: operation.plan.projectRoot,
        creatorVersion: operation.plan.creatorVersion, sceneName: operation.plan.sceneName,
        sceneUuid: operation.plan.sceneUuid, nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
        prefabPath: operation.plan.prefabPath, targetUrl: operation.plan.targetUrl,
        assetUuid: value && value.assetUuid || operation.assetUuid || null,
        importer: value && value.importer || operation.importer || null,
        assetType: value && value.assetType || operation.assetType || null,
        serializedBytes: value && value.serializedBytes || operation.serializedBytes || null,
        serializedSha256: value && value.serializedSha256 || operation.serializedSha256 || null,
        metaSha256: value && value.metaSha256 || operation.metaSha256 || null,
        semanticSummary: value && value.semanticSummary || operation.semanticSummary || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedAt: operation.completedAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.prefab.create.reconcile',
            serializedSourceEdited: false, note: 'Prefab data was authored by Creator through its Scene panel.' } };
}

async function commitPrefabCreate(input, context) {
    const operation = readPrefabCreateOperation(input.operationId);
    await verifyPrefabCreatePlan(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    operation.status = 'applying'; operation.approvalRequestedAt = new Date().toISOString(); writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try { await verifyPrefabCreatePlan(operation); }
    catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'PREFAB_PRECONDITION_FAILED'; writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    try {
        const targetFolderUrl = operation.plan.targetUrl.slice(0, operation.plan.targetUrl.lastIndexOf('/'));
        Editor.Ipc.sendToPanel('scene', 'scene:create-prefab', operation.plan.nodeUuid, targetFolderUrl);
        const { row, readback } = await waitForPrefabAsset(operation);
        operation.status = 'completed'; operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID; operation.assetUuid = row.uuid;
        operation.importer = readback.importer; operation.assetType = readback.assetType;
        operation.serializedBytes = readback.serializedBytes; operation.serializedSha256 = readback.serializedSha256;
        operation.metaSha256 = readback.metaSha256; operation.semanticSummary = readback.semanticSummary;
        operation.prefabReadback = readback; writeOperation(operation);
        return prefabCreateReceipt(operation, readback);
    } catch (error) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = error.code || 'PREFAB_CREATE_RESULT_UNCERTAIN';
        operation.failureAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
}

async function reconcilePrefabCreate(input) {
    const operation = readPrefabCreateOperation(input.operationId);
    await verifyPrefabCreatePlan(operation, { requireCurrentContract: false, requireAbsent: false, verifySourceNode: false });
    let row = null;
    let readback = null;
    let filePresent = false;
    let metaPresent = false;
    try {
        const target = assetTargetPaths(operation.plan.prefabPath);
        for (const [candidate, key] of [[target.filename, 'file'], [target.metaFilename, 'meta']]) {
            try {
                const stat = fs.lstatSync(candidate);
                if (!stat.isFile() || stat.isSymbolicLink()) throw coded('PREFAB_TARGET_UNSAFE');
                if (key === 'file') filePresent = true; else metaPresent = true;
            } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        row = await queryAssetByUrl(operation.plan.targetUrl);
        if (row) readback = readPrefabAsset(operation, row);
    } catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'PREFAB_READBACK_FAILED'; writeOperation(operation);
        return { ...prefabCreateReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    if (!row && !filePresent && !metaPresent && ['applying', 'needs-reconciliation'].includes(operation.status))
        operation.status = 'not-applied';
    else if (!row && (filePresent || metaPresent)) {
        operation.status = 'conflict'; operation.reconcileReason = 'PREFAB_PARTIAL_TARGET_PRESENT';
    } else if (row && readback && ['applying', 'needs-reconciliation', 'completed'].includes(operation.status)) {
        operation.status = 'completed'; operation.assetUuid = row.uuid;
        operation.importer = readback.importer; operation.assetType = readback.assetType;
        operation.serializedBytes = readback.serializedBytes; operation.serializedSha256 = readback.serializedSha256;
        operation.metaSha256 = readback.metaSha256; operation.semanticSummary = readback.semanticSummary;
        operation.prefabReadback = readback; operation.completedAt = operation.completedAt || new Date().toISOString();
        operation.completedByInstanceId = operation.completedByInstanceId || INSTANCE_ID;
    } else if (row || readback || operation.status === 'completed') {
        operation.status = 'conflict'; operation.reconcileReason = 'PREFAB_TARGET_CHANGED';
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...prefabCreateReceipt(operation, readback), observed: { assetPresent: !!row,
        filePresent, metaPresent, assetUuid: row && row.uuid || null, prefabReadback: readback },
        retry: 'Never replay this operation; create a new plan only after reviewing the target.' };
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

async function currentScriptAsset(scriptPath) {
    const readback = readScript({ scriptPath });
    const targetUrl = `db://assets/${scriptPath}`;
    const asset = await queryAssetByUrl(targetUrl);
    if (!asset || typeof asset.uuid !== 'string' || asset.uuid !== readback.scriptUuid)
        throw coded('SCRIPT_ASSETDB_IDENTITY_MISMATCH');
    if (asset.importer && asset.importer !== readback.scriptType) throw coded('SCRIPT_ASSETDB_IMPORTER_MISMATCH');
    return { ...readback, targetUrl, importer: asset.importer || readback.scriptType,
        assetType: typeof asset.type === 'string' ? asset.type : null };
}

async function createScriptRecompilePlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.refresh !== 'function') throw coded('ASSETDB_REFRESH_UNAVAILABLE');
    const current = await currentScriptAsset(input.scriptPath);
    if (current.sourceSha256 !== input.expectedSourceSha256) throw coded('SCRIPT_SOURCE_PRECONDITION_FAILED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.script.recompile', projectRoot: projectRoot(),
        creatorVersion: editorVersion(), extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        scriptPath: input.scriptPath, targetUrl: current.targetUrl, scriptUuid: current.scriptUuid,
        importer: current.importer, assetType: current.assetType, sourceSha256: current.sourceSha256,
        metaSha256: current.metaSha256, compileCursor: diagnosticSequence,
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        scriptPath: plan.scriptPath, targetUrl: plan.targetUrl, scriptUuid: plan.scriptUuid,
        importer: plan.importer, assetType: plan.assetType,
        sourceSha256: plan.sourceSha256, metaSha256: plan.metaSha256,
        compileCursor: plan.compileCursor, expiresAt: plan.expiresAt,
        diff: { action: 'assetdb-script-reimport', asset: plan.targetUrl,
            sourceSha256: plan.sourceSha256, sourceChanged: false, metaPreserved: true },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.script.recompile.reconcile' } };
}

function verifyScriptRecompileIdentity(operation, { requireCurrentContract = true, requireSameInstance = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (requireCurrentContract && (plan.extensionVersion !== extensionPackage.version
        || plan.contractFingerprint !== CONTRACT_FINGERPRINT)) throw coded('OPERATION_CONTRACT_MISMATCH');
    if (requireSameInstance && plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
}

async function verifyScriptRecompilePrecondition(operation) {
    const plan = operation.plan;
    const current = await currentScriptAsset(plan.scriptPath);
    if (current.targetUrl !== plan.targetUrl || current.scriptUuid !== plan.scriptUuid
        || current.importer !== plan.importer || current.assetType !== plan.assetType
        || current.sourceSha256 !== plan.sourceSha256 || current.metaSha256 !== plan.metaSha256)
        throw coded('SCRIPT_RECOMPILE_PRECONDITION_FAILED');
    return current;
}


function refreshScriptAsset(url) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_REFRESH_TIMEOUT'));
        }, 60000);
        try {
            Editor.assetdb.refresh(url, (error, results) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_REFRESH_FAILED', String(error.message || error))); return; }
                if (!Array.isArray(results)) { reject(coded('ASSETDB_REFRESH_RESULT_INVALID')); return; }
                resolve(results);
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_REFRESH_FAILED', String(error.message || error)));
        }
    });
}

function scriptRecompileReceipt(operation) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion,
        creatorInstanceId: plan.creatorInstanceId, scriptPath: plan.scriptPath,
        targetUrl: plan.targetUrl, scriptUuid: plan.scriptUuid, importer: plan.importer,
        sourceSha256: plan.sourceSha256, metaSha256: plan.metaSha256,
        compile: operation.compile || { status: 'pending', afterSequence: plan.compileCursor },
        assetDbResult: operation.assetDbResult || null,
        startedAt: operation.startedAt || null, completedAt: operation.completedAt || null,
        approvedAt: operation.approvedAt || null, approvalSource: operation.approvalSource || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.script.recompile.reconcile',
            sourceChanged: false, metaPreserved: true } };
}

async function commitScriptRecompile(input, context) {
    const operation = readScriptRecompileOperation(input.operationId);
    verifyScriptRecompileIdentity(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    await verifyScriptRecompilePrecondition(operation);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    verifyScriptRecompileIdentity(operation);
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try { await verifyScriptRecompilePrecondition(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCRIPT_RECOMPILE_PRECONDITION_FAILED';
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.startedAt = new Date().toISOString();
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    let results;
    try { results = await refreshScriptAsset(operation.plan.targetUrl); }
    catch (error) {
        operation.status = 'failed';
        operation.compile = { status: 'failed', reason: error.code || 'ASSETDB_REFRESH_FAILED',
            afterSequence: operation.plan.compileCursor, currentSequence: diagnosticSequence };
        operation.completedAt = new Date().toISOString();
        writeOperation(operation);
        return scriptRecompileReceipt(operation);
    }
    const matching = results.filter((item) => item && item.url === operation.plan.targetUrl
        && item.uuid === operation.plan.scriptUuid);
    const laterEvents = diagnosticEvents.filter((item) => item.sequence > operation.plan.compileCursor);
    const importFailures = laterEvents.filter((item) => item.source === 'creator-assetdb');
    let current;
    try { current = await verifyScriptRecompilePrecondition(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconcileReason = error.code || 'SCRIPT_RECOMPILE_READBACK_FAILED';
        operation.compile = { status: 'conflict', reason: operation.reconcileReason,
            afterSequence: operation.plan.compileCursor, currentSequence: diagnosticSequence };
        operation.completedAt = new Date().toISOString();
        writeOperation(operation);
        return scriptRecompileReceipt(operation);
    }
    operation.assetDbResult = matching.slice(0, 4).map((item) => ({ command: item.command || null,
        url: item.url, uuid: item.uuid, type: item.type || null }));
    const failedEvents = importFailures.map((item) => ({ sequence: item.sequence, at: item.at, text: item.text }));
    if (failedEvents.length) {
        operation.status = 'failed';
        operation.compile = { status: 'error-observed', afterSequence: operation.plan.compileCursor,
            currentSequence: diagnosticSequence, diagnostics: failedEvents,
            attribution: failedEvents.some((item) => item.text.includes(operation.plan.targetUrl))
                ? 'At least one script import failure names this AssetDB URL.'
                : 'AssetDB reported a script import failure during this single-asset refresh; the event did not name the URL.' };
    } else if (matching.length === 1) {
        operation.status = 'completed';
        operation.compile = { status: 'passed', afterSequence: operation.plan.compileCursor,
            currentSequence: diagnosticSequence, importer: current.importer,
            evidence: 'AssetDB refresh returned the exact script UUID and URL; no script-import-failed event was observed.' };
    } else {
        operation.status = 'unconfirmed';
        operation.compile = { status: 'unconfirmed', afterSequence: operation.plan.compileCursor,
            currentSequence: diagnosticSequence, returnedRows: results.length,
            reason: 'AssetDB did not return the exact script UUID and URL; successful compilation is not confirmed.' };
    }
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    operation.readback = { scriptUuid: current.scriptUuid, importer: current.importer,
        sourceSha256: current.sourceSha256, metaSha256: current.metaSha256 };
    writeOperation(operation);
    return scriptRecompileReceipt(operation);
}

async function reconcileScriptRecompile(input) {
    const operation = readScriptRecompileOperation(input.operationId);
    verifyScriptRecompileIdentity(operation, { requireCurrentContract: false, requireSameInstance: false });
    let current;
    try { current = await verifyScriptRecompilePrecondition(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCRIPT_RECOMPILE_READBACK_FAILED';
        writeOperation(operation);
        return { ...scriptRecompileReceipt(operation), observed: null, reason: operation.reconcileReason };
    }
    if (operation.status === 'applying' || operation.status === 'awaiting-approval') {
        operation.status = 'needs-reconciliation';
        operation.compile = { status: 'unknown', afterSequence: operation.plan.compileCursor,
            reason: 'The Editor session ended or the response was interrupted before the AssetDB result was persisted.' };
    }
    operation.reconciledAt = new Date().toISOString();
    operation.readback = { scriptUuid: current.scriptUuid, importer: current.importer,
        sourceSha256: current.sourceSha256, metaSha256: current.metaSha256 };
    writeOperation(operation);
    return { ...scriptRecompileReceipt(operation), observed: operation.readback,
        retry: 'Never rerun this operation. Start a new plan after reviewing the saved source and compile result.' };
}

async function createScriptModifyPlan(input) {
    if (!Editor.assetdb || typeof Editor.assetdb.saveExists !== 'function') throw coded('ASSETDB_SAVE_EXISTS_UNAVAILABLE');
    const sourceBytes = Buffer.from(input.source, 'utf8');
    if (sourceBytes.length > MAX_WRITE_SOURCE_BYTES || sourceBytes.toString('utf8') !== input.source || input.source.includes('\0'))
        throw coded('SCRIPT_SOURCE_INVALID');
    const current = await currentScriptAsset(input.scriptPath);
    if (current.sourceSha256 !== input.expectedSourceSha256) throw coded('SCRIPT_SOURCE_PRECONDITION_FAILED');
    if (current.source === input.source) throw coded('SCRIPT_SOURCE_NO_CHANGE');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + OPERATION_TTL_MS).toISOString();
    const operationId = uuid();
    const plan = {
        operationId,
        operation: 'creator.script.modify',
        projectRoot: projectRoot(),
        creatorVersion: editorVersion(),
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID,
        scriptPath: input.scriptPath,
        targetUrl: current.targetUrl,
        scriptUuid: current.scriptUuid,
        importer: current.importer,
        assetType: current.assetType,
        metaSha256: current.metaSha256,
        expectedBefore: { sourceSha256: current.sourceSha256, metaSha256: current.metaSha256 },
        expectedAfter: { sourceSha256: fileHash(sourceBytes), sourceBytes: sourceBytes.length },
        compileCursor: diagnosticSequence,
        expiresAt,
    };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        status: 'planned', createdAt, planHash: planFingerprint(plan), source: input.source,
        beforeSource: current.source, plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        scriptPath: plan.scriptPath, targetUrl: plan.targetUrl, scriptUuid: plan.scriptUuid,
        importer: plan.importer, expectedBefore: plan.expectedBefore, expectedAfter: plan.expectedAfter,
        compileCursor: plan.compileCursor, expiresAt,
        diff: { action: 'replace-script-source', targetUrl: plan.targetUrl,
            beforeSha256: plan.expectedBefore.sourceSha256, afterSha256: plan.expectedAfter.sourceSha256,
            metaPreserved: true },
        sourcePreview: input.source,
        recovery: { operationId, priorSourceStoredOutsideProject: true, automaticRetry: false,
            compensationAvailable: false,
            compensationCondition: 'Restore the recorded prior source only through a new approved plan after reading the current source hash.' } };
}

function verifyScriptModifyIdentity(operation) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (plan.extensionVersion !== extensionPackage.version || plan.contractFingerprint !== CONTRACT_FINGERPRINT)
        throw coded('OPERATION_CONTRACT_MISMATCH');
    if (plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (fileHash(Buffer.from(operation.source, 'utf8')) !== plan.expectedAfter.sourceSha256
        || fileHash(Buffer.from(operation.beforeSource, 'utf8')) !== plan.expectedBefore.sourceSha256)
        throw coded('OPERATION_SOURCE_HASH_MISMATCH');
}

async function verifyScriptModifyPrecondition(operation) {
    const plan = operation.plan;
    const current = await currentScriptAsset(plan.scriptPath);
    if (current.targetUrl !== plan.targetUrl || current.scriptUuid !== plan.scriptUuid
        || current.importer !== plan.importer || current.metaSha256 !== plan.metaSha256
        || current.metaSha256 !== plan.expectedBefore.metaSha256
        || current.sourceSha256 !== plan.expectedBefore.sourceSha256)
        throw coded('SCRIPT_MODIFY_PRECONDITION_FAILED');
    return current;
}


function saveExistingAssetThroughAssetDb(url, source) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_SAVE_EXISTS_TIMEOUT'));
        }, 60000);
        try {
            Editor.assetdb.saveExists(url, source, (error, result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_SAVE_EXISTS_FAILED', String(error.message || error))); return; }
                resolve(result || null);
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_SAVE_EXISTS_FAILED', String(error.message || error)));
        }
    });
}

function scriptCompileEvidence(afterSequence) {
    const events = diagnosticEvents.filter((item) => item.sequence > afterSequence);
    const finished = events.filter((item) => item.source === 'creator-builder' && item.text.includes('compile-finished'));
    const errors = events.filter((item) => item.level === 'error');
    return { afterSequence, currentSequence: diagnosticSequence,
        status: errors.length ? 'error-observed' : finished.length ? 'compile-finished-observed' : 'pending',
        attribution: 'All observed diagnostics after the cursor; events are not attributed to this script unless the event payload names it.',
        compileFinished: finished, errors };
}

function scriptModifyReceipt(operation, current) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        scriptPath: plan.scriptPath, targetUrl: plan.targetUrl, scriptUuid: current.scriptUuid,
        importer: current.importer, sourceSha256: current.sourceSha256, metaSha256: current.metaSha256,
        expectedBefore: plan.expectedBefore, expectedAfter: plan.expectedAfter,
        approvedAt: operation.approvedAt || null, approvalSource: operation.approvalSource || null,
        completedAt: operation.completedAt || null,
        compile: scriptCompileEvidence(plan.compileCursor),
        recovery: { operationId: operation.operationId, priorSourceStoredOutsideProject: true,
            automaticRetry: false, metaPreserved: current.metaSha256 === plan.metaSha256,
            restoreRequiresNewApprovedPlan: true } };
}

async function commitScriptModify(input, context) {
    const operation = readScriptModifyOperation(input.operationId);
    verifyScriptModifyIdentity(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'needs-reconciliation' ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try { await verifyScriptModifyPrecondition(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    verifyScriptModifyIdentity(operation);
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try { await verifyScriptModifyPrecondition(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    try {
        await saveExistingAssetThroughAssetDb(operation.plan.targetUrl, operation.source);
        const current = await currentScriptAsset(operation.plan.scriptPath);
        if (current.scriptUuid !== operation.plan.scriptUuid || current.importer !== operation.plan.importer
            || current.sourceSha256 !== operation.plan.expectedAfter.sourceSha256
            || current.metaSha256 !== operation.plan.metaSha256)
            throw coded('SCRIPT_MODIFY_READBACK_MISMATCH');
        operation.status = 'completed';
        operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID;
        operation.result = { scriptUuid: current.scriptUuid, importer: current.importer,
            sourceSha256: current.sourceSha256, metaSha256: current.metaSha256 };
        writeOperation(operation);
        return scriptModifyReceipt(operation, current);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.failedAt = new Date().toISOString();
        operation.lastErrorCode = error.code || 'SCRIPT_MODIFY_FAILED';
        writeOperation(operation);
        throw error;
    }
}

async function reconcileScriptModify(input) {
    const operation = readScriptModifyOperation(input.operationId);
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    let current;
    try { current = await currentScriptAsset(plan.scriptPath); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.lastErrorCode = error.code || 'SCRIPT_READBACK_FAILED';
        writeOperation(operation);
        throw coded('SCRIPT_MODIFY_READBACK_CONFLICT', operation.lastErrorCode);
    }
    if (current.targetUrl !== plan.targetUrl || current.scriptUuid !== plan.scriptUuid
        || current.importer !== plan.importer || current.metaSha256 !== plan.metaSha256) {
        operation.status = 'conflict';
    } else if (current.sourceSha256 === plan.expectedAfter.sourceSha256) {
        operation.status = 'completed';
        operation.result = { scriptUuid: current.scriptUuid, importer: current.importer,
            sourceSha256: current.sourceSha256, metaSha256: current.metaSha256 };
        operation.completedAt = operation.completedAt || new Date().toISOString();
        operation.completedByInstanceId = operation.completedByInstanceId || operation.appliedByInstanceId || INSTANCE_ID;
    } else if (current.sourceSha256 === plan.expectedBefore.sourceSha256) {
        operation.status = operation.status === 'planned' ? 'planned' : 'not-applied';
    } else {
        operation.status = 'conflict';
    }
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return { ...scriptModifyReceipt(operation, current), observed: { sourceSha256: current.sourceSha256,
        metaSha256: current.metaSha256, scriptUuid: current.scriptUuid, importer: current.importer },
        retry: 'Never replay this operation. If the source is unchanged, create a new plan; if it differs, review and read it before planning.' };
}

async function createSceneNodeActivePlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const current = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (typeof current.nodePath !== 'string' || typeof current.active !== 'boolean'
        || current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid)
        throw coded('SCENE_NODE_STATE_INVALID');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    if (current.active === input.active) throw coded('SCENE_NODE_ALREADY_IN_REQUESTED_STATE');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid);
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath) || diskBefore.active !== current.active)
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const createdAt = new Date().toISOString();
    const plan = {
        operationId: uuid(),
        operation: 'creator.scene.node.set-active',
        projectRoot: currentRoot,
        creatorVersion: currentVersion,
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid,
        sceneName: current.sceneName,
        nodeUuid: current.nodeUuid,
        nodePath: current.nodePath,
        expectedBefore: { active: current.active },
        expectedAfter: { active: input.active },
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    if (!isSupportedCreatorVersion(plan.creatorVersion)) throw coded('CREATOR_VERSION_MISMATCH');
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

async function createSceneNodeTransformPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    if (!input.values || typeof input.values !== 'object' || Array.isArray(input.values)) throw coded('SCENE_NODE_TRANSFORM_FIELDS_INVALID');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const current = await callScene('nodeTransformState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        values: input.values }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_NODE_TRANSFORM_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || typeof current.nodePath !== 'string' || !current.transform || typeof current.transform !== 'object')
        throw coded('SCENE_NODE_TRANSFORM_STATE_INVALID');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid);
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath)
        || !sceneDiskTransformMatches(diskBefore.transform, current.transform))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const requestedFields = Object.keys(input.values).sort();
    if (!requestedFields.length) throw coded('SCENE_NODE_TRANSFORM_NO_CHANGE');
    for (const field of requestedFields) {
        if (!Object.prototype.hasOwnProperty.call(current.transform, field)) throw coded('SCENE_NODE_TRANSFORM_FIELD_UNAVAILABLE', field);
    }
    const fields = requestedFields.filter((field) => current.transform[field] !== input.values[field]);
    if (!fields.length) throw coded('SCENE_NODE_TRANSFORM_NO_CHANGE');
    const expectedBefore = {};
    const expectedAfter = {};
    for (const field of fields) {
        expectedBefore[field] = current.transform[field];
        expectedAfter[field] = input.values[field];
    }
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.scene.node.set-transform', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid, sceneName: current.sceneName, nodeUuid: current.nodeUuid,
        nodePath: current.nodePath, expectedBefore, expectedAfter,
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        expectedBefore, expectedAfter, expiresAt: plan.expiresAt,
        savedSceneBaseline: { sourceSha256: plan.diskBefore.sourceSha256, metaSha256: plan.diskBefore.metaSha256 },
        diff: { action: 'set-node-transform', scene: plan.sceneName, node: plan.nodePath,
            changes: fields.map((field) => ({ field, before: expectedBefore[field], after: expectedAfter[field] })) },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.node.set-transform.reconcile',
            sameCreatorSessionRequired: true,
            note: 'The plan binds the saved .fire/.meta baseline; completion requires matching serialized .fire readback after the scene save request. Creator still provides no documented save IPC acknowledgement.' } };
}

async function createSceneButtonEventsPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const node = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!node || node.available !== true) throw coded(node && node.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (node.sceneUuid !== input.sceneUuid || node.nodeUuid !== input.nodeUuid || typeof node.nodePath !== 'string'
        || !node.components.some((item) => item.componentClassName === 'cc.Button'
            && item.componentInstanceId === input.componentInstanceId)) throw coded('SCENE_BUTTON_INSTANCE_NOT_FOUND');
    const current = await callScene('buttonEventsState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        nodePath: node.nodePath, componentInstanceId: input.componentInstanceId, events: input.events }, 30000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_BUTTON_EVENTS_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || current.nodePath !== node.nodePath || current.componentInstanceId !== input.componentInstanceId
        || !Array.isArray(current.events) || !Array.isArray(current.requestedEvents)) throw coded('SCENE_BUTTON_EVENTS_STATE_INVALID');
    if (!current.changed) throw coded('SCENE_BUTTON_EVENTS_NO_CHANGE');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid);
    if (diskBefore.buttonComponentCount !== 1) throw coded('SCENE_DISK_BUTTON_COMPONENT_AMBIGUOUS');
    if (!Array.isArray(diskBefore.buttonEvents)) throw coded('SCENE_DISK_BUTTON_EVENTS_UNREADABLE');
    if (!buttonEventListMatches(diskBefore.buttonEvents, current.events))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.scene.button-events.set', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid, sceneName: current.sceneName, nodeUuid: current.nodeUuid,
        nodePath: current.nodePath, componentInstanceId: current.componentInstanceId,
        expectedBefore: current.events, expectedAfter: current.requestedEvents,
        diskBefore: sceneNodeDiskBaseline(diskBefore, { includeButtonEvents: true }),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentInstanceId: plan.componentInstanceId, expectedBefore: plan.expectedBefore,
        expectedAfter: plan.expectedAfter, expiresAt: plan.expiresAt,
        savedSceneBaseline: { sourceSha256: plan.diskBefore.sourceSha256,
            metaSha256: plan.diskBefore.metaSha256, buttonEvents: plan.diskBefore.buttonEvents },
        diff: { action: 'set-button-click-events', scene: plan.sceneName, node: plan.nodePath,
            componentInstanceId: plan.componentInstanceId, before: plan.expectedBefore, after: plan.expectedAfter },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.button-events.set.reconcile',
            sameCreatorSessionRequired: true,
            note: 'The plan binds the exact saved .fire/.meta and click-event list. Reconcile compares live and disk state; save manually if it reports save-required. Creator 2.4 has no documented scene-save IPC completion acknowledgement.' } };
}

async function createSceneNodeRenamePlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const current = await callScene('nodeNameState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        newName: input.newName }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_NODE_NAME_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || typeof current.nodePath !== 'string' || typeof current.nodeName !== 'string'
        || typeof current.parentUuid !== 'string' || current.nameAvailable !== true)
        throw coded('SCENE_NODE_NAME_STATE_INVALID');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid);
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath) || diskBefore.nodeName !== current.nodeName
        || diskBefore.parentUuid !== current.parentUuid) throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const operationId = uuid();
    const prefix = current.nodePath.slice(0, current.nodePath.lastIndexOf('/') + 1);
    const plan = {
        operationId,
        operation: 'creator.scene.node.rename',
        projectRoot: currentRoot,
        creatorVersion: currentVersion,
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid,
        sceneName: current.sceneName,
        nodeUuid: current.nodeUuid,
        nodePath: current.nodePath,
        expectedBefore: { name: current.nodeName, parentUuid: current.parentUuid, nodePath: current.nodePath },
        expectedAfter: { name: input.newName, parentUuid: current.parentUuid, nodePath: `${prefix}${input.newName}` },
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        expectedBefore: plan.expectedBefore, expectedAfter: plan.expectedAfter, expiresAt: plan.expiresAt,
        diff: { action: 'rename-node', scene: plan.sceneName, nodeUuid: plan.nodeUuid,
            before: { path: plan.expectedBefore.nodePath, name: plan.expectedBefore.name },
            after: { path: plan.expectedAfter.nodePath, name: plan.expectedAfter.name } },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.node.rename.reconcile',
            sceneSaveAcknowledgement: 'Creator 2.4 scene:stash-and-save has no documented completion acknowledgement; reconciliation compares live and saved state and may report save-required.' } };
}

async function createSceneNodeDeletePlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const current = await callScene('nodeDeleteState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_NODE_DELETE_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || typeof current.nodeName !== 'string' || typeof current.nodePath !== 'string'
        || typeof current.parentUuid !== 'string' || !Number.isInteger(current.childCount)
        || !Array.isArray(current.subtree) || current.subtree.length < 1 || current.subtree.length > 256)
        throw coded('SCENE_NODE_DELETE_STATE_INVALID');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid, { includeSubtree: true });
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath) || diskBefore.nodeName !== current.nodeName
        || diskBefore.parentUuid !== current.parentUuid
        || JSON.stringify(diskBefore.subtree) !== JSON.stringify(current.subtree))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.scene.node.delete', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid, sceneName: current.sceneName, nodeUuid: current.nodeUuid,
        expectedBefore: { nodeName: current.nodeName, nodePath: current.nodePath,
            parentUuid: current.parentUuid, childCount: current.childCount, subtree: current.subtree },
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        expectedBefore: plan.expectedBefore, expiresAt: plan.expiresAt,
        diff: { action: 'delete-node-subtree', scene: plan.sceneName, nodeUuid: plan.nodeUuid,
            path: plan.expectedBefore.nodePath, directChildren: plan.expectedBefore.childCount,
            subtreeNodeCount: plan.expectedBefore.subtree.length },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.node.delete.reconcile',
            note: 'Node destruction is deferred by Creator. Completion requires every subtree UUID to be absent from the exact saved .fire; reconciliation observes editor and disk state and never repeats deletion.' } };
}

async function createSceneComponentRemovePlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const node = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!node || node.available !== true) throw coded(node && node.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    const current = await callScene('componentRemoveState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        nodePath: node.nodePath, componentClassName: input.componentClassName,
        componentInstanceId: input.componentInstanceId }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_COMPONENT_REMOVE_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || current.nodePath !== node.nodePath || current.componentClassName !== input.componentClassName
        || current.componentInstanceId !== input.componentInstanceId || current.present !== true
        || !Array.isArray(current.dependentComponents) || typeof current.serializedClassId !== 'string'
        || !current.serializedClassId || current.serializedClassId.length > 128)
        throw coded('SCENE_COMPONENT_REMOVE_STATE_INVALID');
    if (current.dependentComponents.length) throw coded('SCENE_COMPONENT_REQUIRED_BY_OTHER_COMPONENT');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid, { includeComponents: true });
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath)
        || !diskBefore.components.some((component) => component.componentInstanceId === current.componentInstanceId
            && component.serializedClassId === current.serializedClassId))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.scene.node.remove-component', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid, sceneName: current.sceneName, nodeUuid: current.nodeUuid,
        nodePath: current.nodePath, componentClassName: current.componentClassName,
        componentInstanceId: current.componentInstanceId, serializedClassId: current.serializedClassId,
        expectedBefore: { present: true, dependentComponents: [] },
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentClassName: plan.componentClassName, componentInstanceId: plan.componentInstanceId,
        expectedBefore: plan.expectedBefore, expiresAt: plan.expiresAt,
        diff: { action: 'remove-component', scene: plan.sceneName, node: plan.nodePath,
            componentClassName: plan.componentClassName, componentInstanceId: plan.componentInstanceId },
        recovery: { operationId, automaticRetry: false,
            reconcileCommand: 'creator.scene.node.remove-component.reconcile',
            note: 'Creator defers object destruction. The operation observes exact component instance identity and never repeats removal.' } };
}

async function createSceneNodeReparentPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const current = await callScene('nodeReparentState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        targetParentUuid: input.targetParentUuid }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_NODE_REPARENT_STATE_UNAVAILABLE');
    for (const field of ['sceneUuid', 'nodeUuid', 'nodeName', 'nodePath', 'parentUuid', 'parentPath',
        'targetParentUuid', 'targetParentPath', 'afterNodePath']) {
        if (typeof current[field] !== 'string') throw coded('SCENE_NODE_REPARENT_STATE_INVALID');
    }
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || current.targetParentUuid !== input.targetParentUuid || current.localTransformPreserved !== true
        || current.worldTransformPreserved !== false)
        throw coded('SCENE_NODE_REPARENT_STATE_INVALID');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid);
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath) || diskBefore.nodeName !== current.nodeName
        || diskBefore.parentUuid !== current.parentUuid) throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const operationId = uuid();
    const expectedBefore = { nodeName: current.nodeName, nodePath: current.nodePath,
        parentUuid: current.parentUuid, parentPath: current.parentPath,
        targetParentUuid: current.targetParentUuid, targetParentPath: current.targetParentPath,
        afterNodePath: current.afterNodePath };
    const expectedAfter = { ...expectedBefore, nodePath: current.afterNodePath,
        parentUuid: current.targetParentUuid, parentPath: current.targetParentPath };
    const plan = {
        operationId,
        operation: 'creator.scene.node.reparent',
        projectRoot: currentRoot,
        creatorVersion: currentVersion,
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid,
        sceneName: current.sceneName,
        nodeUuid: current.nodeUuid,
        expectedBefore,
        expectedAfter,
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        expectedBefore, expectedAfter, expiresAt: plan.expiresAt,
        localTransformPreserved: true, worldTransformPreserved: false,
        diff: { action: 'reparent-node', scene: plan.sceneName, nodeUuid: plan.nodeUuid,
            before: { path: expectedBefore.nodePath, parentUuid: expectedBefore.parentUuid, parentPath: expectedBefore.parentPath },
            after: { path: expectedAfter.nodePath, parentUuid: expectedAfter.parentUuid, parentPath: expectedAfter.parentPath } },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.node.reparent.reconcile',
            sceneSaveAcknowledgement: 'Creator 2.4 scene:stash-and-save has no documented completion acknowledgement; reconciliation compares live and saved state and may report save-required.' } };
}

async function createSceneComponentAddPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const node = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!node || node.available !== true) throw coded(node && node.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (node.sceneUuid !== input.sceneUuid || node.nodeUuid !== input.nodeUuid || typeof node.nodePath !== 'string')
        throw coded('SCENE_NODE_STATE_INVALID');
    const current = await callScene('componentState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        nodePath: node.nodePath, componentClassName: input.componentClassName }, 20000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_COMPONENT_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid || current.nodePath !== node.nodePath
        || current.componentClassName !== input.componentClassName || !Number.isInteger(current.componentCount))
        throw coded('SCENE_COMPONENT_STATE_INVALID');
    if (current.componentCount !== 0) throw coded('SCENE_COMPONENT_ALREADY_PRESENT');
    if (current.canAdd !== true) throw coded(current.requiresComponent
        ? 'SCENE_COMPONENT_HAS_UNAPPROVED_REQUIREMENT' : 'SCENE_COMPONENT_ALREADY_PRESENT');
    if (typeof current.serializedClassId !== 'string' || !current.serializedClassId || current.serializedClassId.length > 128)
        throw coded('SCENE_COMPONENT_SERIALIZED_CLASS_ID_UNAVAILABLE');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid, { includeComponents: true });
    if (!sceneNodePathsMatch(diskBefore.nodePath, node.nodePath) || diskBefore.components.some((component) =>
        component.serializedClassId === current.serializedClassId))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const operationId = uuid();
    const plan = {
        operationId,
        operation: 'creator.scene.node.add-component',
        projectRoot: currentRoot,
        creatorVersion: currentVersion,
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        sceneUuid: current.sceneUuid,
        sceneName: current.sceneName,
        nodeUuid: current.nodeUuid,
        nodePath: current.nodePath,
        componentClassName: current.componentClassName,
        serializedClassId: current.serializedClassId,
        preserveNodeTransform: current.componentClassName !== 'cc.RichText',
        expectedBefore: { componentCount: current.componentCount },
        expectedAfter: { componentCount: current.componentCount + 1 },
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, sceneName: plan.sceneName,
        sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentClassName: plan.componentClassName, serializedClassId: plan.serializedClassId,
        preserveNodeTransform: plan.preserveNodeTransform,
        expectedBefore: plan.expectedBefore,
        expectedAfter: plan.expectedAfter, expiresAt: plan.expiresAt,
        diff: { action: 'add-component', scene: plan.sceneName, node: plan.nodePath,
            componentClassName: plan.componentClassName, before: 'absent', after: 'one component instance',
            nodeTransform: plan.preserveNodeTransform ? 'preserve existing transform'
                : 'allow RichText content layout to size the node' },
        recovery: { operationId, automaticRetry: false,
            reconcileCommand: 'creator.scene.node.add-component.reconcile',
            sceneSaveAcknowledgement: 'Creator 2.4 scene:stash-and-save has no documented completion acknowledgement. Completion requires the added component ID and serialized class to match on disk.' } };
}

async function composeAssetIdentities(request) {
    const refs = new Map();
    for (const node of request.nodes) if (node.prefabUuid) {
        const previous = refs.get(node.prefabUuid);
        if (previous && previous.assetClass !== 'Prefab') throw coded('SCENE_COMPOSE_ASSET_CLASS_CONFLICT');
        refs.set(node.prefabUuid, { assetUuid: node.prefabUuid, assetClass: 'Prefab' });
    }
    for (const component of request.components) for (const property of component.properties) {
        const value = property.value;
        if (value && typeof value === 'object' && typeof value.assetUuid === 'string') {
            const old = refs.get(value.assetUuid);
            if (old && old.assetClass !== value.assetClass) throw coded('SCENE_COMPOSE_ASSET_CLASS_CONFLICT');
            refs.set(value.assetUuid, { assetUuid: value.assetUuid, assetClass: value.assetClass });
        }
    }
    const output = [];
    for (const ref of refs.values()) {
        const row = await queryAssetByUuid(ref.assetUuid);
        if (!row || typeof row.url !== 'string' || typeof row.uuid !== 'string' || row.uuid !== ref.assetUuid)
            throw coded('SCENE_COMPOSE_ASSET_NOT_FOUND');
        const identity = { ...ref, url: row.url, type: typeof row.type === 'string' ? row.type : null,
            importer: typeof row.importer === 'string' ? row.importer : null };
        if (ref.assetClass === 'Prefab') {
            if (!row.url.startsWith('db://assets/') || !/\.prefab$/i.test(row.url))
                throw coded('SCENE_COMPOSE_PREFAB_ASSET_TYPE_MISMATCH');
            const relative = row.url.slice('db://assets/'.length);
            const prefabFile = safeProjectFile(relative, /\.prefab$/i);
            const metaFile = safeProjectFile(`${relative}.meta`);
            const prefabBytes = readStableProjectFile(prefabFile, MAX_PREFAB_SERIALIZATION_BYTES, 'SCENE_COMPOSE_PREFAB_FILE_UNSAFE');
            const metaBytes = readStableProjectFile(metaFile, MAX_PREFAB_META_BYTES, 'SCENE_COMPOSE_PREFAB_META_UNSAFE');
            let meta;
            try { meta = JSON.parse(metaBytes.toString('utf8')); JSON.parse(prefabBytes.toString('utf8')); }
            catch (_) { throw coded('SCENE_COMPOSE_PREFAB_SERIALIZATION_INVALID'); }
            if (!meta || meta.uuid !== ref.assetUuid || meta.importer !== 'prefab')
                throw coded('SCENE_COMPOSE_PREFAB_META_IDENTITY_MISMATCH');
            const state = await callScene('prefabAssetState', { prefabUuid: ref.assetUuid }, 30000);
            if (!state || state.available !== true || state.prefabUuid !== ref.assetUuid
                || state.assetClassName !== 'cc.Prefab') throw coded(state && state.reason || 'SCENE_COMPOSE_PREFAB_LOAD_FAILED');
            identity.prefabSha256 = fileHash(prefabBytes);
            identity.prefabMetaSha256 = fileHash(metaBytes);
            identity.prefabRootName = state.rootName;
        }
        output.push(identity);
    }
    output.sort((left, right) => left.assetUuid.localeCompare(right.assetUuid));
    return output;
}

async function createSceneComposePlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const operationId = uuid();
    const request = { ...input, nodes: input.nodes.map((node) => ({ ...node, uuid: uuid() })),
        buttonEvents: input.buttonEvents || [], uiEvents: input.uiEvents || [] };
    const expectedState = await callScene('compositionState', request, 30000);
    if (!expectedState || expectedState.available !== true) throw coded(expectedState && expectedState.reason || 'SCENE_COMPOSE_PREFLIGHT_FAILED');
    if (expectedState.sceneUuid !== input.sceneUuid || !Array.isArray(expectedState.existingNodes)
        || expectedState.createdNodes.length !== request.nodes.length) throw coded('SCENE_COMPOSE_PREFLIGHT_INVALID');
    const assetIdentities = await composeAssetIdentities(request);
    const activeSceneAsset = await sceneAssetIdentity(expectedState.sceneUuid);
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const plan = { operationId, operation: 'creator.scene.compose', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: expectedState.sceneUuid, sceneName: expectedState.sceneName,
        sceneAssetIdentity: activeSceneAsset, request, expectedState, assetIdentities,
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, sceneAssetIdentity: plan.sceneAssetIdentity,
        createdNodes: expectedState.createdNodes,
        components: request.components.map((item) => ({ id: item.id, nodeRef: item.nodeRef, className: item.className,
            properties: item.properties.map((property) => ({ name: property.name,
                value: property.value && typeof property.value === 'object' ? { ...property.value } : property.value })) })),
        buttonEvents: request.buttonEvents, uiEvents: request.uiEvents, assetIdentities, expiresAt: plan.expiresAt,
        diff: { action: 'compose-scene', scene: plan.sceneName,
            sceneAsset: { uuid: plan.sceneAssetIdentity.uuid, url: plan.sceneAssetIdentity.url },
            create: expectedState.createdNodes.map((item) => ({ uuid: item.uuid, name: item.name, parentUuid: item.parentUuid,
                transform: item.transform, ...(item.prefabUuid ? { prefabUuid: item.prefabUuid } : {}) })),
            addComponents: request.components.map((item) => ({ nodeRef: item.nodeRef, className: item.className })),
            bindButtonEvents: request.buttonEvents.map((item) => ({ buttonRef: item.buttonRef,
                handlerRef: item.handlerRef, component: item.handlerComponentClassName, handler: item.handler })),
            bindUiEvents: request.uiEvents.map((group) => ({ componentRef: group.componentRef,
                eventProperty: group.eventProperty, events: group.events })),
            resourceReferences: assetIdentities.map((item) => ({ assetUuid: item.assetUuid, url: item.url, type: item.type })) },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.compose.reconcile',
            sceneSaveCompletionConfirmed: false,
            note: 'Creator does not document a scene-save IPC acknowledgement. Commit checks the exact AssetDB .fire and .meta files and only reports completed after semantic disk readback matches the plan.' } };
}

async function createSceneComponentPropertyPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const node = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!node || node.available !== true) throw coded(node && node.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (node.sceneUuid !== input.sceneUuid || node.nodeUuid !== input.nodeUuid || typeof node.nodePath !== 'string')
        throw coded('SCENE_NODE_STATE_INVALID');
    const state = await callScene('componentPropertyState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        nodePath: node.nodePath, componentClassName: input.componentClassName,
        componentInstanceId: input.componentInstanceId, property: input.property, requestedValue: input.value }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_COMPONENT_PROPERTY_STATE_UNAVAILABLE');
    if (state.sceneUuid !== input.sceneUuid || state.nodeUuid !== input.nodeUuid || state.nodePath !== node.nodePath
        || state.componentClassName !== input.componentClassName || state.componentInstanceId !== input.componentInstanceId
        || state.property !== input.property || typeof state.propertyKind !== 'string'
        || !Array.isArray(state.serializedPropertyCandidates) || state.serializedPropertyCandidates.length < 1
        || state.serializedPropertyCandidates.length > 4
        || state.serializedPropertyCandidates.some((property) => typeof property !== 'string'
            || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(property)))
        throw coded('SCENE_COMPONENT_PROPERTY_STATE_INVALID');
    const serializedProperty = state.inspector && state.inspector.serializedProperty;
    if (typeof serializedProperty !== 'string' || !/^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(serializedProperty)
        || !state.serializedPropertyCandidates.includes(serializedProperty))
        throw coded('SCENE_COMPONENT_SERIALIZED_PROPERTY_UNAVAILABLE');
    if (!validSceneComponentValue(input.value) || !validSceneComponentValue(state.value))
        throw coded('SCENE_COMPONENT_PROPERTY_VALUE_INVALID');
    if ((state.serializedValue !== undefined && !validSceneComponentValue(state.serializedValue))
        || (state.requestedSerializedValue !== undefined
            && !validSceneComponentValue(state.requestedSerializedValue)))
        throw coded('SCENE_COMPONENT_SERIALIZED_VALUE_UNAVAILABLE');
    if (state.declaredDefaultValue !== undefined && !validSceneComponentValue(state.declaredDefaultValue))
        throw coded('SCENE_COMPONENT_PROPERTY_DEFAULT_VALUE_INVALID');
    const inputKind = input.value && typeof input.value === 'object' ? input.value.kind : typeof input.value;
    if (inputKind !== state.propertyKind) throw coded('SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH');
    if (inputKind === 'asset' && (!state.value || input.value.assetClass !== state.value.assetClass))
        throw coded('SCENE_COMPONENT_PROPERTY_TYPE_MISMATCH');
    const restoreSerializedOmission = input.restoreDefaultOmitted === true;
    const emptyReference = input.value && typeof input.value === 'object'
        && ['node-ref', 'component-ref', 'asset'].includes(input.value.kind)
        && input.value.nodeUuid === undefined && input.value.componentInstanceId === undefined
        && input.value.assetUuid === undefined;
    if (restoreSerializedOmission && !emptyReference)
        throw coded('SCENE_COMPONENT_PROPERTY_OMITTED_DEFAULT_INVALID');
    if (sceneComponentValuesEqual(state.value, input.value) && !restoreSerializedOmission)
        throw coded('SCENE_COMPONENT_PROPERTY_NO_CHANGE');
    if (typeof state.serializedClassId !== 'string' || !state.serializedClassId || state.serializedClassId.length > 128)
        throw coded('SCENE_COMPONENT_SERIALIZED_CLASS_ID_UNAVAILABLE');
    const referenceClasses = Array.isArray(state.referenceClasses) ? state.referenceClasses : [];
    const serializedBefore = componentValueForDisk(state.value, referenceClasses);
    const serializedAfter = componentValueForDisk(input.value, referenceClasses);
    if (!serializedBefore.verified || !serializedAfter.verified) throw coded('SCENE_COMPONENT_SERIALIZED_VALUE_UNAVAILABLE');
    const serializedBeforeValue = state.serializedValue === undefined ? serializedBefore.value : state.serializedValue;
    const serializedAfterValue = restoreSerializedOmission ? null : state.requestedSerializedValue === undefined
        ? serializedAfter.value : state.requestedSerializedValue;
    let omittedDefault;
    if (state.declaredDefaultValue !== undefined) {
        const serializedDefault = componentValueForDisk(state.declaredDefaultValue, referenceClasses);
        if (serializedDefault.verified && sceneComponentValuesEqual(serializedDefault.value, serializedBefore.value))
            omittedDefault = serializedDefault.value;
    }
    // Creator omits null object references from .fire (for example cc.ScrollView.content
    // serialized as _N$content). The live typed Inspector value is the authority for
    // this default: only accept an omitted disk field when the exact component currently
    // reports a null node/component/asset reference.
    if (omittedDefault === undefined && serializedBefore.value === null
        && ['node-ref', 'component-ref', 'asset'].includes(state.propertyKind)) {
        omittedDefault = null;
    }
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid, { componentProperty: {
        serializedClassId: state.serializedClassId, componentInstanceId: state.componentInstanceId,
        property: state.property, serializedPropertyCandidates: state.serializedPropertyCandidates,
        ...(omittedDefault !== undefined ? { defaultValue: omittedDefault } : {}) } });
    if (restoreSerializedOmission && diskBefore.componentProperty.isDefaultOmitted === true)
        throw coded('SCENE_COMPONENT_PROPERTY_NO_CHANGE');
    if (!sceneNodePathsMatch(diskBefore.nodePath, state.nodePath)
        || diskBefore.componentProperty.property !== state.property
        || !sceneComponentValuesEqual(diskBefore.componentProperty.value, serializedBeforeValue))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const transformBefore = await readSceneComponentPropertyTransform({
        sceneUuid: state.sceneUuid, nodeUuid: state.nodeUuid, nodePath: state.nodePath,
        componentClassName: state.componentClassName, property: state.property,
        diskTransform: diskBefore.transform,
    });
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = {
        operationId,
        operation: 'creator.scene.node.set-component-property',
        projectRoot: currentRoot,
        creatorVersion: currentVersion,
        extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID,
        sceneUuid: state.sceneUuid,
        sceneName: state.sceneName,
        nodeUuid: state.nodeUuid,
        nodePath: state.nodePath,
        componentClassName: state.componentClassName,
        componentInstanceId: state.componentInstanceId,
        property: state.property,
        serializedProperty,
        propertyKind: state.propertyKind,
        ...(restoreSerializedOmission ? { restoreSerializedOmission: true } : {}),
        expectedBefore: { value: state.value },
        expectedAfter: { value: input.value, serializedValue: serializedAfterValue },
        nodeTransformBefore: transformBefore,
        nodeTransformPolicy: 'observe-after-component-property-setter',
        diskBefore: sceneNodeDiskBaseline(diskBefore),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString(),
    };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentClassName: plan.componentClassName, componentInstanceId: plan.componentInstanceId,
        property: plan.property, expectedBefore: plan.expectedBefore, expectedAfter: plan.expectedAfter,
        nodeTransformBefore: plan.nodeTransformBefore, nodeTransformPolicy: plan.nodeTransformPolicy,
        propertyKind: plan.propertyKind, expiresAt: plan.expiresAt,
        savedSceneBaseline: { sourceSha256: plan.diskBefore.sourceSha256, metaSha256: plan.diskBefore.metaSha256,
            componentProperty: plan.diskBefore.componentProperty },
        diff: { action: 'set-component-property', scene: plan.sceneName, node: plan.nodePath,
            componentClassName: plan.componentClassName, componentInstanceId: plan.componentInstanceId,
            property: plan.property, before: plan.expectedBefore.value, after: plan.expectedAfter.value,
            nodeTransformBefore: plan.nodeTransformBefore, nodeTransform: 're-read after the property setter and persisted with the property' },
        recovery: { operationId, automaticRetry: false,
            reconcileCommand: 'creator.scene.node.set-component-property.reconcile',
            sameCreatorSessionRequired: true,
            sceneSaveAcknowledgement: 'Creator 2.4 scene:stash-and-save has no documented completion acknowledgement. Completion requires the exact serialized component identity and property to match on disk.' } };
}

async function createSceneComponentPropertyCompensationPlan(input) {
    const source = readSceneComponentPropertyOperation(input.sourceOperationId);
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    if (source.status !== 'completed' || !source.diskReadback || source.diskReadback.verified !== true
        || source.plan.compensationFor || source.compensationOperationId || source.compensatedByOperationId)
        throw coded('SCENE_COMPONENT_COMPENSATION_SOURCE_NOT_ELIGIBLE');
    const sourceProperty = source.diskReadback.componentProperty;
    if (!sourceProperty || sourceProperty.componentInstanceId !== source.plan.componentInstanceId
        || sourceProperty.serializedClassId !== source.plan.diskBefore.componentProperty.serializedClassId
        || sourceProperty.property !== source.plan.property
        || !sceneComponentValuesEqual(sourceProperty.value, source.plan.expectedAfter.serializedValue))
        throw coded('SCENE_COMPONENT_COMPENSATION_SOURCE_READBACK_MISMATCH');
    const live = await readPlannedSceneComponentProperty(source.plan);
    if (!sceneComponentValuesEqual(live.value, source.plan.expectedAfter.value))
        throw coded('SCENE_COMPONENT_COMPENSATION_SOURCE_STATE_DRIFT');
    const disk = await sceneNodeDiskState(source.plan.sceneUuid, source.plan.nodeUuid, { componentProperty: {
        serializedClassId: source.plan.diskBefore.componentProperty.serializedClassId,
        componentInstanceId: source.plan.componentInstanceId,
        property: source.plan.property,
        // A null reference may have been omitted from the source operation's before-state.
        // The completed after-state has an exact serialized key, which is the correct
        // identity to use when verifying that the field has not drifted before restore.
        serializedPropertyCandidates: [source.diskReadback.componentProperty.serializedProperty],
    } });
    if (!sceneNodePathsMatch(disk.nodePath, source.plan.nodePath)
        || !disk.componentProperty || disk.componentProperty.componentInstanceId !== source.plan.componentInstanceId
        || disk.componentProperty.serializedClassId !== source.plan.diskBefore.componentProperty.serializedClassId
        || disk.componentProperty.property !== source.plan.property
        || !sceneComponentValuesEqual(disk.componentProperty.value, source.plan.expectedAfter.serializedValue)
        || disk.metaSha256 !== source.diskReadback.metaSha256)
        throw coded('SCENE_COMPONENT_COMPENSATION_SOURCE_DISK_DRIFT');
    const planned = await createSceneComponentPropertyPlan({ sceneUuid: source.plan.sceneUuid,
        nodeUuid: source.plan.nodeUuid, componentClassName: source.plan.componentClassName,
        componentInstanceId: source.plan.componentInstanceId, property: source.plan.property,
        value: source.plan.expectedBefore.value });
    const operation = readSceneComponentPropertyOperation(planned.operationId);
    if (!sceneComponentValuesEqual(operation.plan.expectedBefore.value, source.plan.expectedAfter.value)
        || !sceneComponentValuesEqual(operation.plan.expectedAfter.value, source.plan.expectedBefore.value))
        throw coded('SCENE_COMPONENT_COMPENSATION_PLAN_VALUE_MISMATCH');
    operation.plan.compensationFor = { sourceOperationId: source.operationId, sourcePlanHash: source.planHash };
    if (source.plan.nodeTransformBefore && source.nodeTransformAfter
        && !sceneDiskTransformMatches(source.plan.nodeTransformBefore, source.nodeTransformAfter))
        operation.plan.restoreNodeTransform = { ...source.plan.nodeTransformBefore };
    if (source.plan.diskBefore.componentProperty.isDefaultOmitted === true
        && ['node-ref', 'component-ref', 'asset'].includes(source.plan.propertyKind))
        operation.plan.restoreSerializedOmission = true;
    operation.planHash = planFingerprint(operation.plan);
    operation.compensationFor = { sourceOperationId: source.operationId, sourcePlanHash: source.planHash };
    writeOperation(operation);
    source.compensationOperationId = operation.operationId;
    source.compensationPlanHash = operation.planHash;
    source.compensationPlannedAt = new Date().toISOString();
    writeOperation(source);
    return { ...planned, planHash: operation.planHash, compensationFor: operation.plan.compensationFor,
        sourceOperationStatus: source.status, sourceDiskSha256: source.diskReadback.sourceSha256,
        diff: { ...planned.diff, action: 'compensate-component-property',
            sourceOperationId: source.operationId, sourcePlanHash: source.planHash,
            restoreNodeTransform: operation.plan.restoreNodeTransform || null,
            before: operation.plan.expectedBefore.value, after: operation.plan.expectedAfter.value } };
}

function verifySceneComponentPropertyCompensationSource(operation) {
    const link = operation && operation.plan && operation.plan.compensationFor;
    if (!link || typeof link.sourceOperationId !== 'string' || typeof link.sourcePlanHash !== 'string')
        throw coded('SCENE_COMPONENT_COMPENSATION_LINK_INVALID');
    const source = readSceneComponentPropertyOperation(link.sourceOperationId);
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    if (source.status !== 'completed' || source.planHash !== link.sourcePlanHash
        || source.compensationOperationId !== operation.operationId
        || source.compensationPlanHash !== operation.planHash
        || source.compensatedByOperationId && source.compensatedByOperationId !== operation.operationId
        || source.plan.projectRoot !== operation.plan.projectRoot
        || source.plan.creatorVersion !== operation.plan.creatorVersion
        || source.plan.sceneUuid !== operation.plan.sceneUuid || source.plan.nodeUuid !== operation.plan.nodeUuid
        || source.plan.nodePath !== operation.plan.nodePath
        || source.plan.componentClassName !== operation.plan.componentClassName
        || source.plan.componentInstanceId !== operation.plan.componentInstanceId
        || source.plan.property !== operation.plan.property
        || !sceneComponentValuesEqual(operation.plan.expectedBefore.value, source.plan.expectedAfter.value)
        || !sceneComponentValuesEqual(operation.plan.expectedAfter.value, source.plan.expectedBefore.value)
        || !source.diskReadback || source.diskReadback.verified !== true
        || !sceneComponentValuesEqual(source.diskReadback.componentProperty && source.diskReadback.componentProperty.value,
            source.plan.expectedAfter.serializedValue))
        throw coded('SCENE_COMPONENT_COMPENSATION_SOURCE_MISMATCH');
    return source;
}

function linkCompletedSceneComponentPropertyCompensation(operation) {
    if (!operation.plan.compensationFor) return null;
    const source = verifySceneComponentPropertyCompensationSource(operation);
    source.compensatedByOperationId = operation.operationId;
    source.compensatedAt = new Date().toISOString();
    source.compensationDiskReadback = operation.diskReadback || null;
    writeOperation(source);
    return source;
}

function verifySceneOperationIdentity(operation, { requireCurrentContract = true } = {}) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
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

async function readPlannedSceneNodeRename(plan) {
    const state = await callScene('nodeNameState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_NODE_NAME_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid)
        throw coded('OPERATION_TARGET_MISMATCH');
    return state;
}

async function readPlannedSceneNodeReparent(plan) {
    const state = await callScene('nodeReparentState', { sceneUuid: plan.sceneUuid,
        nodeUuid: plan.nodeUuid, targetParentUuid: plan.expectedBefore.targetParentUuid,
        allowCurrentTarget: true }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_NODE_REPARENT_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid
        || state.targetParentUuid !== plan.expectedBefore.targetParentUuid) throw coded('OPERATION_TARGET_MISMATCH');
    return state;
}

function renameStateMatches(state, expected) {
    return state && state.available === true && state.nodeName === expected.name
        && state.parentUuid === expected.parentUuid && state.nodePath === expected.nodePath;
}

function reparentStateMatches(state, expected) {
    return state && state.available === true && state.nodeName === expected.nodeName
        && state.nodePath === expected.nodePath && state.parentUuid === expected.parentUuid
        && state.parentPath === expected.parentPath && state.targetParentUuid === expected.targetParentUuid
        && state.targetParentPath === expected.targetParentPath && state.afterNodePath === expected.afterNodePath;
}


function sceneNodeActiveReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, sceneName: plan.sceneName, sceneUuid: plan.sceneUuid,
        nodePath: plan.nodePath, nodeUuid: plan.nodeUuid, beforeActive: plan.expectedBefore.active,
        active: state.active, sceneSaveRequestSent: !!operation.sceneSaveRequestSent,
        sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: !!(operation.diskReadback && operation.diskReadback.verified === true),
        diskReadback: operation.diskReadback || null, plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.node.set-active.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'Creator 2.4 has no documented scene-save IPC acknowledgement. scenePersistenceConfirmed is true only after the exact AssetDB .fire/.meta and serialized node state read back from disk.' } };
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
    await verifySceneNodeDiskBefore(operation.plan);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
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
    await confirmSceneNodeDiskPersistence(operation);
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
    let diskState = null;
    if (operation.plan.diskBefore) {
        try { diskState = await reconcileSceneNodeDiskOperation(operation,
            observed.active === operation.plan.expectedBefore.active,
            observed.active === operation.plan.expectedAfter.active); }
        catch (error) {
            operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
            operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
            return { ...sceneNodeActiveReceipt(operation, observed), observed: { active: observed.active,
                sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath, disk: null },
                reason: operation.reconcileReason };
        }
    } else if (observed.active === operation.plan.expectedBefore.active) {
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
        sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath,
        ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
            active: diskState.disk.active, nodePath: diskState.disk.nodePath,
            matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never retry this operation. If the scene remains unchanged, create a new plan; if save-required, save the scene in Creator and inspect the result.' };
}

function transformMapMatches(transform, expected) {
    return !!transform && Object.keys(expected).every((field) => transform[field] === expected[field]);
}


function sceneNodeTransformReceipt(operation, state) {
    const plan = operation.plan;
    const fields = Object.keys(plan.expectedAfter);
    return { operationId: operation.operationId, status: operation.status,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        before: plan.expectedBefore, after: state && state.transform
            ? Object.fromEntries(fields.map((field) => [field, state.transform[field]])) : null,
        transform: state && state.transform || null, sceneSaveRequestSent: !!operation.sceneSaveRequestSent,
        sceneSaveCompletionConfirmed: false, scenePersistenceConfirmed: !!(operation.diskReadback && operation.diskReadback.verified === true),
        diskReadback: operation.diskReadback || null, plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.node.set-transform.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'The scene-save IPC has no documented completion acknowledgement. scenePersistenceConfirmed is true only after the exact AssetDB .fire/.meta and serialized node transform read back from disk.' } };
}

async function commitSceneNodeTransform(input, context) {
    const operation = readSceneNodeTransformOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'mutation-applied' || operation.status === 'save-requested'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before = await readPlannedSceneNode(operation.plan);
    if (!transformMapMatches(before.transform, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
    await verifySceneNodeDiskBefore(operation.plan);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    if (!await authorizeCommit()) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try {
        verifySceneOperationIdentity(operation);
        if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
        before = await readPlannedSceneNode(operation.plan);
        if (!transformMapMatches(before.transform, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString(); writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    const mutation = await callScene('setNodeTransform', { sceneUuid: operation.plan.sceneUuid,
        nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
        expectedBefore: operation.plan.expectedBefore, values: operation.plan.expectedAfter }, 20000);
    if (!mutation || mutation.available !== true || !transformMapMatches(mutation.after, operation.plan.expectedAfter)) {
        operation.status = mutation && mutation.mutationStarted ? 'mutation-applied' : 'conflict';
        operation.lastErrorCode = mutation && mutation.reason || 'SCENE_NODE_TRANSFORM_WRITE_READBACK_FAILED';
        writeOperation(operation);
        throw coded(operation.lastErrorCode);
    }
    operation.status = 'mutation-applied'; operation.mutationAppliedAt = new Date().toISOString(); writeOperation(operation);
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error)); }
    operation.status = 'save-requested'; operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString(); writeOperation(operation);
    const readback = await readPlannedSceneNode(operation.plan);
    if (!transformMapMatches(readback.transform, operation.plan.expectedAfter)) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    let diskReadback;
    try { diskReadback = await waitForSceneNodeDiskAfter(operation); }
    catch (error) {
        operation.status = 'save-required'; operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_UNCONFIRMED';
        operation.diskReadbackFailureAt = new Date().toISOString(); writeOperation(operation);
        throw coded('SCENE_DISK_READBACK_UNCONFIRMED', operation.reconcileReason);
    }
    operation.diskReadback = { verified: true, sceneUrl: diskReadback.sceneUrl,
        sceneUuid: diskReadback.sceneUuid, nodePath: diskReadback.nodePath, nodeUuid: diskReadback.nodeUuid,
        sourceSha256: diskReadback.sourceSha256, metaSha256: diskReadback.metaSha256,
        transform: diskReadback.transform, active: diskReadback.active, verifiedAt: new Date().toISOString() };
    operation.status = 'completed'; operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID; writeOperation(operation);
    return sceneNodeTransformReceipt(operation, readback);
}

async function reconcileSceneNodeTransform(input) {
    const operation = readSceneNodeTransformOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneNode(operation.plan); }
    catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_NODE_STATE_UNAVAILABLE'; writeOperation(operation);
        return { ...sceneNodeTransformReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    if (operation.plan.diskBefore) {
        let disk;
        try { disk = await sceneNodeDiskState(operation.plan.sceneUuid, operation.plan.nodeUuid); }
        catch (error) {
            operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
            operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
            return { ...sceneNodeTransformReceipt(operation, observed), observed: { transform: observed.transform,
                sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath,
                disk: null }, reason: operation.reconcileReason };
        }
        const liveBefore = transformMapMatches(observed.transform, operation.plan.expectedBefore);
        const liveAfter = transformMapMatches(observed.transform, operation.plan.expectedAfter);
        const diskBefore = disk.sourceSha256 === operation.plan.diskBefore.sourceSha256
            && sceneNodeDiskMatchesPlan(disk, operation.plan, 'before');
        const diskAfter = disk.sourceSha256 !== operation.plan.diskBefore.sourceSha256
            && sceneNodeDiskMatchesPlan(disk, operation.plan, 'after');
        const mutationMayHaveRun = operation.appliedByInstanceId === INSTANCE_ID
            || ['applying', 'mutation-applied', 'save-requested', 'save-required', 'completed'].includes(operation.status);
        if (mutationMayHaveRun && liveAfter && diskAfter) {
            operation.status = 'completed'; operation.reconcileReason = null;
            operation.diskReadback = { verified: true, sceneUrl: disk.sceneUrl, sceneUuid: disk.sceneUuid,
                nodePath: disk.nodePath, nodeUuid: disk.nodeUuid, sourceSha256: disk.sourceSha256,
                metaSha256: disk.metaSha256, transform: disk.transform, active: disk.active,
                verifiedAt: new Date().toISOString() };
        } else if (mutationMayHaveRun && liveAfter && diskBefore) {
            operation.status = 'save-required'; operation.reconcileReason = 'SCENE_MEMORY_UPDATED_BUT_DISK_UNCHANGED';
        } else if (liveBefore && diskBefore && ['planned', 'awaiting-approval', 'applying', 'not-applied'].includes(operation.status)) {
            operation.status = 'not-applied'; operation.reconcileReason = null;
        } else {
            operation.status = 'conflict'; operation.reconcileReason = 'SCENE_MEMORY_DISK_STATE_MISMATCH';
        }
        operation.reconciledAt = new Date().toISOString();
        if (operation.status === 'completed') operation.completedAt = operation.completedAt || operation.reconciledAt;
        writeOperation(operation);
        return { ...sceneNodeTransformReceipt(operation, observed), observed: {
            transform: Object.fromEntries(Object.keys(operation.plan.expectedAfter).map((field) => [field, observed.transform[field]])),
            sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath,
            disk: { sourceSha256: disk.sourceSha256, metaSha256: disk.metaSha256,
                nodePath: disk.nodePath, transform: disk.transform, matchesBefore: diskBefore, matchesAfter: diskAfter } },
            retry: operation.status === 'save-required'
                ? 'Save the scene in Creator, then reconcile again; do not replay this operation.'
                : 'Never replay this operation. Create a new plan only after reviewing the observed editor and disk state.' };
    }
    if (transformMapMatches(observed.transform, operation.plan.expectedBefore)) {
        if (['applying', 'awaiting-approval'].includes(operation.status)) operation.status = 'not-applied';
        else if (['mutation-applied', 'save-requested', 'completed'].includes(operation.status)) operation.status = 'conflict';
    } else if (transformMapMatches(observed.transform, operation.plan.expectedAfter)) {
        if (operation.status === 'save-requested' || operation.status === 'completed') operation.status = 'completed';
        else if (['mutation-applied', 'applying'].includes(operation.status)) operation.status = 'save-required';
        else operation.status = 'conflict';
    } else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...sceneNodeTransformReceipt(operation, observed), observed: {
        transform: Object.fromEntries(Object.keys(operation.plan.expectedAfter).map((field) => [field, observed.transform[field]])),
        sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath },
        retry: 'Never retry this operation. If unchanged, create a new plan; if save-required, save manually in Creator and review before continuing.' };
}

async function readPlannedSceneButtonEvents(plan) {
    const state = await callScene('buttonEventsState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.nodePath, componentInstanceId: plan.componentInstanceId }, 20000);
    if (!state || state.available !== true || state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid
        || state.nodePath !== plan.nodePath || state.componentInstanceId !== plan.componentInstanceId
        || !Array.isArray(state.events)) throw coded(state && state.reason || 'SCENE_BUTTON_EVENTS_STATE_UNAVAILABLE');
    return state;
}

function buttonEventListMatches(actual, expected) {
    return Array.isArray(actual) && Array.isArray(expected) && sceneComponentValuesEqual(actual, expected);
}


function sceneButtonEventsReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentInstanceId: plan.componentInstanceId, before: plan.expectedBefore,
        events: state && state.events || null, sceneSaveRequestSent: !!operation.sceneSaveRequestSent,
        sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: !!(operation.diskReadback && operation.diskReadback.verified === true),
        diskReadback: operation.diskReadback || null, plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.button-events.set.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'Creator 2.4 has no documented scene-save IPC acknowledgement. scenePersistenceConfirmed requires the exact serialized Button event list to read back from the saved .fire file.' } };
}

async function commitSceneButtonEvents(input, context) {
    const operation = readSceneButtonEventsOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'mutation-applied' || operation.status === 'save-requested'
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before = await readPlannedSceneButtonEvents(operation.plan);
    if (!buttonEventListMatches(before.events, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
    await verifySceneNodeDiskBefore(operation.plan);
    operation.status = 'applying'; operation.approvalRequestedAt = new Date().toISOString(); writeOperation(operation);
    if (!await authorizeCommit()) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    try {
        verifySceneOperationIdentity(operation);
        if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
        before = await readPlannedSceneButtonEvents(operation.plan);
        if (!buttonEventListMatches(before.events, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString(); writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    const mutation = await callScene('setButtonEvents', { sceneUuid: operation.plan.sceneUuid,
        nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
        componentInstanceId: operation.plan.componentInstanceId, expectedBefore: operation.plan.expectedBefore,
        events: operation.plan.expectedAfter }, 30000);
    if (!mutation || mutation.available !== true || !buttonEventListMatches(mutation.events, operation.plan.expectedAfter)) {
        operation.status = mutation && mutation.mutationStarted ? 'mutation-applied' : 'conflict';
        operation.lastErrorCode = mutation && mutation.reason || 'SCENE_BUTTON_EVENTS_WRITE_READBACK_FAILED';
        writeOperation(operation); throw coded(operation.lastErrorCode);
    }
    operation.status = 'mutation-applied'; operation.mutationAppliedAt = new Date().toISOString(); writeOperation(operation);
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error)); }
    operation.status = 'save-requested'; operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString(); writeOperation(operation);
    const readback = await readPlannedSceneButtonEvents(operation.plan);
    if (!buttonEventListMatches(readback.events, operation.plan.expectedAfter)) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed'; operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID; writeOperation(operation);
    return sceneButtonEventsReceipt(operation, readback);
}

async function reconcileSceneButtonEvents(input) {
    const operation = readSceneButtonEventsOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneButtonEvents(operation.plan); }
    catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_BUTTON_EVENTS_STATE_UNAVAILABLE'; writeOperation(operation);
        return { ...sceneButtonEventsReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    let diskState = null;
    if (operation.plan.diskBefore) {
        try { diskState = await reconcileSceneNodeDiskOperation(operation,
            buttonEventListMatches(observed.events, operation.plan.expectedBefore),
            buttonEventListMatches(observed.events, operation.plan.expectedAfter)); }
        catch (error) {
            operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
            operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
            return { ...sceneButtonEventsReceipt(operation, observed), observed: { events: observed.events,
                sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath, disk: null },
                reason: operation.reconcileReason };
        }
    } else if (buttonEventListMatches(observed.events, operation.plan.expectedBefore)) {
        if (['applying', 'awaiting-approval'].includes(operation.status)) operation.status = 'not-applied';
        else if (['mutation-applied', 'save-requested', 'completed'].includes(operation.status)) operation.status = 'conflict';
    } else if (buttonEventListMatches(observed.events, operation.plan.expectedAfter)) {
        if (operation.status === 'save-requested' || operation.status === 'completed') operation.status = 'completed';
        else if (['mutation-applied', 'applying'].includes(operation.status)) operation.status = 'save-required';
        else operation.status = 'conflict';
    } else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...sceneButtonEventsReceipt(operation, observed), observed: { events: observed.events,
        sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath,
        ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
            buttonEvents: diskState.disk.buttonEvents, matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never replay this operation. If unchanged, create a new plan; if save-required, save manually in Creator and review before continuing.' };
}


async function createSceneUiEventsPlan(input) {
    if (!Editor.Scene || typeof Editor.Scene.callSceneScript !== 'function') throw coded('SCENE_API_UNAVAILABLE');
    if (!(UI_EVENT_PROPERTIES[input.componentClassName] || []).includes(input.eventProperty))
        throw coded('SCENE_UI_EVENT_PROPERTY_UNSUPPORTED');
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    const node = await callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (!node || node.available !== true) throw coded(node && node.reason || 'SCENE_NODE_STATE_UNAVAILABLE');
    if (node.sceneUuid !== input.sceneUuid || node.nodeUuid !== input.nodeUuid || typeof node.nodePath !== 'string')
        throw coded('SCENE_NODE_STATE_INVALID');
    const component = node.components.find((item) => item.componentClassName === input.componentClassName
        && item.componentInstanceId === input.componentInstanceId);
    if (!component) throw coded('SCENE_UI_COMPONENT_INSTANCE_NOT_FOUND');
    const current = await callScene('uiEventsState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid,
        nodePath: node.nodePath, componentClassName: input.componentClassName,
        eventProperty: input.eventProperty, componentInstanceId: input.componentInstanceId,
        events: input.events }, 30000);
    if (!current || current.available !== true) throw coded(current && current.reason || 'SCENE_UI_EVENTS_STATE_UNAVAILABLE');
    if (current.sceneUuid !== input.sceneUuid || current.nodeUuid !== input.nodeUuid
        || current.nodePath !== node.nodePath || current.componentClassName !== input.componentClassName
        || current.eventProperty !== input.eventProperty || current.componentInstanceId !== input.componentInstanceId
        || typeof current.serializedClassId !== 'string' || !Array.isArray(current.events)
        || !Array.isArray(current.requestedEvents)) throw coded('SCENE_UI_EVENTS_STATE_INVALID');
    if (!current.changed) throw coded('SCENE_UI_EVENTS_NO_CHANGE');
    const selector = { componentInstanceId: current.componentInstanceId,
        serializedClassId: current.serializedClassId, eventProperty: current.eventProperty };
    const diskBefore = await sceneNodeDiskState(input.sceneUuid, input.nodeUuid, { componentEvents: selector });
    if (!sceneNodePathsMatch(diskBefore.nodePath, current.nodePath)
        || !sceneComponentValuesEqual(diskBefore.componentEvents, { ...selector, events: current.events }))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.scene.ui-events.set', projectRoot: currentRoot,
        creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        sceneUuid: current.sceneUuid, sceneName: current.sceneName, nodeUuid: current.nodeUuid,
        nodePath: current.nodePath, componentClassName: current.componentClassName,
        serializedClassId: current.serializedClassId, eventProperty: current.eventProperty,
        componentInstanceId: current.componentInstanceId, expectedBefore: current.events,
        expectedAfter: current.requestedEvents,
        diskBefore: sceneNodeDiskBaseline(diskBefore, { includeComponentEvents: true }),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentClassName: plan.componentClassName, eventProperty: plan.eventProperty,
        componentInstanceId: plan.componentInstanceId, expectedBefore: plan.expectedBefore,
        expectedAfter: plan.expectedAfter, expiresAt: plan.expiresAt,
        savedSceneBaseline: { sourceSha256: plan.diskBefore.sourceSha256,
            metaSha256: plan.diskBefore.metaSha256, componentEvents: plan.diskBefore.componentEvents },
        diff: { action: 'set-ui-event-list', componentClassName: plan.componentClassName,
            eventProperty: plan.eventProperty, scene: plan.sceneName, node: plan.nodePath,
            componentInstanceId: plan.componentInstanceId, before: plan.expectedBefore, after: plan.expectedAfter },
        recovery: { operationId, automaticRetry: false, reconcileCommand: 'creator.scene.ui-events.set.reconcile',
            sameCreatorSessionRequired: true,
            note: 'The plan binds the exact component event list and saved .fire/.meta. Reconcile only observes live and disk state; save manually if it reports save-required.' } };
}

async function createSceneUiEventsCompensationPlan(input) {
    const source = readSceneUiEventsOperation(input.sourceOperationId);
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    if (source.status !== 'completed' || !source.diskReadback || source.diskReadback.verified !== true
        || source.plan.compensationFor || source.compensatedByOperationId)
        throw coded('SCENE_UI_EVENTS_COMPENSATION_SOURCE_NOT_ELIGIBLE');
    let supersededCompensation = null;
    if (source.compensationOperationId) {
        const previous = readSceneUiEventsOperation(source.compensationOperationId);
        const previousLink = previous.plan && previous.plan.compensationFor;
        if (previous.status !== 'not-applied' || !previous.reconciledAt
            || previous.planHash !== source.compensationPlanHash
            || !previousLink || previousLink.sourceOperationId !== source.operationId
            || previousLink.sourcePlanHash !== source.planHash
            || !sceneComponentValuesEqual(previous.plan.expectedBefore, source.plan.expectedAfter)
            || !sceneComponentValuesEqual(previous.plan.expectedAfter, source.plan.expectedBefore))
            throw coded('SCENE_UI_EVENTS_COMPENSATION_ALREADY_RESERVED');
        supersededCompensation = previous;
    }
    const sourceEvents = source.diskReadback.componentEvents;
    if (!sourceEvents || sourceEvents.componentInstanceId !== source.plan.componentInstanceId
        || sourceEvents.serializedClassId !== source.plan.serializedClassId
        || sourceEvents.eventProperty !== source.plan.eventProperty
        || !sceneComponentValuesEqual(sourceEvents.events, source.plan.expectedAfter))
        throw coded('SCENE_UI_EVENTS_COMPENSATION_SOURCE_READBACK_MISMATCH');
    const live = await readPlannedSceneUiEvents(source.plan);
    if (!sceneComponentValuesEqual(live.events, source.plan.expectedAfter))
        throw coded('SCENE_UI_EVENTS_COMPENSATION_SOURCE_STATE_DRIFT');
    const planned = await createSceneUiEventsPlan({ sceneUuid: source.plan.sceneUuid,
        nodeUuid: source.plan.nodeUuid, componentClassName: source.plan.componentClassName,
        eventProperty: source.plan.eventProperty, componentInstanceId: source.plan.componentInstanceId,
        events: source.plan.expectedBefore });
    const operation = readSceneUiEventsOperation(planned.operationId);
    operation.plan.compensationFor = { sourceOperationId: source.operationId, sourcePlanHash: source.planHash };
    operation.planHash = planFingerprint(operation.plan);
    writeOperation(operation);
    if (supersededCompensation) {
        supersededCompensation.status = 'superseded';
        supersededCompensation.supersededAt = new Date().toISOString();
        supersededCompensation.supersededByOperationId = operation.operationId;
        writeOperation(supersededCompensation);
        source.supersededCompensationOperationIds = [
            ...(Array.isArray(source.supersededCompensationOperationIds) ? source.supersededCompensationOperationIds : []),
            supersededCompensation.operationId,
        ];
    }
    source.compensationOperationId = operation.operationId;
    source.compensationPlanHash = operation.planHash;
    source.compensationPlannedAt = new Date().toISOString();
    writeOperation(source);
    return { ...planned, planHash: operation.planHash, compensationFor: operation.plan.compensationFor,
        sourceOperationStatus: source.status, sourceDiskSha256: source.diskReadback.sourceSha256,
        diff: { ...planned.diff, action: 'compensate-ui-event-list',
            sourceOperationId: source.operationId, sourcePlanHash: source.planHash } };
}

function verifySceneUiEventsCompensationSource(operation) {
    const link = operation && operation.plan && operation.plan.compensationFor;
    if (!link || typeof link.sourceOperationId !== 'string' || typeof link.sourcePlanHash !== 'string')
        throw coded('SCENE_UI_EVENTS_COMPENSATION_LINK_INVALID');
    const source = readSceneUiEventsOperation(link.sourceOperationId);
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    if (source.status !== 'completed' || source.planHash !== link.sourcePlanHash
        || source.compensationOperationId !== operation.operationId
        || source.compensationPlanHash !== operation.planHash
        || (source.compensatedByOperationId && source.compensatedByOperationId !== operation.operationId)
        || source.plan.projectRoot !== operation.plan.projectRoot
        || source.plan.creatorVersion !== operation.plan.creatorVersion
        || source.plan.sceneUuid !== operation.plan.sceneUuid || source.plan.nodeUuid !== operation.plan.nodeUuid
        || source.plan.nodePath !== operation.plan.nodePath
        || source.plan.componentClassName !== operation.plan.componentClassName
        || source.plan.componentInstanceId !== operation.plan.componentInstanceId
        || source.plan.eventProperty !== operation.plan.eventProperty
        || !sceneComponentValuesEqual(operation.plan.expectedBefore, source.plan.expectedAfter)
        || !sceneComponentValuesEqual(operation.plan.expectedAfter, source.plan.expectedBefore)
        || !source.diskReadback || source.diskReadback.verified !== true
        || !source.diskReadback.componentEvents
        || !sceneComponentValuesEqual(source.diskReadback.componentEvents.events, source.plan.expectedAfter))
        throw coded('SCENE_UI_EVENTS_COMPENSATION_SOURCE_MISMATCH');
    return source;
}

function linkCompletedSceneUiEventsCompensation(operation) {
    if (!operation.plan.compensationFor) return null;
    const source = verifySceneUiEventsCompensationSource(operation);
    source.compensatedByOperationId = operation.operationId;
    source.compensatedAt = new Date().toISOString();
    source.compensationDiskReadback = operation.diskReadback || null;
    writeOperation(source);
    return source;
}

async function readPlannedSceneUiEvents(plan) {
    const state = await callScene('uiEventsState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.nodePath, componentClassName: plan.componentClassName,
        eventProperty: plan.eventProperty, componentInstanceId: plan.componentInstanceId }, 20000);
    if (!state || state.available !== true || state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid
        || state.nodePath !== plan.nodePath || state.componentClassName !== plan.componentClassName
        || state.serializedClassId !== plan.serializedClassId || state.eventProperty !== plan.eventProperty
        || state.componentInstanceId !== plan.componentInstanceId || !Array.isArray(state.events))
        throw coded(state && state.reason || 'SCENE_UI_EVENTS_STATE_UNAVAILABLE');
    return state;
}

function sceneUiEventsReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentClassName: plan.componentClassName, eventProperty: plan.eventProperty,
        componentInstanceId: plan.componentInstanceId, before: plan.expectedBefore,
        events: state && state.events || null, sceneSaveRequestSent: !!operation.sceneSaveRequestSent,
        sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: !!(operation.diskReadback && operation.diskReadback.verified === true),
        diskReadback: operation.diskReadback || null, compensationFor: plan.compensationFor || null,
        plannedByInstanceId: operation.plannedByInstanceId,
        appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: plan.compensationFor
                ? 'creator.scene.ui-events.set.compensate.reconcile' : 'creator.scene.ui-events.set.reconcile',
            sameCreatorSessionRequired: !plan.compensationFor,
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: plan.compensationFor
                ? 'A source-linked event compensation can be reconciled after Creator restart only when the exact component identity and serialized event list match the bound disk state.'
                : 'Persistence is confirmed only when the exact serialized event list is read back from the saved .fire.' } };
}

async function commitSceneUiEvents(input) {
    const operation = readSceneUiEventsOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (operation.plan.compensationFor) verifySceneUiEventsCompensationSource(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'mutation-applied',
        'save-requested', 'save-required'].includes(operation.status)
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before;
    try {
        before = await readPlannedSceneUiEvents(operation.plan);
        if (!buttonEventListMatches(before.events, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString(); writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    if (operation.plan.compensationFor) verifySceneUiEventsCompensationSource(operation);
    const mutation = await callScene('setUiEvents', { sceneUuid: operation.plan.sceneUuid,
        nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
        componentClassName: operation.plan.componentClassName, eventProperty: operation.plan.eventProperty,
        componentInstanceId: operation.plan.componentInstanceId, expectedBefore: operation.plan.expectedBefore,
        events: operation.plan.expectedAfter }, 30000);
    if (!mutation || mutation.available !== true || !buttonEventListMatches(mutation.events, operation.plan.expectedAfter)) {
        operation.status = mutation && mutation.mutationStarted ? 'mutation-applied' : 'conflict';
        operation.lastErrorCode = mutation && mutation.reason || 'SCENE_UI_EVENTS_WRITE_READBACK_FAILED';
        writeOperation(operation); throw coded(operation.lastErrorCode);
    }
    operation.status = 'mutation-applied'; operation.mutationAppliedAt = new Date().toISOString(); writeOperation(operation);
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error)); }
    operation.status = 'save-requested'; operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString(); writeOperation(operation);
    const readback = await readPlannedSceneUiEvents(operation.plan);
    if (!buttonEventListMatches(readback.events, operation.plan.expectedAfter)) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed'; operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID; writeOperation(operation);
    linkCompletedSceneUiEventsCompensation(operation);
    return sceneUiEventsReceipt(operation, readback);
}

async function reconcileSceneUiEvents(input) {
    const operation = readSceneUiEventsOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneUiEvents(operation.plan); }
    catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_UI_EVENTS_STATE_UNAVAILABLE'; writeOperation(operation);
        return { ...sceneUiEventsReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    let diskState = null;
    try {
        if (operation.plan.compensationFor) verifySceneUiEventsCompensationSource(operation);
        diskState = await reconcileSceneNodeDiskOperation(operation,
            buttonEventListMatches(observed.events, operation.plan.expectedBefore),
            buttonEventListMatches(observed.events, operation.plan.expectedAfter));
    }
    catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
        return { ...sceneUiEventsReceipt(operation, observed), observed: { events: observed.events,
            sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath, disk: null },
            reason: operation.reconcileReason };
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    if (operation.status === 'completed' && operation.plan.compensationFor)
        linkCompletedSceneUiEventsCompensation(operation);
    return { ...sceneUiEventsReceipt(operation, observed), observed: { events: observed.events,
        sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid, nodePath: observed.nodePath,
        ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256,
            metaSha256: diskState.disk.metaSha256, componentEvents: diskState.disk.componentEvents,
            matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never replay this operation. Create a new plan after reviewing live and saved state.' };
}


function sceneNodeRenameReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        before: plan.expectedBefore, after: state && state.available ? {
            name: state.nodeName, nodePath: state.nodePath, parentUuid: state.parentUuid,
        } : null,
        sceneSaveRequestSent: !!operation.sceneSaveRequestSent, sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: !!(operation.diskReadback && operation.diskReadback.verified === true),
        diskReadback: operation.diskReadback || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.node.rename.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'Creator 2.4 has no documented scene-save IPC acknowledgement. scenePersistenceConfirmed requires serialized name, parent and path to match the exact saved .fire readback.' } };
}

async function commitSceneNodeRename(input, context) {
    const operation = readSceneNodeRenameOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'mutation-applied', 'save-requested',
        'save-required'].includes(operation.status) ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before = await readPlannedSceneNodeRename(operation.plan);
    if (!renameStateMatches(before, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
    await verifySceneNodeDiskBefore(operation.plan);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try {
        before = await readPlannedSceneNodeRename(operation.plan);
        if (!renameStateMatches(before, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    const mutation = await callScene('renameNode', { sceneUuid: operation.plan.sceneUuid,
        nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.expectedBefore.nodePath,
        expectedName: operation.plan.expectedBefore.name, expectedParentUuid: operation.plan.expectedBefore.parentUuid,
        newName: operation.plan.expectedAfter.name }, 20000);
    if (!mutation || mutation.available !== true || !renameStateMatches(mutation, operation.plan.expectedAfter)) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw coded(mutation && mutation.reason || 'SCENE_NODE_NAME_WRITE_READBACK_FAILED');
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
    const readback = await readPlannedSceneNodeRename(operation.plan);
    if (!renameStateMatches(readback, operation.plan.expectedAfter)) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    return sceneNodeRenameReceipt(operation, readback);
}

async function reconcileSceneNodeRename(input) {
    const operation = readSceneNodeRenameOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneNodeRename(operation.plan); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_NODE_NAME_STATE_UNAVAILABLE';
        writeOperation(operation);
        return { ...sceneNodeRenameReceipt(operation, null), status: operation.status,
            observed: null, reason: operation.reconcileReason };
    }
    let diskState = null;
    if (operation.plan.diskBefore) {
        try { diskState = await reconcileSceneNodeDiskOperation(operation,
            renameStateMatches(observed, operation.plan.expectedBefore),
            renameStateMatches(observed, operation.plan.expectedAfter)); }
        catch (error) {
            operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
            operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
            return { ...sceneNodeRenameReceipt(operation, observed), observed: { nodeName: observed.nodeName,
                nodePath: observed.nodePath, parentUuid: observed.parentUuid, sceneUuid: observed.sceneUuid,
                nodeUuid: observed.nodeUuid, disk: null }, reason: operation.reconcileReason };
        }
    } else if (renameStateMatches(observed, operation.plan.expectedBefore)) {
        if (['planned', 'awaiting-approval', 'applying', 'abandoned', 'needs-reconciliation'].includes(operation.status)) operation.status = 'not-applied';
        else if (['mutation-applied', 'save-requested', 'completed', 'save-required'].includes(operation.status)) operation.status = 'conflict';
    } else if (renameStateMatches(observed, operation.plan.expectedAfter)) {
        if (['save-requested', 'completed'].includes(operation.status)) operation.status = 'completed';
        else if (['applying', 'mutation-applied', 'save-required', 'needs-reconciliation'].includes(operation.status)) operation.status = 'save-required';
        else operation.status = 'conflict';
    } else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return { ...sceneNodeRenameReceipt(operation, observed), observed: { nodeName: observed.nodeName,
        nodePath: observed.nodePath, parentUuid: observed.parentUuid, sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid,
        ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
            nodeName: diskState.disk.nodeName, nodePath: diskState.disk.nodePath, parentUuid: diskState.disk.parentUuid,
            matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never repeat this rename. If the original name remains, create a new plan; if save-required, save the scene in Creator and inspect the result.' };
}


function sceneNodeReparentReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        before: plan.expectedBefore, after: state && state.available ? {
            nodeName: state.nodeName, nodePath: state.nodePath, parentUuid: state.parentUuid, parentPath: state.parentPath,
        } : null,
        localTransformPreserved: true, worldTransformPreserved: false,
        sceneSaveRequestSent: !!operation.sceneSaveRequestSent, sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: !!(operation.diskReadback && operation.diskReadback.verified === true),
        diskReadback: operation.diskReadback || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.node.reparent.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'Creator 2.4 has no documented scene-save IPC acknowledgement. scenePersistenceConfirmed requires serialized parent UUID and path to match the exact saved .fire readback.' } };
}

async function commitSceneNodeReparent(input, context) {
    const operation = readSceneNodeReparentOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'mutation-applied', 'save-requested',
        'save-required'].includes(operation.status) ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before = await readPlannedSceneNodeReparent(operation.plan);
    if (!reparentStateMatches(before, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
    await verifySceneNodeDiskBefore(operation.plan);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try {
        before = await readPlannedSceneNodeReparent(operation.plan);
        if (!reparentStateMatches(before, operation.plan.expectedBefore)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    const mutation = await callScene('reparentNode', { sceneUuid: operation.plan.sceneUuid,
        nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.expectedBefore.nodePath,
        expectedName: operation.plan.expectedBefore.nodeName,
        expectedParentUuid: operation.plan.expectedBefore.parentUuid,
        expectedParentPath: operation.plan.expectedBefore.parentPath,
        targetParentUuid: operation.plan.expectedBefore.targetParentUuid,
        targetParentPath: operation.plan.expectedBefore.targetParentPath,
        afterNodePath: operation.plan.expectedBefore.afterNodePath }, 20000);
    if (!mutation || mutation.available !== true || !reparentStateMatches(mutation, operation.plan.expectedAfter)) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw coded(mutation && mutation.reason || 'SCENE_NODE_REPARENT_READBACK_FAILED');
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
    const readback = await readPlannedSceneNodeReparent(operation.plan);
    if (!reparentStateMatches(readback, operation.plan.expectedAfter)) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    return sceneNodeReparentReceipt(operation, readback);
}

async function reconcileSceneNodeReparent(input) {
    const operation = readSceneNodeReparentOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneNodeReparent(operation.plan); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_NODE_REPARENT_STATE_UNAVAILABLE';
        writeOperation(operation);
        return { ...sceneNodeReparentReceipt(operation, null), status: operation.status,
            observed: null, reason: operation.reconcileReason };
    }
    let diskState = null;
    if (operation.plan.diskBefore) {
        try { diskState = await reconcileSceneNodeDiskOperation(operation,
            reparentStateMatches(observed, operation.plan.expectedBefore),
            reparentStateMatches(observed, operation.plan.expectedAfter)); }
        catch (error) {
            operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
            operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
            return { ...sceneNodeReparentReceipt(operation, observed), observed: {
                nodeName: observed.nodeName, nodePath: observed.nodePath, parentUuid: observed.parentUuid,
                parentPath: observed.parentPath, targetParentUuid: observed.targetParentUuid,
                targetParentPath: observed.targetParentPath, sceneUuid: observed.sceneUuid,
                nodeUuid: observed.nodeUuid, disk: null }, reason: operation.reconcileReason };
        }
    } else if (reparentStateMatches(observed, operation.plan.expectedBefore)) {
        if (['planned', 'awaiting-approval', 'applying', 'abandoned', 'needs-reconciliation'].includes(operation.status)) operation.status = 'not-applied';
        else if (['mutation-applied', 'save-requested', 'completed', 'save-required'].includes(operation.status)) operation.status = 'conflict';
    } else if (reparentStateMatches(observed, operation.plan.expectedAfter)) {
        if (['save-requested', 'completed'].includes(operation.status)) operation.status = 'completed';
        else if (['applying', 'mutation-applied', 'save-required', 'needs-reconciliation'].includes(operation.status)) operation.status = 'save-required';
        else operation.status = 'conflict';
    } else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return { ...sceneNodeReparentReceipt(operation, observed), observed: {
        nodeName: observed.nodeName, nodePath: observed.nodePath, parentUuid: observed.parentUuid,
        parentPath: observed.parentPath, targetParentUuid: observed.targetParentUuid,
        targetParentPath: observed.targetParentPath, sceneUuid: observed.sceneUuid, nodeUuid: observed.nodeUuid,
        ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
            nodeName: diskState.disk.nodeName, nodePath: diskState.disk.nodePath, parentUuid: diskState.disk.parentUuid,
            matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}),
    }, retry: 'Never repeat this reparent. If the original parent remains, create a new plan; if save-required, save the scene in Creator and inspect the result.' };
}

async function readPlannedSceneNodeDelete(plan) {
    const state = await callScene('nodeDeleteState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid }, 20000);
    if (state && state.available === false && state.reason === 'SCENE_NODE_NOT_FOUND') return { present: false };
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_NODE_DELETE_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid)
        throw coded('OPERATION_TARGET_MISMATCH');
    return { present: true, nodeName: state.nodeName, nodePath: state.nodePath,
        parentUuid: state.parentUuid, childCount: state.childCount, subtree: state.subtree };
}

async function readPlannedSceneComponentRemove(plan) {
    const state = await callScene('componentRemoveState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.nodePath, componentClassName: plan.componentClassName,
        componentInstanceId: plan.componentInstanceId }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_COMPONENT_REMOVE_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid || state.nodePath !== plan.nodePath
        || state.componentClassName !== plan.componentClassName || state.componentInstanceId !== plan.componentInstanceId
        || state.serializedClassId !== plan.serializedClassId
        || typeof state.present !== 'boolean' || !Array.isArray(state.dependentComponents))
        throw coded('OPERATION_TARGET_MISMATCH');
    return state;
}

function sceneDestructiveStateMatchesBefore(operation, observed) {
    if (!observed || observed.present !== true) return false;
    if (operation.operation === 'creator.scene.node.delete') {
        const before = operation.plan.expectedBefore;
        return observed.nodeName === before.nodeName && observed.nodePath === before.nodePath
            && observed.parentUuid === before.parentUuid && observed.childCount === before.childCount
            && JSON.stringify(observed.subtree) === JSON.stringify(before.subtree);
    }
    return observed.dependentComponents.length === 0;
}

function sceneDestructiveReceipt(operation, observed) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.expectedBefore.nodePath || plan.nodePath,
        action: operation.operation === 'creator.scene.node.delete' ? 'delete-node-subtree' : 'remove-component',
        componentClassName: plan.componentClassName || null, componentInstanceId: plan.componentInstanceId || null,
        before: plan.expectedBefore, after: observed && observed.present === false ? { present: false } : null,
        sceneSaveRequestSent: !!operation.sceneSaveRequestSent, sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: operation.status === 'completed' && !!(operation.diskReadback && operation.diskReadback.verified),
        diskReadback: operation.diskReadback || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false,
            reconcileCommand: operation.operation === 'creator.scene.node.delete'
                ? 'creator.scene.node.delete.reconcile' : 'creator.scene.node.remove-component.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'Creator 2.4 destroys objects asynchronously and has no documented scene-save completion acknowledgement. Persistence requires the exact saved component set or absence of every deleted subtree UUID.' } };
}


async function commitSceneDestructiveOperation(operation, input, context) {
    verifySceneOperationIdentity(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'mutation-applied', 'save-requested',
        'needs-reconciliation', 'save-required'].includes(operation.status) ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    if (!operation.plan.diskBefore) throw coded('SCENE_DISK_BASELINE_MISSING');
    const isNode = operation.operation === 'creator.scene.node.delete';
    const read = () => isNode ? readPlannedSceneNodeDelete(operation.plan) : readPlannedSceneComponentRemove(operation.plan);
    let before = await read();
    if (!sceneDestructiveStateMatchesBefore(operation, before)) throw coded('OPERATION_PRECONDITION_FAILED');
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) {
        operation.status = 'cancelled'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation);
        throw coded('OPERATION_NOT_APPROVED');
    }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) {
        operation.status = 'abandoned'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation);
        throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error));
    }
    verifySceneOperationIdentity(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try {
        before = await read();
        if (!sceneDestructiveStateMatchesBefore(operation, before)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict'; operation.conflictAt = new Date().toISOString(); writeOperation(operation); throw error;
    }
    operation.status = 'applying'; operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call'; operation.appliedByInstanceId = INSTANCE_ID; writeOperation(operation);
    let mutation;
    try {
        mutation = isNode
            ? await callScene('deleteNode', { sceneUuid: operation.plan.sceneUuid, nodeUuid: operation.plan.nodeUuid,
                nodePath: operation.plan.expectedBefore.nodePath, expectedName: operation.plan.expectedBefore.nodeName,
                expectedParentUuid: operation.plan.expectedBefore.parentUuid,
                expectedChildCount: operation.plan.expectedBefore.childCount,
                expectedSubtree: operation.plan.expectedBefore.subtree }, 20000)
            : await callScene('removeNodeComponent', { sceneUuid: operation.plan.sceneUuid, nodeUuid: operation.plan.nodeUuid,
                nodePath: operation.plan.nodePath, componentClassName: operation.plan.componentClassName,
                componentInstanceId: operation.plan.componentInstanceId, expectedPresent: true }, 20000);
    } catch (error) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = error.code || 'SCENE_DESTRUCTIVE_WRITE_UNCERTAIN';
        writeOperation(operation); throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!mutation || mutation.available !== true || (isNode ? mutation.deleted !== true : mutation.present !== false)) {
        operation.status = 'needs-reconciliation'; operation.reconcileReason = mutation && mutation.reason || 'SCENE_DESTRUCTIVE_READBACK_FAILED';
        writeOperation(operation); throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!isNode) {
        try {
            operation.nodeTransformAfter = await readSceneNodeTransformAfterComponentRemoval(operation.plan);
            writeOperation(operation);
        } catch (error) {
            operation.status = 'needs-reconciliation';
            operation.reconcileReason = error.code || 'SCENE_COMPONENT_REMOVE_TRANSFORM_READBACK_FAILED';
            writeOperation(operation);
            throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
        }
    }
    operation.status = 'mutation-applied'; operation.mutationAppliedAt = new Date().toISOString(); writeOperation(operation);
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error)); }
    operation.status = 'save-requested'; operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString(); writeOperation(operation);
    const observed = await read();
    if (observed.present !== false) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    if (isNode) await confirmSceneNodeDeletionDiskPersistence(operation);
    else await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed'; operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID; writeOperation(operation);
    return sceneDestructiveReceipt(operation, observed);
}

async function reconcileSceneDestructiveOperation(operation) {
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    const isNode = operation.operation === 'creator.scene.node.delete';
    let observed;
    try { observed = isNode ? await readPlannedSceneNodeDelete(operation.plan)
        : await readPlannedSceneComponentRemove(operation.plan); }
    catch (error) {
        operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_DESTRUCTIVE_STATE_UNAVAILABLE'; writeOperation(operation);
        return { ...sceneDestructiveReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    let diskState = null;
    try {
        if (!operation.plan.diskBefore) throw coded('SCENE_DISK_BASELINE_MISSING');
        const liveBefore = sceneDestructiveStateMatchesBefore(operation, observed);
        const liveAfter = observed.present === false;
        if (!isNode && liveAfter && !operation.nodeTransformAfter)
            operation.nodeTransformAfter = await readSceneNodeTransformAfterComponentRemoval(operation.plan);
        diskState = isNode
            ? await reconcileSceneNodeDeletionDiskOperation(operation, liveBefore, liveAfter)
            : await reconcileSceneNodeDiskOperation(operation, liveBefore, liveAfter);
    } catch (error) {
        operation.status = 'conflict'; operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED';
    }
    operation.reconciledAt = new Date().toISOString(); writeOperation(operation);
    return { ...sceneDestructiveReceipt(operation, observed), observed: { ...observed,
        ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
            nodeAbsent: diskState.disk.nodeAbsent === true,
            ...(Array.isArray(diskState.disk.absentNodeUuids) ? { absentNodeUuids: diskState.disk.absentNodeUuids } : {}),
            ...(Array.isArray(diskState.disk.components) ? { components: diskState.disk.components } : {}),
            matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never replay this operation. If the original object remains, create a fresh plan after inspection; if save-required, save in Creator and inspect the scene.' };
}

async function readSceneNodeTransformAfterComponentRemoval(plan) {
    // Creator defers component destruction and its onDestroy/layout effects.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const state = await callScene('nodeTransformState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid }, 20000);
    if (!state || state.available !== true || state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid
        || !sceneNodePathsMatch(state.nodePath, plan.nodePath) || !state.transform)
        throw coded(state && state.reason || 'SCENE_NODE_TRANSFORM_STATE_UNAVAILABLE');
    const fields = ['anchorX', 'anchorY', 'angle', 'height', 'scaleX', 'scaleY', 'width', 'x', 'y', 'z'];
    if (fields.some((field) => !Number.isFinite(state.transform[field])))
        throw coded('SCENE_NODE_TRANSFORM_STATE_INVALID');
    return Object.fromEntries(fields.map((field) => [field, state.transform[field]]));
}

async function readPlannedSceneComponent(plan) {
    const state = await callScene('componentState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.nodePath, componentClassName: plan.componentClassName }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_COMPONENT_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid || state.nodePath !== plan.nodePath
        || state.componentClassName !== plan.componentClassName) throw coded('OPERATION_TARGET_MISMATCH');
    return state;
}


function sceneComponentAddReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, sceneName: plan.sceneName, sceneUuid: plan.sceneUuid,
        nodePath: plan.nodePath, nodeUuid: plan.nodeUuid, componentClassName: plan.componentClassName,
        beforeComponentCount: plan.expectedBefore.componentCount,
        componentCount: Number.isInteger(state.componentCount) ? state.componentCount : null,
        componentInstanceId: operation.componentInstanceId || null,
        nodeTransformPreserved: operation.nodeTransformPreserved === true,
        nodeTransformRestoredAfterLifecycle: operation.nodeTransformRestoredAfterLifecycle === true,
        nodeTransformBefore: plan.diskBefore && plan.diskBefore.transform || null,
        nodeTransformAfter: operation.nodeTransformAfter || operation.nodeTransformReadback || null,
        sceneSaveRequestSent: !!operation.sceneSaveRequestSent, sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: operation.status === 'completed' && !!(operation.diskReadback && operation.diskReadback.verified),
        diskReadback: operation.diskReadback || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.node.add-component.reconcile',
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: 'Creator 2.4 does not document a scene save completion acknowledgement. Persistence requires the exact added component ID and serialized class on disk; this operation will not be replayed.' } };
}

async function preserveComponentAddNodeTransform(plan) {
    const expected = plan && plan.diskBefore && plan.diskBefore.transform;
    if (!expected || !sceneDiskTransformMatches(expected, expected)) throw coded('SCENE_NODE_TRANSFORM_BASELINE_UNAVAILABLE');
    // RichText debounces its edit-mode layout by 200 ms; let that known lifecycle update settle before restoring geometry.
    if (plan.componentClassName === 'cc.RichText') await new Promise((resolve) => setTimeout(resolve, 350));
    const state = await callScene('nodeTransformState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid }, 20000);
    if (!state || state.available !== true || state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid
        || !sceneNodePathsMatch(state.nodePath, plan.nodePath) || !state.transform)
        throw coded(state && state.reason || 'SCENE_NODE_TRANSFORM_STATE_UNAVAILABLE');
    if (sceneDiskTransformMatches(state.transform, expected))
        return { restored: false, preserved: true, transform: state.transform };
    if (plan.preserveNodeTransform === false)
        return { restored: false, preserved: false, transform: state.transform };
    const restored = await callScene('setNodeTransform', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.nodePath, expectedBefore: state.transform, values: expected }, 20000);
    if (!restored || restored.available !== true || !sceneDiskTransformMatches(restored.transform, expected))
        throw coded(restored && restored.reason || 'SCENE_COMPONENT_ADD_TRANSFORM_RESTORE_FAILED');
    return { restored: true, preserved: true, transform: restored.transform };
}

async function commitSceneComponentAdd(input, context) {
    const operation = readSceneComponentOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'mutation-applied' || operation.status === 'save-requested'
        || operation.status === 'needs-reconciliation' ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    if (!operation.plan.diskBefore) throw coded('SCENE_DISK_BASELINE_MISSING');
    let before = await readPlannedSceneComponent(operation.plan);
    if (before.componentCount !== operation.plan.expectedBefore.componentCount || !before.canAdd)
        throw coded('OPERATION_PRECONDITION_FAILED');
    await verifySceneNodeDiskBefore(operation.plan);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
        before = await readPlannedSceneComponent(operation.plan);
        if (before.componentCount !== operation.plan.expectedBefore.componentCount || !before.canAdd)
            throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
    } catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    let mutation;
    try {
        mutation = await callScene('addNodeComponent', { sceneUuid: operation.plan.sceneUuid,
            nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
            componentClassName: operation.plan.componentClassName,
            expectedComponentCount: operation.plan.expectedBefore.componentCount }, 20000);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'SCENE_COMPONENT_WRITE_UNCERTAIN';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!mutation || mutation.available !== true
        || mutation.componentCount !== operation.plan.expectedAfter.componentCount) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = mutation && mutation.reason || 'SCENE_COMPONENT_WRITE_READBACK_FAILED';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    operation.componentInstanceId = typeof mutation.componentInstanceId === 'string' && mutation.componentInstanceId
        ? mutation.componentInstanceId : null;
    if (!operation.componentInstanceId || mutation.serializedClassId !== operation.plan.serializedClassId) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = 'SCENE_COMPONENT_SERIALIZED_IDENTITY_UNAVAILABLE';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    operation.status = 'mutation-applied';
    operation.mutationAppliedAt = new Date().toISOString();
    writeOperation(operation);
    try {
        const transform = await preserveComponentAddNodeTransform(operation.plan);
        operation.nodeTransformPreserved = transform.preserved;
        operation.nodeTransformRestoredAfterLifecycle = transform.restored;
        operation.nodeTransformReadback = transform.transform;
        operation.nodeTransformAfter = transform.transform;
        writeOperation(operation);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'SCENE_COMPONENT_ADD_TRANSFORM_RESTORE_FAILED';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error)); }
    operation.status = 'save-requested';
    operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const readback = await readPlannedSceneComponent(operation.plan);
    if (readback.componentCount !== operation.plan.expectedAfter.componentCount
        || !readback.componentInstanceIds.includes(operation.componentInstanceId))
        throw coded('OPERATION_READBACK_STATE_MISMATCH');
    await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    return sceneComponentAddReceipt(operation, readback);
}

async function reconcileSceneComponentAdd(input) {
    const operation = readSceneComponentOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneComponent(operation.plan); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_COMPONENT_STATE_UNAVAILABLE';
        writeOperation(operation);
        return { ...sceneComponentAddReceipt(operation, { componentCount: null }),
            observed: null, reason: operation.reconcileReason };
    }
    const liveBefore = observed.componentCount === operation.plan.expectedBefore.componentCount;
    const identityMatches = !!operation.componentInstanceId && observed.componentInstanceIds.includes(operation.componentInstanceId);
    const liveAfter = observed.componentCount === operation.plan.expectedAfter.componentCount && identityMatches;
    let diskState = null;
    try {
        if (!operation.plan.diskBefore) throw coded('SCENE_DISK_BASELINE_MISSING');
        diskState = await reconcileSceneNodeDiskOperation(operation, liveBefore, liveAfter);
    } catch (error) {
        operation.status = 'conflict';
        operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED';
    }
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return { ...sceneComponentAddReceipt(operation, observed),
        observed: { componentClassName: observed.componentClassName, componentCount: observed.componentCount,
            componentInstanceIds: observed.componentInstanceIds,
            ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
                components: diskState.disk.components, matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never retry this operation. If no component exists, create a new plan. If component identity is unavailable, inspect the node and save manually in Creator.' };
}

async function readPlannedSceneComponentProperty(plan) {
    const state = await callScene('componentPropertyState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid,
        nodePath: plan.nodePath, componentClassName: plan.componentClassName,
        componentInstanceId: plan.componentInstanceId, property: plan.property }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_COMPONENT_PROPERTY_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid || state.nodePath !== plan.nodePath
        || state.componentClassName !== plan.componentClassName || state.componentInstanceId !== plan.componentInstanceId
        || state.property !== plan.property || state.propertyKind !== plan.propertyKind
        || (plan.diskBefore && plan.diskBefore.componentProperty.serializedProperty
            && (!Array.isArray(state.serializedPropertyCandidates)
                || !state.serializedPropertyCandidates.includes(plan.diskBefore.componentProperty.serializedProperty)))
        || (plan.diskBefore && state.serializedClassId !== plan.diskBefore.componentProperty.serializedClassId))
        throw coded('OPERATION_TARGET_MISMATCH');
    return state;
}


function sceneComponentPropertyReceipt(operation, state) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, nodePath: plan.nodePath, nodeUuid: plan.nodeUuid,
        componentClassName: plan.componentClassName, componentInstanceId: plan.componentInstanceId,
        property: plan.property, propertyKind: plan.propertyKind, beforeValue: plan.expectedBefore.value,
        value: Object.prototype.hasOwnProperty.call(state, 'value') ? state.value : null,
        nodeTransformBefore: plan.nodeTransformBefore || null,
        nodeTransformAfter: operation.nodeTransformAfter || null,
        sceneSaveRequestSent: !!operation.sceneSaveRequestSent, sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: operation.status === 'completed' && !!(operation.diskReadback && operation.diskReadback.verified),
        diskReadback: operation.diskReadback || null,
        compensationFor: operation.plan.compensationFor || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: plan.compensationFor
                ? 'creator.scene.node.set-component-property.compensate.reconcile'
                : 'creator.scene.node.set-component-property.reconcile',
            sameCreatorSessionRequired: !plan.compensationFor,
            manualSaveMayBeRequired: operation.status === 'save-required',
            note: plan.compensationFor
                ? 'A source-linked compensation can be reconciled after Creator restart only when the exact component identity is still live and its serialized scene state matches the bound disk baseline.'
                : 'Creator 2.4 has no documented scene-save IPC acknowledgement. scenePersistenceConfirmed requires the exact serialized component identity and property on disk. If memory changed but disk did not, save manually and reconcile. A changed Creator session still requires manual review.' } };
}

async function commitSceneComponentProperty(input, context) {
    const operation = readSceneComponentPropertyOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (operation.plan.compensationFor) verifySceneComponentPropertyCompensationSource(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'mutation-applied' || operation.status === 'save-requested'
        || operation.status === 'needs-reconciliation' ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    let before = await readPlannedSceneComponentProperty(operation.plan);
    if (!sceneComponentValuesEqual(before.value, operation.plan.expectedBefore.value)) throw coded('OPERATION_PRECONDITION_FAILED');
    await verifySceneNodeDiskBefore(operation.plan);
    await readSceneComponentPropertyTransform({ sceneUuid: operation.plan.sceneUuid, nodeUuid: operation.plan.nodeUuid,
        nodePath: operation.plan.nodePath, diskTransform: operation.plan.nodeTransformBefore });
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    if (operation.plan.compensationFor) verifySceneComponentPropertyCompensationSource(operation);
    if (operation.plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    try {
        before = await readPlannedSceneComponentProperty(operation.plan);
        if (!sceneComponentValuesEqual(before.value, operation.plan.expectedBefore.value)) throw coded('OPERATION_PRECONDITION_FAILED');
        await verifySceneNodeDiskBefore(operation.plan);
        await readSceneComponentPropertyTransform({ sceneUuid: operation.plan.sceneUuid, nodeUuid: operation.plan.nodeUuid,
            nodePath: operation.plan.nodePath, diskTransform: operation.plan.nodeTransformBefore });
    } catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    let mutation;
    try {
        mutation = await callScene('setComponentProperty', { sceneUuid: operation.plan.sceneUuid,
            nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
            componentClassName: operation.plan.componentClassName,
            componentInstanceId: operation.plan.componentInstanceId, property: operation.plan.property,
            expectedValue: operation.plan.expectedBefore.value, value: operation.plan.expectedAfter.value,
            ...(operation.plan.restoreSerializedOmission ? { restoreDefaultOmitted: true } : {}) }, 20000);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'SCENE_COMPONENT_PROPERTY_WRITE_UNCERTAIN';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!mutation || mutation.available !== true || !sceneComponentValuesEqual(mutation.value, operation.plan.expectedAfter.value)) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = mutation && mutation.reason || 'SCENE_COMPONENT_PROPERTY_READBACK_FAILED';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    try {
        operation.nodeTransformAfter = await readSceneComponentPropertyTransform(operation.plan, { afterMutation: true });
        if (operation.plan.restoreNodeTransform) {
            const restored = await callScene('setNodeTransform', { sceneUuid: operation.plan.sceneUuid,
                nodeUuid: operation.plan.nodeUuid, nodePath: operation.plan.nodePath,
                expectedBefore: operation.nodeTransformAfter, values: operation.plan.restoreNodeTransform }, 20000);
            if (!restored || restored.available !== true
                || !sceneDiskTransformMatches(restored.transform, operation.plan.restoreNodeTransform))
                throw coded(restored && restored.reason || 'SCENE_COMPONENT_COMPENSATION_TRANSFORM_RESTORE_FAILED');
            operation.nodeTransformAfter = restored.transform;
        }
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'SCENE_COMPONENT_PROPERTY_TRANSFORM_READBACK_FAILED';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
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
    const readback = await readPlannedSceneComponentProperty(operation.plan);
    if (!sceneComponentValuesEqual(readback.value, operation.plan.expectedAfter.value)) throw coded('OPERATION_READBACK_STATE_MISMATCH');
    await confirmSceneNodeDiskPersistence(operation);
    operation.status = 'completed';
    operation.completedAt = new Date().toISOString();
    operation.completedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    linkCompletedSceneComponentPropertyCompensation(operation);
    return sceneComponentPropertyReceipt(operation, readback);
}

async function reconcileSceneComponentProperty(input) {
    const operation = readSceneComponentPropertyOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    let observed;
    try { observed = await readPlannedSceneComponentProperty(operation.plan); }
    catch (error) {
        operation.status = 'conflict';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_COMPONENT_PROPERTY_STATE_UNAVAILABLE';
        writeOperation(operation);
        return { ...sceneComponentPropertyReceipt(operation, {}), observed: null, reason: operation.reconcileReason };
    }
    let diskState = null;
    // A source-linked compensation is intentionally planned after reopening the
    // project, so its persisted disk baseline remains authoritative across the
    // Creator instance boundary. Ordinary operations still require the original
    // instance before we classify their disk state.
    if (operation.plan.diskBefore
        && (operation.plan.creatorInstanceId === INSTANCE_ID || operation.plan.compensationFor)) {
        try { diskState = await reconcileSceneNodeDiskOperation(operation,
            sceneComponentValuesEqual(observed.value, operation.plan.expectedBefore.value),
            sceneComponentValuesEqual(observed.value, operation.plan.expectedAfter.value)); }
        catch (error) {
            operation.status = 'conflict'; operation.reconciledAt = new Date().toISOString();
            operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_FAILED'; writeOperation(operation);
            return { ...sceneComponentPropertyReceipt(operation, observed), observed: null, reason: operation.reconcileReason };
        }
    } else if (sceneComponentValuesEqual(observed.value, operation.plan.expectedBefore.value)) {
        if (['planned', 'awaiting-approval', 'applying', 'needs-reconciliation'].includes(operation.status)) operation.status = 'not-applied';
        else if (['mutation-applied', 'save-requested', 'completed'].includes(operation.status)) operation.status = 'conflict';
    } else if (sceneComponentValuesEqual(observed.value, operation.plan.expectedAfter.value)) {
        if (operation.plan.creatorInstanceId !== INSTANCE_ID) operation.status = 'needs-reconciliation';
        else if (['save-requested', 'completed'].includes(operation.status)) operation.status = 'completed';
        else if (operation.status === 'mutation-applied') operation.status = 'save-required';
        else operation.status = 'needs-reconciliation';
    } else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    if (operation.status === 'completed' && operation.plan.compensationFor)
        linkCompletedSceneComponentPropertyCompensation(operation);
    return { ...sceneComponentPropertyReceipt(operation, observed),
        observed: { componentClassName: observed.componentClassName, componentInstanceId: observed.componentInstanceId,
            property: observed.property, value: observed.value,
            ...(diskState ? { disk: { sourceSha256: diskState.disk.sourceSha256, metaSha256: diskState.disk.metaSha256,
                componentProperty: diskState.disk.componentProperty, matchesBefore: diskState.before, matchesAfter: diskState.after } } : {}) },
        retry: 'Never replay this operation. If the component instance changed after Creator restart, inspect the property manually and create a new plan.' };
}

async function sceneAssetIdentity(sceneUuid) {
    if (typeof sceneUuid !== 'string' || !/^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[A-Za-z0-9+/]{22,23})$/.test(sceneUuid))
        throw coded('SCENE_ASSETDB_IDENTITY_UNAVAILABLE');
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function') throw coded('ASSETDB_QUERY_UNAVAILABLE');
    const root = projectRoot();
    const rows = await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_QUERY_TIMEOUT'));
        }, 20000);
        try {
            Editor.assetdb.queryAssets('db://assets/**/*', null, (error, result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error))); return; }
                if (!Array.isArray(result)) { reject(coded('ASSETDB_RESULT_INVALID')); return; }
                resolve(result);
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error)));
        }
    });
    const candidates = rows.filter((row) => row && typeof row.url === 'string'
        && row.url.startsWith('db://assets/') && /\.fire$/i.test(row.url)
        && (!row.importer || row.importer === 'scene'))
        .sort((left, right) => left.url.localeCompare(right.url));
    if (candidates.length > MAX_SCENE_ASSET_CANDIDATES) throw coded('SCENE_ASSET_SCAN_LIMIT');

    let scannedBytes = 0;
    const matches = [];
    for (const row of candidates) {
        const relative = row.url.slice('db://assets/'.length);
        const sceneFile = safeProjectFile(relative, /\.fire$/i);
        const metaFile = safeProjectFile(`${relative}.meta`);
        const sceneStat = fs.lstatSync(sceneFile);
        const metaStat = fs.lstatSync(metaFile);
        if (!sceneStat.isFile() || sceneStat.isSymbolicLink() || !metaStat.isFile() || metaStat.isSymbolicLink())
            throw coded('SCENE_ASSET_SCAN_UNSAFE');
        const candidateBytes = sceneStat.size + metaStat.size;
        if (sceneStat.size < 2 || sceneStat.size > MAX_SCENE_SERIALIZATION_BYTES
            || metaStat.size < 2 || metaStat.size > MAX_SCENE_META_BYTES
            || scannedBytes + candidateBytes > MAX_SCENE_ASSET_SCAN_BYTES)
            throw coded('SCENE_ASSET_SCAN_LIMIT');
        scannedBytes += candidateBytes;
        const sceneBytes = readStableProjectFile(sceneFile, MAX_SCENE_SERIALIZATION_BYTES, 'SCENE_SERIALIZATION_FILE_UNSAFE');
        const metaBytes = readStableProjectFile(metaFile, MAX_SCENE_META_BYTES, 'SCENE_META_FILE_UNSAFE');
        const inspected = inspectSceneAssetIdentity({ sceneBytes, metaBytes, sceneAssetRow: row });
        if (!sceneAssetIdentityMatches(sceneUuid, inspected)) continue;
        matches.push({ uuid: row.uuid, sceneUuid, sceneRootUuid: inspected.sceneRootUuid,
            url: row.url, importer: 'scene',
            sceneSha256: fileHash(sceneBytes), metaSha256: fileHash(metaBytes) });
    }
    if (projectRoot() !== root) throw coded('CREATOR_IDENTITY_CHANGED');
    if (matches.length === 0) throw coded('SCENE_ASSETDB_IDENTITY_UNAVAILABLE');
    if (matches.length !== 1) throw coded('SCENE_ASSETDB_IDENTITY_AMBIGUOUS');

    const identity = matches[0];
    const currentRow = await queryAssetByUrl(identity.url);
    if (!currentRow || currentRow.uuid !== identity.uuid || currentRow.url !== identity.url
        || (currentRow.importer || 'scene') !== identity.importer) throw coded('SCENE_ASSETDB_IDENTITY_CHANGED');
    const relative = identity.url.slice('db://assets/'.length);
    const sceneFile = safeProjectFile(relative, /\.fire$/i);
    const metaFile = safeProjectFile(`${relative}.meta`);
    const currentSceneBytes = readStableProjectFile(sceneFile, MAX_SCENE_SERIALIZATION_BYTES, 'SCENE_SERIALIZATION_FILE_UNSAFE');
    const currentMetaBytes = readStableProjectFile(metaFile, MAX_SCENE_META_BYTES, 'SCENE_META_FILE_UNSAFE');
    const currentInspection = inspectSceneAssetIdentity({ sceneBytes: currentSceneBytes,
        metaBytes: currentMetaBytes, sceneAssetRow: currentRow });
    if (!sceneAssetIdentityMatches(sceneUuid, currentInspection) || currentInspection.sceneUuid !== identity.uuid
        || currentInspection.sceneRootUuid !== identity.sceneRootUuid
        || fileHash(currentSceneBytes) !== identity.sceneSha256 || fileHash(currentMetaBytes) !== identity.metaSha256)
        throw coded('SCENE_ASSETDB_IDENTITY_CHANGED');
    return identity;
}

async function sceneNodeDiskState(sceneUuid, nodeUuid, options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw coded('SCENE_DISK_SELECTOR_INVALID');
    const identity = await sceneAssetIdentity(sceneUuid);
    const row = await queryAssetByUrl(identity.url);
    if (!row || row.uuid !== identity.uuid || row.url !== identity.url
        || (row.importer || 'scene') !== identity.importer) throw coded('SCENE_ASSETDB_IDENTITY_MISMATCH');
    const relative = identity.url.slice('db://assets/'.length);
    const sceneFile = safeProjectFile(relative, /\.fire$/i);
    const metaFile = safeProjectFile(`${relative}.meta`);
    const sceneBytes = readStableProjectFile(sceneFile, MAX_SCENE_SERIALIZATION_BYTES, 'SCENE_SERIALIZATION_FILE_UNSAFE');
    const metaBytes = readStableProjectFile(metaFile, MAX_SCENE_META_BYTES, 'SCENE_META_FILE_UNSAFE');
    if (fileHash(sceneBytes) !== identity.sceneSha256 || fileHash(metaBytes) !== identity.metaSha256)
        throw coded('SCENE_CHANGED_DURING_INSPECT');
    const state = inspectSavedSceneNode({ sceneBytes, metaBytes, sceneUuid, sceneAssetRow: row, nodeUuid,
        componentProperty: options.componentProperty, includeComponents: options.includeComponents === true,
        componentEvents: options.componentEvents, includeSubtree: options.includeSubtree === true,
        absentNodeUuids: options.absentNodeUuids });
    if (!state.verified) throw coded(state.reason || 'SCENE_DISK_READBACK_FAILED');
    const freshRow = await queryAssetByUrl(identity.url);
    const freshSceneBytes = readStableProjectFile(sceneFile, MAX_SCENE_SERIALIZATION_BYTES, 'SCENE_SERIALIZATION_FILE_UNSAFE');
    const freshMetaBytes = readStableProjectFile(metaFile, MAX_SCENE_META_BYTES, 'SCENE_META_FILE_UNSAFE');
    if (!freshRow || freshRow.uuid !== identity.uuid || freshRow.url !== identity.url
        || fileHash(freshSceneBytes) !== fileHash(sceneBytes) || fileHash(freshMetaBytes) !== fileHash(metaBytes))
        throw coded('SCENE_CHANGED_DURING_INSPECT');
    return { ...state, sceneAssetUuid: identity.uuid, sourceSha256: fileHash(sceneBytes),
        metaSha256: fileHash(metaBytes), importer: identity.importer };
}

function sceneNodeDiskOptionsForPlan(plan) {
    const options = {};
    if (plan.diskBefore.componentProperty) {
        options.componentProperty = { ...plan.diskBefore.componentProperty,
            ...(plan.diskBefore.componentProperty.isDefaultOmitted && plan.serializedProperty
                ? { serializedPropertyCandidates: [plan.serializedProperty] } : {}),
            ...(plan.restoreSerializedOmission
                ? { defaultValue: plan.expectedAfter.serializedValue }
                : plan.diskBefore.componentProperty.isDefaultOmitted
                    ? { defaultValue: plan.diskBefore.componentProperty.value } : {}) };
    }
    if (plan.diskBefore.componentEvents) options.componentEvents = {
        componentInstanceId: plan.diskBefore.componentEvents.componentInstanceId,
        serializedClassId: plan.diskBefore.componentEvents.serializedClassId,
        eventProperty: plan.diskBefore.componentEvents.eventProperty,
    };
    if (Array.isArray(plan.diskBefore.components)) options.includeComponents = true;
    if (Array.isArray(plan.diskBefore.subtree)) options.includeSubtree = true;
    return options;
}

async function sceneNodeDiskStateForPlan(plan) {
    return sceneNodeDiskState(plan.sceneUuid, plan.nodeUuid, sceneNodeDiskOptionsForPlan(plan));
}

async function readSceneComponentPropertyTransform(plan, { afterMutation = false } = {}) {
    const widgetAlignmentSensitive = plan.componentClassName === 'cc.Widget'
        && ['enabled', 'target', 'isAlignTop', 'isAlignVerticalCenter', 'isAlignBottom', 'isAlignLeft',
            'isAlignHorizontalCenter', 'isAlignRight', 'top', 'bottom', 'left', 'right', 'horizontalCenter',
            'verticalCenter', 'alignMode'].includes(plan.property);
    const layoutSensitive = plan.componentClassName === 'cc.RichText'
        && ['string', 'fontSize', 'fontFamily', 'font', 'useSystemFont', 'maxWidth', 'lineHeight'].includes(plan.property)
        || plan.componentClassName === 'cc.Label'
        && ['string', 'fontSize', 'fontFamily', 'font', 'lineHeight', 'overflow', 'enableWrapText', 'spacingX'].includes(plan.property)
        || plan.componentClassName === 'cc.LabelOutline' && ['enabled', 'width'].includes(plan.property)
        || plan.componentClassName === 'cc.LabelShadow' && ['enabled', 'offset', 'blur'].includes(plan.property)
        || widgetAlignmentSensitive
        || plan.componentClassName === 'cc.Layout'
        && ['enabled', 'type', 'resizeMode', 'cellSize', 'startAxis', 'paddingLeft', 'paddingRight', 'paddingTop',
            'paddingBottom', 'spacingX', 'spacingY', 'verticalDirection', 'horizontalDirection', 'affectedByScale']
            .includes(plan.property);
    if (afterMutation && layoutSensitive) await new Promise((resolve) => setTimeout(resolve, 350));
    const state = await callScene('nodeTransformState', { sceneUuid: plan.sceneUuid, nodeUuid: plan.nodeUuid }, 20000);
    if (!state || state.available !== true) throw coded(state && state.reason || 'SCENE_NODE_TRANSFORM_STATE_UNAVAILABLE');
    if (state.sceneUuid !== plan.sceneUuid || state.nodeUuid !== plan.nodeUuid
        || !sceneNodePathsMatch(state.nodePath, plan.nodePath)
        || !state.transform || typeof state.transform !== 'object' || Array.isArray(state.transform))
        throw coded('SCENE_NODE_TRANSFORM_STATE_INVALID');
    if (!afterMutation && (!plan.diskTransform || !sceneDiskTransformMatches(state.transform, plan.diskTransform,
        { allowLayoutSizeMismatch: layoutSensitive, allowLayoutPositionMismatch: widgetAlignmentSensitive })))
        throw coded('SCENE_DISK_STATE_DIFFERS_FROM_EDITOR');
    const fields = ['anchorX', 'anchorY', 'angle', 'height', 'scaleX', 'scaleY', 'width', 'x', 'y', 'z'];
    if (fields.some((field) => !Number.isFinite(state.transform[field]))) throw coded('SCENE_NODE_TRANSFORM_STATE_INVALID');
    return Object.fromEntries(fields.map((field) => [field, state.transform[field]]));
}

function sceneNodeDiskBaseline(disk, { includeButtonEvents = false, includeComponentEvents = false } = {}) {
    const baseline = { sceneUrl: disk.sceneUrl, importer: disk.importer, sourceSha256: disk.sourceSha256,
        metaSha256: disk.metaSha256, active: disk.active, nodeName: disk.nodeName,
        parentUuid: disk.parentUuid, nodePath: disk.nodePath, transform: disk.transform };
    if (includeButtonEvents) baseline.buttonEvents = disk.buttonEvents;
    if (includeComponentEvents) baseline.componentEvents = disk.componentEvents;
    if (disk.componentProperty) baseline.componentProperty = disk.componentProperty;
    if (Array.isArray(disk.components)) baseline.components = disk.components;
    if (Array.isArray(disk.subtree)) baseline.subtree = disk.subtree;
    return baseline;
}

function sceneNodeDiskReadback(disk) {
    const readback = { verified: true, sceneUrl: disk.sceneUrl, sceneUuid: disk.sceneUuid,
        nodePath: disk.nodePath, nodeName: disk.nodeName, parentUuid: disk.parentUuid, nodeUuid: disk.nodeUuid,
        sourceSha256: disk.sourceSha256, metaSha256: disk.metaSha256, transform: disk.transform,
        active: disk.active, verifiedAt: new Date().toISOString() };
    if (Array.isArray(disk.buttonEvents)) readback.buttonEvents = disk.buttonEvents;
    if (disk.componentEvents) readback.componentEvents = disk.componentEvents;
    if (disk.componentProperty) readback.componentProperty = disk.componentProperty;
    if (Array.isArray(disk.components)) readback.components = disk.components;
    if (Array.isArray(disk.subtree)) readback.subtree = disk.subtree;
    return readback;
}

function validSavedComponentProperty(property) {
    const keys = property && typeof property === 'object' && !Array.isArray(property)
        ? Object.keys(property).sort().join(',') : '';
    return !!property && typeof property === 'object' && !Array.isArray(property)
        && ['componentInstanceId,property,serializedClassId,value',
            'componentInstanceId,property,serializedClassId,serializedProperty,value',
            'componentInstanceId,isDefaultOmitted,property,serializedClassId,value'].includes(keys)
        && typeof property.componentInstanceId === 'string' && property.componentInstanceId.length > 0
        && property.componentInstanceId.length <= 128 && typeof property.serializedClassId === 'string'
        && property.serializedClassId.length > 0 && property.serializedClassId.length <= 128
        && typeof property.property === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(property.property)
        && (property.serializedProperty === undefined || (typeof property.serializedProperty === 'string'
            && /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/.test(property.serializedProperty)))
        && (property.isDefaultOmitted === undefined || property.isDefaultOmitted === true)
        && validComponentDiskValue(property.value);
}

function validSceneNodeDiskBaseline(disk) {
    const fields = ['anchorX', 'anchorY', 'angle', 'height', 'scaleX', 'scaleY', 'width', 'x', 'y', 'z'];
    return !!disk && typeof disk === 'object' && !Array.isArray(disk)
        && typeof disk.sceneUrl === 'string' && disk.sceneUrl.startsWith('db://assets/')
        && disk.importer === 'scene' && prefabPatch.SHA256.test(disk.sourceSha256 || '')
        && prefabPatch.SHA256.test(disk.metaSha256 || '') && typeof disk.active === 'boolean'
        && (disk.nodeName === undefined || typeof disk.nodeName === 'string')
        && (disk.parentUuid === undefined || typeof disk.parentUuid === 'string')
        && (disk.nodePath === undefined || typeof disk.nodePath === 'string')
        && (disk.buttonEvents === undefined || validButtonEventList(disk.buttonEvents))
        && (disk.componentEvents === undefined || (disk.componentEvents && typeof disk.componentEvents === 'object'
            && !Array.isArray(disk.componentEvents)
            && Object.keys(disk.componentEvents).sort().join(',') === 'componentInstanceId,eventProperty,events,serializedClassId'
            && typeof disk.componentEvents.componentInstanceId === 'string'
            && disk.componentEvents.componentInstanceId.length > 0 && disk.componentEvents.componentInstanceId.length <= 128
            && typeof disk.componentEvents.serializedClassId === 'string'
            && typeof disk.componentEvents.eventProperty === 'string'
            && (UI_EVENT_PROPERTIES[disk.componentEvents.serializedClassId] || []).includes(disk.componentEvents.eventProperty)
            && validButtonEventList(disk.componentEvents.events, { allowUnbound: true })))
        && (disk.componentProperty === undefined || validSavedComponentProperty(disk.componentProperty))
        && (disk.components === undefined || (Array.isArray(disk.components) && disk.components.length <= 32
            && disk.components.every((component) => component && typeof component === 'object' && !Array.isArray(component)
                && Object.keys(component).sort().join(',') === 'componentInstanceId,serializedClassId'
                && typeof component.componentInstanceId === 'string' && component.componentInstanceId.length > 0
                && component.componentInstanceId.length <= 128 && typeof component.serializedClassId === 'string'
                && component.serializedClassId.length > 0 && component.serializedClassId.length <= 128)
            && new Set(disk.components.map((component) => component.componentInstanceId)).size === disk.components.length))
        && (disk.subtree === undefined || (Array.isArray(disk.subtree) && disk.subtree.length >= 1
            && disk.subtree.length <= 256 && disk.subtree.every((node) => node && typeof node === 'object' && !Array.isArray(node)
                && Object.keys(node).sort().join(',') === 'childCount,nodeName,nodeUuid,parentUuid,siblingIndex'
                && typeof node.nodeUuid === 'string' && typeof node.nodeName === 'string'
                && typeof node.parentUuid === 'string' && Number.isInteger(node.siblingIndex) && node.siblingIndex >= 0
                && Number.isInteger(node.childCount) && node.childCount >= 0)
            && new Set(disk.subtree.map((node) => node.nodeUuid)).size === disk.subtree.length))
        && !!disk.transform && typeof disk.transform === 'object' && !Array.isArray(disk.transform)
        && Object.keys(disk.transform).sort().join(',') === fields.join(',')
        && fields.every((field) => Number.isFinite(disk.transform[field])
            && Math.abs(disk.transform[field]) <= 1000000);
}

function sceneNodeDiskExpected(plan, side, operation) {
    const expected = { ...plan.diskBefore, transform: { ...plan.diskBefore.transform } };
    if (side === 'before') return expected;
    if (plan.operation === 'creator.scene.node.set-transform') {
        Object.assign(expected.transform, plan.expectedAfter);
    } else if (plan.operation === 'creator.scene.node.set-active') {
        expected.active = plan.expectedAfter.active;
    } else if (plan.operation === 'creator.scene.node.rename') {
        expected.nodeName = plan.expectedAfter.name;
        expected.nodePath = plan.expectedAfter.nodePath;
    } else if (plan.operation === 'creator.scene.node.reparent') {
        expected.parentUuid = plan.expectedAfter.parentUuid;
        expected.nodePath = plan.expectedAfter.nodePath;
    } else if (plan.operation === 'creator.scene.button-events.set') {
        expected.buttonEvents = plan.expectedAfter;
    } else if (plan.operation === 'creator.scene.ui-events.set') {
        expected.componentEvents = { ...expected.componentEvents, events: plan.expectedAfter };
    } else if (plan.operation === 'creator.scene.node.set-component-property') {
        expected.componentProperty = { ...expected.componentProperty, value: plan.expectedAfter.serializedValue };
        if (operation && operation.nodeTransformAfter)
            expected.transform = { ...operation.nodeTransformAfter };
        if (plan.restoreSerializedOmission) {
            expected.componentProperty.isDefaultOmitted = true;
            delete expected.componentProperty.serializedProperty;
        } else if (expected.componentProperty.isDefaultOmitted) {
            delete expected.componentProperty.isDefaultOmitted;
            expected.componentProperty.serializedProperty = plan.serializedProperty || plan.property;
        }
    } else if (plan.operation === 'creator.scene.node.add-component') {
        if (operation && typeof operation.componentInstanceId === 'string')
            expected.components = [...expected.components, { componentInstanceId: operation.componentInstanceId,
                serializedClassId: plan.serializedClassId }];
        if (operation && operation.nodeTransformAfter && typeof operation.nodeTransformAfter === 'object')
            expected.transform = { ...operation.nodeTransformAfter };
    } else if (plan.operation === 'creator.scene.node.remove-component') {
        expected.components = expected.components.filter((component) =>
            component.componentInstanceId !== plan.componentInstanceId);
        if (operation && operation.nodeTransformAfter && typeof operation.nodeTransformAfter === 'object')
            expected.transform = { ...operation.nodeTransformAfter };
    }
    return expected;
}

function sceneNodeDiskMatchesPlan(disk, plan, side, operation) {
    if (!disk || disk.verified !== true || disk.sceneUuid !== plan.sceneUuid || disk.nodeUuid !== plan.nodeUuid
        || disk.sceneUrl !== plan.diskBefore.sceneUrl || disk.importer !== plan.diskBefore.importer
        || disk.metaSha256 !== plan.diskBefore.metaSha256) return false;
    const expected = sceneNodeDiskExpected(plan, side, operation);
    if (disk.active !== expected.active || !sceneDiskTransformMatches(disk.transform, expected.transform)) return false;
    for (const field of ['nodeName', 'parentUuid', 'nodePath']) {
        if (expected[field] !== undefined && (field === 'nodePath'
            ? !sceneNodePathsMatch(disk[field], expected[field]) : disk[field] !== expected[field])) return false;
    }
    if (expected.buttonEvents !== undefined && !buttonEventListMatches(disk.buttonEvents, expected.buttonEvents)) return false;
    if (expected.componentEvents !== undefined
        && !sceneComponentValuesEqual(disk.componentEvents, expected.componentEvents)) return false;
    if (expected.componentProperty !== undefined && !sceneComponentValuesEqual(disk.componentProperty, expected.componentProperty)) return false;
    if (expected.components !== undefined && !sceneComponentValuesEqual(disk.components, expected.components)) return false;
    if (expected.subtree !== undefined && !sceneComponentValuesEqual(disk.subtree, expected.subtree)) return false;
    return true;
}

async function observeSceneNodeDiskForReconcile(operation) {
    const plan = operation.plan;
    if (!plan.diskBefore) return null;
    const disk = await sceneNodeDiskStateForPlan(plan);
    return { disk,
        before: disk.sourceSha256 === plan.diskBefore.sourceSha256 && sceneNodeDiskMatchesPlan(disk, plan, 'before'),
        after: disk.sourceSha256 !== plan.diskBefore.sourceSha256
            && sceneNodeDiskMatchesPlan(disk, plan, 'after', operation) };
}

async function reconcileSceneNodeDiskOperation(operation, liveBefore, liveAfter) {
    const state = await observeSceneNodeDiskForReconcile(operation);
    if (!state) return null;
    const mutationMayHaveRun = operation.appliedByInstanceId === INSTANCE_ID
        || ['applying', 'mutation-applied', 'save-requested', 'save-required', 'completed'].includes(operation.status);
    if (mutationMayHaveRun && liveAfter && state.after) {
        operation.status = 'completed'; operation.reconcileReason = null;
        operation.diskReadback = sceneNodeDiskReadback(state.disk);
        operation.completedAt = operation.completedAt || new Date().toISOString();
        operation.completedByInstanceId = operation.completedByInstanceId || operation.appliedByInstanceId || INSTANCE_ID;
    } else if (mutationMayHaveRun && liveAfter && state.before) {
        operation.status = 'save-required'; operation.reconcileReason = 'SCENE_MEMORY_UPDATED_BUT_DISK_UNCHANGED';
    } else if (liveBefore && state.before && operation.status === 'cancelled') {
        // Preserve an explicit user cancellation when both editor and disk still match the plan.
    } else if (liveBefore && state.before
        && ['planned', 'awaiting-approval', 'applying', 'abandoned', 'needs-reconciliation', 'not-applied'].includes(operation.status)) {
        operation.status = 'not-applied'; operation.reconcileReason = null;
    } else {
        operation.status = 'conflict'; operation.reconcileReason = 'SCENE_MEMORY_DISK_STATE_MISMATCH';
    }
    return state;
}

async function verifySceneNodeDiskBefore(plan) {
    if (!plan.diskBefore) return null;
    const disk = await sceneNodeDiskStateForPlan(plan);
    if (disk.sourceSha256 !== plan.diskBefore.sourceSha256 || disk.metaSha256 !== plan.diskBefore.metaSha256
        || !sceneNodeDiskMatchesPlan(disk, plan, 'before')) throw coded('SCENE_DISK_PRECONDITION_FAILED');
    return disk;
}

async function waitForSceneNodeDiskAfter(operation, timeoutMs = SCENE_SAVE_READBACK_TIMEOUT_MS) {
    const plan = operation.plan;
    if (!plan.diskBefore) throw coded('SCENE_DISK_BASELINE_MISSING');
    const deadline = Date.now() + timeoutMs;
    let lastReason = 'SCENE_DISK_READBACK_PENDING';
    do {
        try {
            const disk = await sceneNodeDiskStateForPlan(plan);
            if (disk.sceneUrl !== plan.diskBefore.sceneUrl || disk.importer !== plan.diskBefore.importer)
                throw coded('SCENE_ASSETDB_IDENTITY_CHANGED');
            if (disk.sourceSha256 !== plan.diskBefore.sourceSha256
                && sceneNodeDiskMatchesPlan(disk, plan, 'after', operation))
                return disk;
            lastReason = disk.sourceSha256 === plan.diskBefore.sourceSha256
                ? 'SCENE_DISK_READBACK_PENDING' : 'SCENE_DISK_READBACK_MISMATCH';
        } catch (error) {
            lastReason = error.code || 'SCENE_DISK_READBACK_FAILED';
            if (['SCENE_ASSETDB_IDENTITY_CHANGED', 'SCENE_ASSETDB_IDENTITY_MISMATCH',
                'SCENE_META_IDENTITY_MISMATCH', 'UNSAFE_PROJECT_PATH'].includes(error.code)) throw error;
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
    } while (Date.now() <= deadline);
    throw coded(lastReason);
}

async function confirmSceneNodeDiskPersistence(operation) {
    let disk;
    try { disk = await waitForSceneNodeDiskAfter(operation); }
    catch (error) {
        operation.status = 'save-required';
        operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_UNCONFIRMED';
        operation.diskReadbackFailureAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('SCENE_DISK_READBACK_UNCONFIRMED', operation.reconcileReason);
    }
    operation.diskReadback = sceneNodeDiskReadback(disk);
    return disk;
}

function sceneNodeDeletionAbsentUuids(operation) {
    return operation.plan.expectedBefore.subtree.map((node) => node.nodeUuid);
}

async function waitForSceneNodeDeletionDiskAfter(operation, timeoutMs = SCENE_SAVE_READBACK_TIMEOUT_MS) {
    const plan = operation.plan;
    if (!plan.diskBefore || !Array.isArray(plan.diskBefore.subtree)) throw coded('SCENE_DISK_BASELINE_MISSING');
    const deadline = Date.now() + timeoutMs;
    let lastReason = 'SCENE_DISK_READBACK_PENDING';
    do {
        try {
            const disk = await sceneNodeDiskState(plan.sceneUuid, plan.nodeUuid,
                { absentNodeUuids: sceneNodeDeletionAbsentUuids(operation) });
            if (disk.metaSha256 !== plan.diskBefore.metaSha256) throw coded('SCENE_META_IDENTITY_CHANGED');
            if (disk.nodeAbsent && disk.sourceSha256 !== plan.diskBefore.sourceSha256) return disk;
            lastReason = 'SCENE_DISK_READBACK_PENDING';
        } catch (error) {
            if (error.code === 'SCENE_NODE_STILL_PRESENT') {
                try {
                    const disk = await sceneNodeDiskStateForPlan(plan);
                    lastReason = disk.sourceSha256 === plan.diskBefore.sourceSha256
                        && sceneNodeDiskMatchesPlan(disk, plan, 'before')
                        ? 'SCENE_DISK_READBACK_PENDING' : 'SCENE_DISK_READBACK_MISMATCH';
                } catch (stateError) { lastReason = stateError.code || 'SCENE_DISK_READBACK_FAILED'; }
            } else {
                lastReason = error.code || 'SCENE_DISK_READBACK_FAILED';
                if (['SCENE_ASSETDB_IDENTITY_CHANGED', 'SCENE_ASSETDB_IDENTITY_MISMATCH',
                    'SCENE_META_IDENTITY_MISMATCH', 'SCENE_META_IDENTITY_CHANGED', 'UNSAFE_PROJECT_PATH'].includes(error.code))
                    throw error;
            }
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
    } while (Date.now() <= deadline);
    throw coded(lastReason);
}

async function confirmSceneNodeDeletionDiskPersistence(operation) {
    let disk;
    try { disk = await waitForSceneNodeDeletionDiskAfter(operation); }
    catch (error) {
        operation.status = 'save-required';
        operation.reconcileReason = error.code || 'SCENE_DISK_READBACK_UNCONFIRMED';
        operation.diskReadbackFailureAt = new Date().toISOString();
        writeOperation(operation);
        throw coded('SCENE_DISK_READBACK_UNCONFIRMED', operation.reconcileReason);
    }
    operation.diskReadback = { verified: true, sceneUrl: disk.sceneUrl, sceneUuid: disk.sceneUuid,
        nodeUuid: disk.nodeUuid, nodeAbsent: true, absentNodeUuids: disk.absentNodeUuids,
        sourceSha256: disk.sourceSha256, metaSha256: disk.metaSha256, verifiedAt: new Date().toISOString() };
    return disk;
}

async function reconcileSceneNodeDeletionDiskOperation(operation, liveBefore, liveAfter) {
    const plan = operation.plan;
    let disk;
    let before = false;
    let after = false;
    if (liveAfter) {
        try {
            disk = await sceneNodeDiskState(plan.sceneUuid, plan.nodeUuid,
                { absentNodeUuids: sceneNodeDeletionAbsentUuids(operation) });
            after = disk.metaSha256 === plan.diskBefore.metaSha256
                && disk.sourceSha256 !== plan.diskBefore.sourceSha256 && disk.nodeAbsent === true;
        } catch (error) {
            if (error.code !== 'SCENE_NODE_STILL_PRESENT') throw error;
            disk = await sceneNodeDiskStateForPlan(plan);
            before = disk.sourceSha256 === plan.diskBefore.sourceSha256
                && sceneNodeDiskMatchesPlan(disk, plan, 'before');
        }
    } else {
        disk = await sceneNodeDiskStateForPlan(plan);
        before = disk.sourceSha256 === plan.diskBefore.sourceSha256
            && sceneNodeDiskMatchesPlan(disk, plan, 'before');
    }
    const mutationMayHaveRun = operation.appliedByInstanceId === INSTANCE_ID
        || ['applying', 'mutation-applied', 'save-requested', 'save-required', 'completed'].includes(operation.status);
    if (mutationMayHaveRun && liveAfter && after) {
        operation.status = 'completed'; operation.reconcileReason = null;
        operation.diskReadback = { verified: true, sceneUrl: disk.sceneUrl, sceneUuid: disk.sceneUuid,
            nodeUuid: disk.nodeUuid, nodeAbsent: true, absentNodeUuids: disk.absentNodeUuids,
            sourceSha256: disk.sourceSha256, metaSha256: disk.metaSha256, verifiedAt: new Date().toISOString() };
        operation.completedAt = operation.completedAt || new Date().toISOString();
        operation.completedByInstanceId = operation.completedByInstanceId || operation.appliedByInstanceId || INSTANCE_ID;
    } else if (mutationMayHaveRun && liveAfter && before) {
        operation.status = 'save-required'; operation.reconcileReason = 'SCENE_MEMORY_UPDATED_BUT_DISK_UNCHANGED';
    } else if (liveBefore && before && operation.status === 'cancelled') {
        // Preserve explicit cancellation when both the editor and saved scene match the plan.
    } else if (liveBefore && before
        && ['planned', 'awaiting-approval', 'applying', 'abandoned', 'needs-reconciliation', 'not-applied'].includes(operation.status)) {
        operation.status = 'not-applied'; operation.reconcileReason = null;
    } else {
        operation.status = 'conflict'; operation.reconcileReason = 'SCENE_MEMORY_DISK_STATE_MISMATCH';
    }
    return { disk, before, after };
}

async function validateSceneComposePlan(operation) {
    const plan = operation.plan;
    const state = await callScene('compositionState', plan.request, 30000);
    if (!state || state.available !== true || JSON.stringify(state) !== JSON.stringify(plan.expectedState))
        throw coded(state && state.available === false ? state.reason || 'SCENE_COMPOSE_PREFLIGHT_FAILED' : 'SCENE_COMPOSE_PRECONDITION_FAILED');
    const assets = await composeAssetIdentities(plan.request);
    if (JSON.stringify(assets) !== JSON.stringify(plan.assetIdentities)) throw coded('SCENE_COMPOSE_ASSET_PRECONDITION_FAILED');
    const expectedSceneAsset = plan.sceneAssetIdentity || await sceneAssetIdentity(plan.sceneUuid);
    const currentSceneAsset = await sceneAssetIdentity(plan.sceneUuid);
    if (currentSceneAsset.uuid !== expectedSceneAsset.uuid || currentSceneAsset.url !== expectedSceneAsset.url
        || currentSceneAsset.importer !== expectedSceneAsset.importer
        || currentSceneAsset.sceneSha256 !== expectedSceneAsset.sceneSha256
        || currentSceneAsset.metaSha256 !== expectedSceneAsset.metaSha256)
        throw coded('SCENE_COMPOSE_SCENE_ASSET_PRECONDITION_FAILED');
    return state;
}


function sceneComposeReceipt(operation, readback) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        sceneName: plan.sceneName, sceneUuid: plan.sceneUuid, sceneAssetIdentity: plan.sceneAssetIdentity,
        createdNodes: readback && readback.nodes || [], componentCount: plan.request.components.length,
        prefabInstanceCount: plan.request.nodes.filter((item) => !!item.prefabUuid).length,
        buttonEventCount: (plan.request.buttonEvents || []).length,
        uiEventGroupCount: (plan.request.uiEvents || []).length,
        uiEventCount: (plan.request.uiEvents || []).reduce((total, group) => total + group.events.length, 0),
        assetIdentities: plan.assetIdentities,
        sceneSaveRequestSent: !!operation.sceneSaveRequestSent, sceneSaveCompletionConfirmed: false,
        scenePersistenceConfirmed: !!(operation.scenePersistenceReadback && operation.scenePersistenceReadback.verified),
        scenePersistenceReadback: operation.scenePersistenceReadback || null,
        plannedByInstanceId: operation.plannedByInstanceId, appliedByInstanceId: operation.appliedByInstanceId || null,
        completedByInstanceId: operation.completedByInstanceId || null,
        approvedAt: operation.approvedAt || null, completedAt: operation.completedAt || null,
        reconciledAt: operation.reconciledAt || null,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.compose.reconcile',
            manualSaveMayBeRequired: ['save-required', 'save-unconfirmed'].includes(operation.status),
            note: operation.scenePersistenceReadback && operation.scenePersistenceReadback.verified
                ? 'The exact Creator scene AssetDB file and .meta were reread and semantically matched the planned nodes, transforms, components, resource references, and UI event lists.'
                : 'Disk persistence is not yet confirmed; inspect or save the scene in Creator, then reconcile. The save IPC has no documented acknowledgement.' } };
}

function sceneComposeReadbackMatches(operation, readback) {
    if (!readback || readback.available !== true || readback.sceneUuid !== operation.plan.sceneUuid
        || !Array.isArray(readback.nodes) || readback.nodes.length !== operation.plan.request.nodes.length) return false;
    const nodesById = new Map(readback.nodes.map((node) => [node.id, node]));
    const resolveUuid = (ref) => ref.startsWith('new:')
        ? operation.plan.request.nodes.find((node) => node.id === ref.slice(4))?.uuid || null : ref.slice(5);
    const sizeManagedByCreator = (nodeId, node) => operation.plan.request.components.some((component) =>
        component.nodeRef === `new:${nodeId}` && ['cc.Label', 'cc.Widget'].includes(component.className))
        || (node.allComponents || []).some((component) => ['cc.Label', 'cc.Widget'].includes(component.componentClassName));
    const positionManagedByCreator = (expectedNode, node) => {
        const requestedWidget = operation.plan.request.components.find((component) => component.nodeRef === `new:${expectedNode.id}`
            && component.className === 'cc.Widget');
        const requestedWidgetAligns = requestedWidget && requestedWidget.properties.some((property) =>
            ['isAlignLeft', 'isAlignRight', 'isAlignTop', 'isAlignBottom'].includes(property.name) && property.value === true);
        if (requestedWidgetAligns || (expectedNode.prefabUuid
            && (node.allComponents || []).some((component) => component.componentClassName === 'cc.Widget')))
            return true;
        const parent = operation.plan.expectedState.createdNodes.find((node) => node.uuid === expectedNode.parentUuid);
        if (!parent) return false;
        const layout = operation.plan.request.components.find((component) => component.nodeRef === `new:${parent.id}`
            && component.className === 'cc.Layout');
        const type = layout && layout.properties.find((property) => property.name === 'type')?.value;
        const enabled = layout && layout.properties.find((property) => property.name === 'enabled')?.value;
        return !!layout && enabled !== false && Number.isFinite(type) && type !== 0;
    };
    for (const expectedNode of operation.plan.expectedState.createdNodes) {
        const node = nodesById.get(expectedNode.id);
        if (!node || node.uuid !== expectedNode.uuid || node.name !== expectedNode.name
            || node.parentUuid !== expectedNode.parentUuid || typeof node.nodePath !== 'string') return false;
        if ((node.prefabUuid || null) !== (expectedNode.prefabUuid || null)) return false;
        if (expectedNode.prefabUuid && node.prefabRootUuid !== expectedNode.prefabRootUuid) return false;
        for (const key of ['x', 'y', 'z', 'scaleX', 'scaleY', 'angle', 'width', 'height',
            ...(Object.prototype.hasOwnProperty.call(expectedNode.transform, 'anchorX') ? ['anchorX'] : []),
            ...(Object.prototype.hasOwnProperty.call(expectedNode.transform, 'anchorY') ? ['anchorY'] : [])]) {
            const creatorSized = ['width', 'height'].includes(key) && sizeManagedByCreator(expectedNode.id, node);
            const layoutPositioned = ['x', 'y'].includes(key) && positionManagedByCreator(expectedNode, node);
            const creatorControlled = creatorSized || layoutPositioned;
            if (!Number.isFinite(node.transform && node.transform[key])
                || (!creatorControlled && Math.abs(node.transform[key] - expectedNode.transform[key]) > 0.001)) return false;
        }
    }
    for (const expectedComponent of operation.plan.request.components) {
        const node = nodesById.get(expectedComponent.nodeRef.slice(4));
        const component = node && node.components.find((item) => item.id === expectedComponent.id);
        if (!component || component.available === false || component.componentClassName !== expectedComponent.className) return false;
        for (const property of expectedComponent.properties) {
            let expected = property.value;
            if (property.value && typeof property.value === 'object' && typeof property.value.assetUuid === 'string')
                expected = property.value.assetUuid;
            else if (property.value && typeof property.value === 'object' && typeof property.value.nodeRef === 'string')
                expected = `node:${resolveUuid(property.value.nodeRef)}`;
            else if (property.value && typeof property.value === 'object' && typeof property.value.componentRef === 'string')
                expected = property.value.componentRef.startsWith('new:') ? `component:${property.value.componentRef.slice(4)}`
                    : `component:${property.value.componentRef.slice(5)}:${property.value.componentInstanceId}`;
            if (!Object.is(component.propertyValues[property.name], expected)) return false;
        }
    }
    const expectedEvent = (event, targetRefField) => ({ targetUuid: resolveUuid(event[targetRefField]),
        component: event.component || event.handlerComponentClassName, handler: event.handler,
        customEventData: event.customEventData || '' });
    const eventListsMatch = (actual, expected) => Array.isArray(actual) && actual.length === expected.length
        && actual.every((left, index) => {
            const right = expected[index];
            return left.targetUuid === right.targetUuid && left.component === right.component
                && left.handler === right.handler && (left.customEventData || '') === right.customEventData;
        });
    const expectedByButton = new Map();
    for (const event of (operation.plan.request.buttonEvents || [])) {
        const buttonId = event.buttonRef.slice(4);
        const buttonComponent = operation.plan.request.components.find((item) => item.nodeRef === event.buttonRef && item.className === 'cc.Button');
        if (!buttonComponent) return false;
        const node = nodesById.get(buttonId);
        const component = node && node.components.find((item) => item.id === buttonComponent.id);
        if (!component || !Array.isArray(component.clickEvents)) return false;
        const key = `${buttonId}:${buttonComponent.id}`;
        const list = expectedByButton.get(key) || [];
        list.push(expectedEvent(event, 'handlerRef'));
        expectedByButton.set(key, list);
    }
    for (const [key, expectedEvents] of expectedByButton) {
        const [buttonId, componentId] = key.split(':');
        const component = nodesById.get(buttonId)?.components.find((item) => item.id === componentId);
        const actual = component && component.clickEvents || [];
        if (!eventListsMatch(actual, expectedEvents)) return false;
    }
    const expectedByComponent = new Map();
    for (const group of (operation.plan.request.uiEvents || [])) {
        const componentId = group.componentRef.slice(4);
        const node = nodesById.get(operation.plan.request.components.find((item) => item.id === componentId)?.nodeRef.slice(4));
        const component = node && node.components.find((item) => item.id === componentId);
        if (!component || !component.eventLists || !Array.isArray(component.eventLists[group.eventProperty])) return false;
        const expected = group.events.map((event) => expectedEvent(event, 'targetRef'));
        const key = `${componentId}:${group.eventProperty}`;
        if (expectedByComponent.has(key) || !eventListsMatch(component.eventLists[group.eventProperty], expected)) return false;
        expectedByComponent.set(key, true);
    }
    return true;
}

function readStableProjectFile(filename, maxBytes, code) {
    const before = fs.lstatSync(filename);
    if (!before.isFile() || before.isSymbolicLink() || before.size < 2 || before.size > maxBytes)
        throw coded(code);
    const bytes = fs.readFileSync(filename);
    const after = fs.lstatSync(filename);
    if (!after.isFile() || after.isSymbolicLink() || bytes.length !== before.size
        || before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
        || before.mtimeMs !== after.mtimeMs) throw coded(code);
    return bytes;
}

async function inspectSceneComposePersistence(operation) {
    const plan = operation.plan;
    const identity = plan.sceneAssetIdentity || await sceneAssetIdentity(plan.sceneUuid);
    const row = await queryAssetByUrl(identity.url);
    if (!row || row.url !== identity.url || row.uuid !== identity.uuid
        || (row.importer || 'scene') !== identity.importer)
        throw coded('SCENE_ASSETDB_IDENTITY_MISMATCH');
    const relative = identity.url.slice('db://assets/'.length);
    const sceneFile = safeProjectFile(relative, /\.fire$/i);
    const metaFile = safeProjectFile(`${relative}.meta`);
    const sceneBytes = readStableProjectFile(sceneFile, MAX_SCENE_SERIALIZATION_BYTES, 'SCENE_SERIALIZATION_FILE_UNSAFE');
    const metaBytes = readStableProjectFile(metaFile, MAX_SCENE_META_BYTES, 'SCENE_META_FILE_UNSAFE');
    const inspection = inspectSceneComposition({ sceneBytes, metaBytes, sceneUuid: plan.sceneUuid,
        sceneAssetRow: row, operation, readback: operation.sceneReadback });
    if (!inspection.verified) return { ...inspection, sceneUrl: identity.url };
    return { verified: true, sceneUuid: plan.sceneUuid, sceneAssetUuid: identity.uuid, sceneUrl: identity.url,
        scenePath: relative, sceneSha256: fileHash(sceneBytes), metaSha256: fileHash(metaBytes),
        nodeCount: inspection.nodeCount, componentCount: inspection.componentCount,
        buttonEventCount: inspection.buttonEventCount, uiEventGroupCount: inspection.uiEventGroupCount,
        uiEventCount: inspection.uiEventCount, prefabInstanceCount: inspection.prefabInstanceCount,
        verifiedAt: new Date().toISOString() };
}

async function waitForSceneComposePersistence(operation, timeoutMs = SCENE_SAVE_READBACK_TIMEOUT_MS) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let last = { verified: false, reason: 'SCENE_PERSISTENCE_READBACK_PENDING' };
    do {
        try {
            last = await inspectSceneComposePersistence(operation);
            if (last.verified) return last;
            if (last.reason === 'SCENE_ASSETDB_IDENTITY_MISMATCH') return last;
        } catch (error) {
            last = { verified: false, reason: error.code || 'SCENE_PERSISTENCE_READBACK_FAILED' };
            if (['UNSAFE_PROJECT_PATH', 'SCENE_ASSETDB_IDENTITY_MISMATCH', 'SCENE_SERIALIZATION_FILE_UNSAFE',
                'SCENE_META_FILE_UNSAFE'].includes(error.code)) return last;
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
    } while (Date.now() <= deadline);
    return last;
}

async function readSceneComposeSubtrees(operation) {
    const plan = operation.plan;
    const roots = plan.request.nodes.filter((node) => !node.parentRef.startsWith('new:'));
    const states = [];
    const covered = new Set();
    for (const root of roots) {
        const node = plan.request.nodes.find((candidate) => candidate.id === root.id);
        const state = await callScene('nodeDeleteState', { sceneUuid: plan.sceneUuid, nodeUuid: node.uuid }, 30000);
        if (!state || state.available !== true || state.nodeUuid !== node.uuid)
            throw coded(state && state.reason || 'SCENE_COMPOSE_SUBTREE_READBACK_FAILED');
        for (const entry of state.subtree || []) {
            if (covered.has(entry.nodeUuid)) throw coded('SCENE_COMPOSE_SUBTREE_OVERLAP');
            covered.add(entry.nodeUuid);
        }
        states.push(state);
    }
    if (plan.request.nodes.some((node) => !covered.has(node.uuid))) throw coded('SCENE_COMPOSE_SUBTREE_INCOMPLETE');
    return states;
}

function composeOperationLiveReadbackMatches(source, readback, subtrees) {
    if (!sceneComposeReadbackMatches(source, readback) || canonical(readback) !== canonical(source.sceneReadback)) return false;
    return Array.isArray(source.createdSubtrees) && Array.isArray(subtrees)
        && canonical(subtrees) === canonical(source.createdSubtrees);
}

async function validateSceneComposeCompensationSource(compensation, source, { checkDisk = true } = {}) {
    const plan = compensation.plan;
    if (!source || source.operation !== 'creator.scene.compose' || source.status !== 'completed'
        || source.planHash !== plan.sourcePlanHash || source.operationId !== plan.sourceOperationId
        || source.plan.projectRoot !== plan.projectRoot || source.plan.creatorVersion !== plan.creatorVersion
        || source.plan.sceneUuid !== plan.sceneUuid || source.plan.sceneAssetIdentity.uuid !== plan.sceneAssetBefore.uuid
        || source.compensationOperationId !== compensation.operationId
        || source.compensationPlanHash !== compensation.planHash
        || source.plan.compensationFor || source.compensatedByOperationId
        || !source.scenePersistenceReadback || source.scenePersistenceReadback.verified !== true
        || source.scenePersistenceReadback.sceneSha256 !== plan.sceneAssetAfter.sceneSha256
        || source.scenePersistenceReadback.metaSha256 !== plan.sceneAssetAfter.metaSha256
        || !Array.isArray(source.createdSubtrees) || !source.createdSubtrees.length)
        throw coded('SCENE_COMPOSE_COMPENSATION_SOURCE_MISMATCH');
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    if (checkDisk) {
        const disk = await sceneAssetIdentity(plan.sceneUuid);
        if (disk.uuid !== plan.sceneAssetAfter.sceneAssetUuid || disk.url !== plan.sceneAssetAfter.sceneUrl
            || disk.sceneSha256 !== plan.sceneAssetAfter.sceneSha256 || disk.metaSha256 !== plan.sceneAssetAfter.metaSha256)
            throw coded('SCENE_COMPOSE_COMPENSATION_DISK_DRIFT');
    }
    const readback = await callScene('compositionReadback', source.plan.request, 30000);
    const subtrees = await readSceneComposeSubtrees(source);
    if (!composeOperationLiveReadbackMatches(source, readback, subtrees))
        throw coded('SCENE_COMPOSE_COMPENSATION_LIVE_DRIFT');
    return { readback, subtrees };
}

async function commitSceneCompose(input, context) {
    const operation = readSceneComposeOperation(input.operationId);
    verifySceneOperationIdentity(operation);
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'awaiting-approval'
        || operation.status === 'mutation-applied' || operation.status === 'save-requested'
        || operation.status === 'needs-reconciliation' ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    await validateSceneComposePlan(operation);
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    try { await validateSceneComposePlan(operation); }
    catch (error) {
        operation.status = 'conflict';
        operation.conflictAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_COMPOSE_PRECONDITION_FAILED';
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    let result;
    try { result = await callScene('compose', { ...operation.plan.request,
        expectedState: operation.plan.expectedState }, 60000); }
    catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'SCENE_COMPOSE_WRITE_UNCERTAIN';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!result || result.available !== true || !result.readback) {
        operation.status = result && result.mutationStarted ? 'needs-reconciliation' : 'not-applied';
        operation.reconcileReason = result && result.reason || 'SCENE_COMPOSE_WRITE_READBACK_FAILED';
        writeOperation(operation);
        throw coded(operation.status === 'needs-reconciliation' ? 'OPERATION_RECONCILIATION_REQUIRED' : operation.reconcileReason,
            operation.reconcileReason);
    }
    operation.status = 'mutation-applied';
    operation.sceneReadback = result.readback;
    operation.mutationAppliedAt = new Date().toISOString();
    writeOperation(operation);
    if (!sceneComposeReadbackMatches(operation, result.readback)) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = 'SCENE_COMPOSE_READBACK_MISMATCH';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    try {
        operation.createdSubtrees = await readSceneComposeSubtrees(operation);
        writeOperation(operation);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || 'SCENE_COMPOSE_SUBTREE_READBACK_FAILED';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) {
        operation.status = 'save-required';
        operation.saveErrorCode = 'CREATOR_SCENE_SAVE_REQUEST_FAILED';
        writeOperation(operation);
        throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED', String(error.message || error));
    }
    operation.status = 'save-requested';
    operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const readback = await callScene('compositionReadback', operation.plan.request, 30000);
    if (!sceneComposeReadbackMatches(operation, readback)) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = 'SCENE_COMPOSE_POST_SAVE_READBACK_MISMATCH';
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    operation.sceneReadback = readback;
    operation.scenePersistenceReadback = await waitForSceneComposePersistence(operation);
    if (operation.scenePersistenceReadback.verified) {
        operation.status = 'completed';
        operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID;
    } else {
        operation.status = 'save-unconfirmed';
        operation.persistenceReason = operation.scenePersistenceReadback.reason || 'SCENE_PERSISTENCE_READBACK_UNCONFIRMED';
    }
    writeOperation(operation);
    return sceneComposeReceipt(operation, readback);
}

async function reconcileSceneCompose(input) {
    const operation = readSceneComposeOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    if (operation.status === 'cancelled') {
        let observed;
        try {
            await validateSceneComposePlan(operation);
            observed = { mutationApplied: false, sceneAssetIdentity: operation.plan.sceneAssetIdentity,
                verifiedBeforeState: true, readOnly: true };
        } catch (error) {
            operation.status = 'conflict';
            operation.reconcileReason = error.code || 'SCENE_COMPOSE_CANCELLATION_STATE_CHANGED';
            operation.reconciledAt = new Date().toISOString();
            writeOperation(operation);
            return { ...sceneComposeReceipt(operation, null), observed: null, reason: operation.reconcileReason,
                retry: 'Never replay this operation. The scene or its saved asset changed after cancellation; inspect it and create a new plan.' };
        }
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        return { ...sceneComposeReceipt(operation, null), observed,
            retry: 'Never replay this operation. The original plan remains cancelled and the scene before-state is unchanged.' };
    }
    let readback;
    try { readback = await callScene('compositionReadback', operation.plan.request, 30000); }
    catch (error) {
        operation.status = operation.sceneSaveRequestSent ? 'save-unconfirmed' : 'needs-reconciliation';
        operation.reconciledAt = new Date().toISOString();
        operation.reconcileReason = error.code || 'SCENE_COMPOSE_READBACK_FAILED';
        writeOperation(operation);
        return { ...sceneComposeReceipt(operation, null), observed: null, reason: operation.reconcileReason };
    }
    if (!readback || readback.available !== true) {
        let verifiedBeforeState = false;
        if (operation.sceneSaveRequestSent) {
            operation.status = 'save-unconfirmed';
            operation.reconcileReason = readback && readback.reason || 'SCENE_COMPOSE_READBACK_UNAVAILABLE';
        } else {
            try {
                await validateSceneComposePlan(operation);
                operation.status = 'not-applied';
                operation.reconcileReason = null;
                verifiedBeforeState = true;
            } catch (error) {
                operation.status = 'needs-reconciliation';
                operation.reconcileReason = error.code || 'SCENE_COMPOSE_BEFORE_STATE_UNVERIFIED';
            }
        }
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        return { ...sceneComposeReceipt(operation, readback), observed: readback, verifiedBeforeState,
            retry: 'Never replay this operation. If the created node identities do not match, inspect the active scene and use a new plan.' };
    }
    if (!sceneComposeReadbackMatches(operation, readback)) {
        operation.status = 'conflict';
        operation.reconcileReason = 'SCENE_COMPOSE_LIVE_READBACK_MISMATCH';
        operation.reconciledAt = new Date().toISOString();
        writeOperation(operation);
        return { ...sceneComposeReceipt(operation, readback), observed: readback, verifiedBeforeState: false,
            reason: operation.reconcileReason,
            retry: 'Never replay this operation. The live scene differs from the original composition snapshot; inspect it and plan a new operation.' };
    }
    // The exact live snapshot becomes the compensation baseline after structural, reference,
    // property, and event checks pass; Creator may recompute Label, Widget, and Layout geometry
    // when the project is reopened.
    operation.sceneReadback = readback;
    try {
        operation.scenePersistenceReadback = await waitForSceneComposePersistence(operation, 0);
    } catch (error) {
        operation.scenePersistenceReadback = { verified: false, reason: error.code || 'SCENE_PERSISTENCE_READBACK_FAILED' };
    }
    let verifiedBeforeState = false;
    if (operation.scenePersistenceReadback && operation.scenePersistenceReadback.verified) {
        operation.status = 'completed';
        operation.completedAt = operation.completedAt || new Date().toISOString();
        operation.completedByInstanceId = operation.completedByInstanceId || INSTANCE_ID;
        operation.reconcileReason = null;
    } else if (operation.sceneSaveRequestSent) operation.status = 'save-unconfirmed';
    else if (['mutation-applied', 'applying', 'needs-reconciliation'].includes(operation.status)) operation.status = 'save-required';
    else operation.status = 'conflict';
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    const observed = operation.scenePersistenceReadback && operation.scenePersistenceReadback.verified
        ? operation.scenePersistenceReadback : readback;
    return { ...sceneComposeReceipt(operation, readback), observed, liveReadback: readback, verifiedBeforeState,
        retry: 'Never replay this operation. If the created node identities do not match, inspect the active scene and use a new plan.' };
}

function readSceneComposeCompensationOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES) throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.scene.compose.compensate' || !plan || plan.operation !== operation.operation
        || plan.operationId !== operationId || !/^[0-9a-f-]{36}$/i.test(plan.sourceOperationId || '')
        || !/^[a-f0-9]{64}$/.test(plan.sourcePlanHash || '') || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.sceneUuid !== 'string' || !Array.isArray(plan.createdSubtrees)
        || !plan.createdSubtrees.length || !plan.sceneAssetBefore || !plan.sceneAssetAfter
        || typeof plan.expiresAt !== 'string'
        || !['planned', 'applying', 'mutation-applied', 'save-requested', 'save-required',
            'save-unconfirmed', 'completed', 'not-applied', 'needs-reconciliation', 'conflict'].includes(operation.status))
        throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    return operation;
}

function verifySceneComposeCompensationSource(operation) {
    const plan = operation.plan;
    const source = readSceneComposeOperation(plan.sourceOperationId);
    if (source.status !== 'completed' || source.planHash !== plan.sourcePlanHash
        || source.compensationOperationId !== operation.operationId
        || source.compensationPlanHash !== operation.planHash
        || source.plan.projectRoot !== plan.projectRoot || source.plan.creatorVersion !== plan.creatorVersion
        || source.plan.sceneUuid !== plan.sceneUuid || source.plan.sceneAssetIdentity.uuid !== plan.sceneAssetBefore.uuid
        || source.plan.sceneAssetIdentity.sceneSha256 !== plan.sceneAssetBefore.sceneSha256
        || source.plan.sceneAssetIdentity.metaSha256 !== plan.sceneAssetBefore.metaSha256
        || canonical(source.createdSubtrees) !== canonical(plan.createdSubtrees)
        || source.scenePersistenceReadback.sceneSha256 !== plan.sceneAssetAfter.sceneSha256
        || source.scenePersistenceReadback.metaSha256 !== plan.sceneAssetAfter.metaSha256
        || source.compensatedByOperationId && source.compensatedByOperationId !== operation.operationId)
        throw coded('SCENE_COMPOSE_COMPENSATION_SOURCE_MISMATCH');
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    return source;
}

function composeCompensationReceipt(operation, observed = null) {
    const plan = operation.plan;
    return { operationId: operation.operationId, operation: operation.operation, status: operation.status,
        sourceOperationId: plan.sourceOperationId, sourcePlanHash: plan.sourcePlanHash,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion,
        sceneUuid: plan.sceneUuid, createdNodeCount: plan.createdSubtrees.reduce((count, root) => count + root.subtree.length, 0),
        rootCount: plan.createdSubtrees.length, sceneSaveRequestSent: !!operation.sceneSaveRequestSent,
        baselineRestored: !!(operation.diskReadback && operation.diskReadback.verified),
        diskReadback: operation.diskReadback || null, observed,
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.compose.compensate.reconcile',
            note: 'Reconcile only observes node identities and the original .fire/.meta hashes; it never repeats deletion or save.' } };
}

async function createSceneComposeCompensationPlan(input) {
    const source = readSceneComposeOperation(input.sourceOperationId);
    verifySceneOperationIdentity(source, { requireCurrentContract: false });
    if (source.status !== 'completed' || !source.scenePersistenceReadback
        || source.scenePersistenceReadback.verified !== true || source.plan.compensationFor
        || source.compensatedByOperationId || !Array.isArray(source.createdSubtrees) || !source.createdSubtrees.length)
        throw coded('SCENE_COMPOSE_COMPENSATION_SOURCE_NOT_ELIGIBLE');
    if (source.compensationOperationId) throw coded('SCENE_COMPOSE_COMPENSATION_ALREADY_RESERVED');
    const current = await sceneAssetIdentity(source.plan.sceneUuid);
    if (current.uuid !== source.scenePersistenceReadback.sceneAssetUuid
        || current.url !== source.scenePersistenceReadback.sceneUrl
        || current.sceneSha256 !== source.scenePersistenceReadback.sceneSha256
        || current.metaSha256 !== source.scenePersistenceReadback.metaSha256)
        throw coded('SCENE_COMPOSE_COMPENSATION_DISK_DRIFT');
    const readback = await callScene('compositionReadback', source.plan.request, 30000);
    const subtrees = await readSceneComposeSubtrees(source);
    if (!composeOperationLiveReadbackMatches(source, readback, subtrees))
        throw coded('SCENE_COMPOSE_COMPENSATION_LIVE_DRIFT');
    const operationId = uuid();
    const plan = { operationId, operation: 'creator.scene.compose.compensate', sourceOperationId: source.operationId,
        sourcePlanHash: source.planHash, projectRoot: source.plan.projectRoot, creatorVersion: source.plan.creatorVersion,
        extensionVersion: extensionPackage.version, contractFingerprint: CONTRACT_FINGERPRINT,
        creatorInstanceId: INSTANCE_ID, sceneUuid: source.plan.sceneUuid,
        sceneAssetBefore: source.plan.sceneAssetIdentity, sceneAssetAfter: source.scenePersistenceReadback,
        createdSubtrees: source.createdSubtrees, expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId, operation: plan.operation, plan,
        planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(), plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    source.compensationOperationId = operationId;
    source.compensationPlanHash = operation.planHash;
    source.compensationPlannedAt = new Date().toISOString();
    writeOperation(source);
    return { operationId, operation: plan.operation, status: operation.status, planHash: operation.planHash,
        sourceOperationId: source.operationId, sourcePlanHash: source.planHash, projectRoot: plan.projectRoot,
        creatorVersion: plan.creatorVersion, sceneUuid: plan.sceneUuid, sceneAssetAfter: plan.sceneAssetAfter,
        deleteRoots: plan.createdSubtrees.map((root) => ({ nodeUuid: root.nodeUuid, nodePath: root.nodePath,
            nodeName: root.nodeName, parentUuid: root.parentUuid, childCount: root.childCount,
            subtreeNodeCount: root.subtree.length })),
        diff: { action: 'delete-source-created-nodes', sourceOperationId: source.operationId,
            sourcePlanHash: source.planHash, restoreSceneSha256: plan.sceneAssetBefore.sceneSha256,
            restoreMetaSha256: plan.sceneAssetBefore.metaSha256 },
        recovery: { automaticRetry: false, reconcileCommand: 'creator.scene.compose.compensate.reconcile' } };
}

async function waitForSceneComposeBaseline(plan, timeoutMs = SCENE_SAVE_READBACK_TIMEOUT_MS) {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    let last = null;
    do {
        try {
            last = await sceneAssetIdentity(plan.sceneUuid);
            if (last.uuid === plan.sceneAssetBefore.uuid && last.url === plan.sceneAssetBefore.url
                && last.sceneSha256 === plan.sceneAssetBefore.sceneSha256
                && last.metaSha256 === plan.sceneAssetBefore.metaSha256)
                return { verified: true, sceneUuid: plan.sceneUuid, sceneUrl: last.url,
                    sceneSha256: last.sceneSha256, metaSha256: last.metaSha256, verifiedAt: new Date().toISOString() };
        } catch (error) { last = { reason: error.code || 'SCENE_ASSET_IDENTITY_UNAVAILABLE' }; }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
    } while (Date.now() <= deadline);
    return { verified: false, reason: 'SCENE_COMPOSE_BASELINE_HASH_MISMATCH',
        observedSceneSha256: last && last.sceneSha256 || null, observedMetaSha256: last && last.metaSha256 || null };
}

async function commitSceneComposeCompensation(input, context) {
    let operation;
    let phase = 'read-operation';
    try {
        operation = readSceneComposeCompensationOperation(input.operationId);
        phase = 'verify-identity';
        verifySceneOperationIdentity(operation);
        phase = 'verify-source';
        verifySceneComposeCompensationSource(operation);
        if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
        if (operation.status !== 'planned') throw coded(operation.status === 'applying' || operation.status === 'mutation-applied'
            || operation.status === 'save-requested' || operation.status === 'needs-reconciliation'
            ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
        if (Date.now() > Date.parse(operation.plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
        const source = readSceneComposeOperation(operation.plan.sourceOperationId);
        phase = 'validate-live-and-disk-state';
        await validateSceneComposeCompensationSource(operation, source);
    } catch (error) {
        if (operation && operation.status === 'planned') {
            operation.preCommitFailure = { phase, code: error.code || null,
                message: String(error.message || error).slice(0, 240), at: new Date().toISOString() };
            writeOperation(operation);
        }
        if (!error.code) throw coded('SCENE_COMPOSE_COMPENSATION_PREFLIGHT_FAILED', `${phase}: ${String(error.message || error)}`);
        throw error;
    }
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
    if (!approved) { operation.status = 'not-applied'; operation.cancelledAt = new Date().toISOString(); writeOperation(operation); throw coded('OPERATION_NOT_APPROVED'); }
    try { await authorizeWriteRequest(context && context.requestId); }
    catch (error) { operation.status = 'not-applied'; operation.abandonedAt = new Date().toISOString(); writeOperation(operation); throw coded('WRITE_REQUEST_NO_LONGER_ACTIVE'); }
    try { await validateSceneComposeCompensationSource(operation, readSceneComposeOperation(operation.plan.sourceOperationId)); }
    catch (error) { operation.status = 'conflict'; operation.reconcileReason = error.code || 'SCENE_COMPOSE_COMPENSATION_PRECONDITION_FAILED'; writeOperation(operation); throw error; }
    operation.status = 'applying';
    operation.approvedAt = new Date().toISOString();
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    try {
        for (const root of orderCreatedSubtreesForDeletion(operation.plan.createdSubtrees)) {
            const result = await callScene('deleteNode', { sceneUuid: operation.plan.sceneUuid,
                nodeUuid: root.nodeUuid, nodePath: root.nodePath, expectedName: root.nodeName,
                expectedParentUuid: root.parentUuid, expectedChildCount: root.childCount,
                expectedSubtree: root.subtree }, 30000);
            if (!result || result.available !== true || result.deleted !== true)
                throw coded(result && result.reason || 'SCENE_COMPOSE_COMPENSATION_DELETE_FAILED');
        }
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.reconcileReason = error.code || error.message || 'SCENE_COMPOSE_COMPENSATION_DELETE_FAILED';
        operation.mutationMayHaveRun = true;
        writeOperation(operation);
        throw coded('OPERATION_RECONCILIATION_REQUIRED', operation.reconcileReason);
    }
    operation.status = 'mutation-applied';
    operation.mutationAppliedAt = new Date().toISOString();
    writeOperation(operation);
    if (!Editor.Ipc || typeof Editor.Ipc.sendToPanel !== 'function') throw coded('CREATOR_SCENE_SAVE_IPC_UNAVAILABLE');
    try { Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save'); }
    catch (error) { operation.status = 'save-required'; operation.saveErrorCode = 'CREATOR_SCENE_SAVE_REQUEST_FAILED'; writeOperation(operation); throw coded('CREATOR_SCENE_SAVE_REQUEST_FAILED'); }
    operation.status = 'save-requested';
    operation.sceneSaveRequestSent = true;
    operation.sceneSaveRequestedAt = new Date().toISOString();
    writeOperation(operation);
    operation.diskReadback = await waitForSceneComposeBaseline(operation.plan);
    operation.status = operation.diskReadback.verified ? 'completed' : 'save-unconfirmed';
    operation.completedAt = operation.diskReadback.verified ? new Date().toISOString() : null;
    operation.reconciledAt = null;
    writeOperation(operation);
    if (operation.diskReadback.verified) {
        const currentSource = readSceneComposeOperation(operation.plan.sourceOperationId);
        currentSource.compensatedByOperationId = operation.operationId;
        currentSource.compensatedAt = new Date().toISOString();
        currentSource.compensationDiskReadback = operation.diskReadback;
        writeOperation(currentSource);
    }
    return composeCompensationReceipt(operation, operation.diskReadback);
}

async function reconcileSceneComposeCompensation(input) {
    const operation = readSceneComposeCompensationOperation(input.operationId);
    verifySceneOperationIdentity(operation, { requireCurrentContract: false });
    const source = verifySceneComposeCompensationSource(operation);
    let disk = null;
    try { disk = await sceneAssetIdentity(operation.plan.sceneUuid); }
    catch (error) { disk = { reason: error.code || 'SCENE_ASSET_IDENTITY_UNAVAILABLE' }; }
    let absent = 0;
    let present = 0;
    for (const node of source.plan.request.nodes) {
        const state = await callScene('nodeState', { sceneUuid: source.plan.sceneUuid, nodeUuid: node.uuid }, 20000);
        if (state && state.available === true) present += 1;
        else if (state && state.reason === 'SCENE_NODE_NOT_FOUND') absent += 1;
        else { operation.status = 'conflict'; operation.reconcileReason = state && state.reason || 'SCENE_COMPOSE_NODE_STATE_UNAVAILABLE'; }
    }
    const baselineMatches = disk && disk.sceneSha256 === operation.plan.sceneAssetBefore.sceneSha256
        && disk.metaSha256 === operation.plan.sceneAssetBefore.metaSha256;
    const afterMatches = disk && disk.sceneSha256 === operation.plan.sceneAssetAfter.sceneSha256
        && disk.metaSha256 === operation.plan.sceneAssetAfter.metaSha256;
    if (baselineMatches && absent === source.plan.request.nodes.length && !present) {
        operation.status = 'completed';
        operation.diskReadback = { verified: true, sceneUuid: operation.plan.sceneUuid, sceneUrl: disk.url,
            sceneSha256: disk.sceneSha256, metaSha256: disk.metaSha256, verifiedAt: new Date().toISOString() };
        source.compensatedByOperationId = operation.operationId;
        source.compensatedAt = new Date().toISOString();
        source.compensationDiskReadback = operation.diskReadback;
        writeOperation(source);
    } else if (afterMatches && present === source.plan.request.nodes.length && !absent) {
        try {
            const live = await callScene('compositionReadback', source.plan.request, 30000);
            const subtrees = await readSceneComposeSubtrees(source);
            operation.status = composeOperationLiveReadbackMatches(source, live, subtrees) ? 'not-applied' : 'conflict';
        } catch (_) { operation.status = 'conflict'; }
        if (operation.status === 'not-applied' && source.compensationOperationId === operation.operationId) {
            delete source.compensationOperationId;
            delete source.compensationPlanHash;
            delete source.compensationPlannedAt;
            writeOperation(source);
            operation.reservationReleased = true;
        }
    } else if (absent === source.plan.request.nodes.length && !present) {
        operation.status = 'save-required';
        operation.reconcileReason = baselineMatches ? null : 'SCENE_COMPOSE_BASELINE_NOT_PERSISTED';
    } else {
        operation.status = 'conflict';
        operation.reconcileReason = operation.reconcileReason || 'SCENE_COMPOSE_COMPENSATION_STATE_MISMATCH';
    }
    operation.reconciledAt = new Date().toISOString();
    writeOperation(operation);
    return composeCompensationReceipt(operation, { disk: disk && { sceneSha256: disk.sceneSha256 || null,
        metaSha256: disk.metaSha256 || null }, presentNodeCount: present, absentNodeCount: absent });
}

function verifyPlanIdentity(operation, { requireCurrentContract = true } = {}) {
    if (projectRoot() !== operation.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== operation.creatorVersion || !isSupportedCreatorVersion(operation.creatorVersion))
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
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    const approved = await authorizeCommit();
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
    operation.approvalSource = 'commit-tool-call';
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

async function enterPrefabSourceMode(prefabUuid, expectedSceneUuid) {
    const before = await currentPrefabEditMode();
    if (before.modeName !== 'scene' || before.sceneUuid !== expectedSceneUuid) throw coded('EDITOR_BUSY');
    Editor.Ipc.sendToAll('scene:enter-prefab-edit-mode', prefabUuid);
    return waitForPrefabEditMode({ modeName: 'prefab', prefabUuid });
}

async function waitForPrefabEditMode(expected, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    do {
        try {
            const mode = await currentPrefabEditMode();
            if (mode.modeName === expected.modeName
                && (expected.prefabUuid === undefined || mode.prefabUuid === expected.prefabUuid)
                && (expected.sceneUuid === undefined || mode.sceneUuid === expected.sceneUuid)) return mode;
            if (mode.modeName === expected.modeName
                && (mode.modeName === 'scene' || mode.prefabUuid)) throw coded('PREFAB_MODE_TARGET_MISMATCH');
        } catch (error) {
            if (!['SCENE_QUERY_FAILED', 'SCENE_QUERY_TIMEOUT', 'PREFAB_EDIT_MODE_API_UNAVAILABLE'].includes(error.code)) throw error;
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() <= deadline);
    throw coded('PREFAB_MODE_TRANSITION_TIMEOUT');
}

async function exitPrefabSourceMode(prefabUuid, expectedSceneUuid) {
    const before = await currentPrefabEditMode();
    if (before.modeName !== 'prefab' || before.prefabUuid !== prefabUuid) throw coded('PREFAB_EXIT_TARGET_MISMATCH');
    const exit = await callScene('exitPrefabSourceMode', { prefabUuid }, 20000);
    if (!exit || exit.available !== true || exit.prefabUuid !== prefabUuid || exit.exitRequested !== true)
        throw coded(exit && exit.reason || 'PREFAB_EXIT_FAILED');
    return waitForPrefabEditMode({ modeName: 'scene', ...(expectedSceneUuid ? { sceneUuid: expectedSceneUuid } : {}) });
}

async function savePrefabSourceMode(operation) {
    const prefabUuid = operation.plan.prefabUuid;
    const mode = await currentPrefabEditMode();
    if (mode.modeName !== 'prefab' || mode.prefabUuid !== prefabUuid) throw coded('PREFAB_SAVE_TARGET_MISMATCH');
    const emitter = mainProcessIpcEmitter();
    let eventConfirmed = false;
    const onSaved = () => { eventConfirmed = true; };
    if (emitter) emitter.on('scene:saved', onSaved);
    try {
        const result = await callScene('savePrefabSource', { prefabUuid }, 20000);
        if (!result || result.available !== true || result.prefabUuid !== prefabUuid || result.saved !== true)
            throw coded(result && result.reason || 'PREFAB_SAVE_UNVERIFIED');
        const disk = await waitForPrefabSourcePatchDisk(operation);
        const after = await currentPrefabEditMode();
        if (after.modeName !== 'prefab' || after.prefabUuid !== prefabUuid) throw coded('PREFAB_SAVE_TARGET_MISMATCH');
        // Native Prefab save does not promise the generic scene:saved notification.
        // Its callback plus exact source/meta readback are required; report the event honestly.
        return { mode: after, eventConfirmed, disk };
    } finally {
        if (emitter) emitter.removeListener('scene:saved', onSaved);
    }
}

function readEditorEvalOperation(operationId) {
    const filename = operationPath(operationId);
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code === 'ENOENT') throw coded('OPERATION_NOT_FOUND'); throw error; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > OPERATION_FILE_MAX_BYTES)
        throw coded('OPERATION_FILE_UNSAFE');
    const operation = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const plan = operation && operation.plan;
    if (!operation || operation.schemaVersion !== 1 || operation.operationId !== operationId
        || operation.operation !== 'creator.editor.eval' || !plan || typeof plan !== 'object'
        || plan.operation !== operation.operation || plan.operationId !== operationId
        || !['inline', 'file'].includes(plan.mode) || typeof plan.projectRoot !== 'string'
        || typeof plan.creatorVersion !== 'string' || typeof plan.extensionVersion !== 'string'
        || typeof plan.contractFingerprint !== 'string' || typeof plan.creatorInstanceId !== 'string'
        || typeof plan.source !== 'string' || typeof plan.sourceSha256 !== 'string'
        || !plan.input || typeof plan.input !== 'object' || Array.isArray(plan.input)
        || typeof plan.inputSha256 !== 'string' || typeof plan.expiresAt !== 'string'
        || (plan.mode === 'file' && typeof plan.scriptPath !== 'string')
        || (plan.mode === 'inline' && plan.scriptPath !== null)
        || typeof operation.planHash !== 'string'
        || !['planned', 'awaiting-approval', 'cancelled', 'abandoned', 'applying', 'completed',
            'needs-reconciliation'].includes(operation.status)) throw coded('OPERATION_RECORD_INVALID');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    const validated = editorScriptEval.validateEditorScript(plan.source, plan.input);
    if (fileHash(Buffer.from(validated.source, 'utf8')) !== plan.sourceSha256
        || fileHash(Buffer.from(JSON.stringify(validated.input), 'utf8')) !== plan.inputSha256)
        throw coded('OPERATION_SOURCE_HASH_MISMATCH');
    return operation;
}

function verifyEditorEvalIdentity(operation) {
    const plan = operation.plan;
    if (projectRoot() !== plan.projectRoot) throw coded('OPERATION_PROJECT_MISMATCH');
    if (editorVersion() !== plan.creatorVersion || !isSupportedCreatorVersion(plan.creatorVersion))
        throw coded('OPERATION_CREATOR_VERSION_MISMATCH');
    if (plan.creatorInstanceId !== INSTANCE_ID) throw coded('OPERATION_CREATOR_INSTANCE_MISMATCH');
    if (plan.extensionVersion !== extensionPackage.version || plan.contractFingerprint !== CONTRACT_FINGERPRINT)
        throw coded('OPERATION_CONTRACT_MISMATCH');
    if (planFingerprint(plan) !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
}

function editorEvalReceipt(operation) {
    const plan = operation.plan;
    return { operationId: operation.operationId, status: operation.status, mode: plan.mode,
        projectRoot: plan.projectRoot, creatorVersion: plan.creatorVersion, creatorInstanceId: plan.creatorInstanceId,
        scriptPath: plan.scriptPath, sourceBytes: Buffer.byteLength(plan.source, 'utf8'),
        sourceSha256: plan.sourceSha256, inputSha256: plan.inputSha256,
        startedAt: operation.startedAt || null, completedAt: operation.completedAt || null,
        result: operation.status === 'completed' ? operation.result : null,
        errorCode: operation.errorCode || null,
        sideEffectsVerified: false, automaticRetry: false,
        manualReviewRequired: ['applying', 'needs-reconciliation'].includes(operation.status),
        recovery: { automaticRetry: false, reconcileCommand: plan.mode === 'file'
            ? 'creator.editor.eval-file.reconcile' : 'creator.editor.eval.reconcile',
        note: 'This command runs trusted script code inside Creator with Editor API access. Its effects and persistence are not verified; reconciliation never reruns it.' } };
}

async function createEditorEvalPlan(input, mode) {
    const currentRoot = projectRoot();
    const currentVersion = editorVersion();
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH');
    let source;
    let scriptPath = null;
    if (mode === 'inline') source = input.source;
    else {
        scriptPath = input.scriptPath;
        source = readProjectExtensionScript(scriptPath);
    }
    const validated = editorScriptEval.validateEditorScript(source, input.input || {});
    if (projectRoot() !== currentRoot || editorVersion() !== currentVersion) throw coded('CREATOR_IDENTITY_CHANGED');
    const plan = { operationId: uuid(), operation: 'creator.editor.eval', mode,
        projectRoot: currentRoot, creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
        contractFingerprint: CONTRACT_FINGERPRINT, creatorInstanceId: INSTANCE_ID,
        scriptPath, source: validated.source, sourceSha256: fileHash(Buffer.from(validated.source, 'utf8')),
        input: validated.input, inputSha256: fileHash(Buffer.from(JSON.stringify(validated.input), 'utf8')),
        expiresAt: new Date(Date.now() + OPERATION_TTL_MS).toISOString() };
    const operation = { schemaVersion: 1, operationId: plan.operationId, operation: plan.operation,
        plan, planHash: planFingerprint(plan), status: 'planned', createdAt: new Date().toISOString(),
        plannedByInstanceId: INSTANCE_ID };
    writeOperation(operation);
    return { ...editorEvalReceipt(operation), planHash: operation.planHash, expiresAt: plan.expiresAt,
        sourcePreview: plan.source, input: plan.input, recovery: { automaticRetry: false,
            reconcileCommand: mode === 'file' ? 'creator.editor.eval-file.reconcile' : 'creator.editor.eval.reconcile',
            note: 'The exact script and JSON input are frozen into this plan. Review both before approving.' } };
}


async function commitEditorEval(input, context, requestedMode) {
    const operation = readEditorEvalOperation(input.operationId);
    verifyEditorEvalIdentity(operation);
    const plan = operation.plan;
    if (requestedMode && plan.mode !== requestedMode) throw coded('OPERATION_MODE_MISMATCH');
    if (input.planHash !== operation.planHash) throw coded('OPERATION_PLAN_HASH_MISMATCH');
    if (operation.status !== 'planned') throw coded(['applying', 'awaiting-approval', 'needs-reconciliation'].includes(operation.status)
        ? 'OPERATION_RECONCILIATION_REQUIRED' : 'OPERATION_NOT_COMMITTABLE');
    if (Date.now() > Date.parse(plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
    if (plan.mode === 'file') {
        const source = readProjectExtensionScript(plan.scriptPath);
        if (fileHash(Buffer.from(source, 'utf8')) !== plan.sourceSha256 || source !== plan.source)
            throw coded('EDITOR_SCRIPT_SOURCE_CHANGED');
    }
    operation.status = 'applying';
    operation.approvalRequestedAt = new Date().toISOString();
    writeOperation(operation);
    let approved;
    try { approved = await authorizeCommit(); }
    catch (error) {
        operation.status = 'abandoned';
        operation.abandonedAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
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
    try {
        verifyEditorEvalIdentity(operation);
        if (Date.now() > Date.parse(plan.expiresAt)) throw coded('OPERATION_PLAN_EXPIRED');
        if (plan.mode === 'file') {
            const source = readProjectExtensionScript(plan.scriptPath);
            if (fileHash(Buffer.from(source, 'utf8')) !== plan.sourceSha256 || source !== plan.source)
                throw coded('EDITOR_SCRIPT_SOURCE_CHANGED');
        }
    } catch (error) {
        operation.status = 'abandoned';
        operation.abandonedAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
    operation.status = 'applying';
    operation.startedAt = new Date().toISOString();
    operation.approvedAt = operation.startedAt;
    operation.approvalSource = 'commit-tool-call';
    operation.appliedByInstanceId = INSTANCE_ID;
    writeOperation(operation);
    try {
        const outcome = await editorScriptEval.runEditorScript({ source: plan.source, input: plan.input, editor: Editor });
        operation.status = 'completed';
        operation.result = outcome.result;
        operation.resultBytes = outcome.resultBytes;
        operation.completedAt = new Date().toISOString();
        operation.completedByInstanceId = INSTANCE_ID;
        writeOperation(operation);
        return editorEvalReceipt(operation);
    } catch (error) {
        operation.status = 'needs-reconciliation';
        operation.errorCode = error.code || 'EDITOR_SCRIPT_EXECUTION_FAILED';
        operation.failedAt = new Date().toISOString();
        writeOperation(operation);
        throw error;
    }
}

function reconcileEditorEval(input, requestedMode) {
    const operation = readEditorEvalOperation(input.operationId);
    if (requestedMode && operation.plan.mode !== requestedMode) throw coded('OPERATION_MODE_MISMATCH');
    return editorEvalReceipt(operation);
}

function capabilityList() {
    const ready = {
        'creator.extension.commands.list': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Ipc && typeof Editor.Ipc.sendToMain === 'function'),
        'creator.extension.command.invoke.read': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Ipc && typeof Editor.Ipc.sendToMain === 'function'),
        'creator.extension.command.invoke.plan': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Ipc && typeof Editor.Ipc.sendToMain === 'function'),
        'creator.extension.command.invoke.write': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Ipc && typeof Editor.Ipc.sendToMain === 'function'),
        'creator.extension.command.invoke.control': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Ipc && typeof Editor.Ipc.sendToMain === 'function'),
        'creator.project.info': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.project.search': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.asset.search': !!(Editor && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.references': !!(Editor && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.import.plan': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.exists === 'function' && typeof Editor.assetdb.import === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.import.commit': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.exists === 'function' && typeof Editor.assetdb.import === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.import.reconcile': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.move.plan': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.move === 'function' && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.move.commit': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.move === 'function' && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.move.reconcile': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.delete.plan': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function' && typeof Editor.assetdb.delete === 'function'
            && typeof Editor.assetdb.isSubAsset === 'function'
            && typeof Editor.assetdb.containsSubAssets === 'function'),
        'creator.asset.delete.commit': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function' && typeof Editor.assetdb.delete === 'function'
            && typeof Editor.assetdb.isSubAsset === 'function'
            && typeof Editor.assetdb.containsSubAssets === 'function'),
        'creator.asset.delete.reconcile': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.asset.import-settings.plan': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function' && typeof Editor.assetdb.isSubAsset === 'function'),
        'creator.asset.import-settings.commit': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function' && typeof Editor.assetdb.isSubAsset === 'function'
            && typeof Editor.assetdb.saveMeta === 'function'),
        'creator.asset.import-settings.reconcile': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function' && typeof Editor.assetdb.isSubAsset === 'function'),
        'creator.prefab.create.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function' && Editor.assetdb
            && typeof Editor.assetdb.exists === 'function' && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.create.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function' && Editor.assetdb
            && typeof Editor.assetdb.exists === 'function' && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.create.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.source.inspect': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.source.editable.inspect': prefabEditModeApiAvailable && !!(Editor && Editor.Project
            && Editor.Project.path && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToAll === 'function' && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.instance.inspect': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.instance.override.plan': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.instance.override.commit': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.instance.override.reconcile': !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.source.patch.plan': prefabEditModeApiAvailable && !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function' && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.source.patch.commit': prefabEditModeApiAvailable && !!(Editor && Editor.Project && Editor.Project.path
            && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function' && Editor.Ipc
            && typeof Editor.Ipc.sendToAll === 'function' && !!mainProcessIpcEmitter()
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.prefab.source.patch.reconcile': !!(Editor && Editor.Project && Editor.Project.path && Editor.assetdb
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.editor.eval.plan': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.editor.eval.commit': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.editor.eval.reconcile': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.editor.eval-file.plan': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.editor.eval-file.commit': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.editor.eval-file.reconcile': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.script.read': !!(Editor && Editor.Project && Editor.Project.path),
        'creator.scene.snapshot': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.read': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.ui.inspect': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.rename.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.rename.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.rename.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.delete.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.delete.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.delete.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.remove-component.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.remove-component.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.remove-component.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.reparent.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.reparent.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.reparent.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.compose.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.scene.compose.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.compose.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.compose.compensate.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.scene.compose.compensate.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.compose.compensate.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-active.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-active.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.set-active.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-transform.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-transform.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.set-transform.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.button-events.set.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.button-events.set.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.button-events.set.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.ui-events.set.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.ui-events.set.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.ui-events.set.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.ui-events.set.compensate.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.ui-events.set.compensate.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.ui-events.set.compensate.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.add-component.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.add-component.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.add-component.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-component-property.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-component-property.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.set-component-property.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-component-property.compensate.plan': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.scene.node.set-component-property.compensate.commit': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
        'creator.scene.node.set-component-property.compensate.reconcile': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.script.create.plan': !!(Editor && Editor.assetdb && typeof Editor.assetdb.exists === 'function'
            && typeof Editor.assetdb.create === 'function'),
        'creator.script.create.commit': !!(Editor && Editor.assetdb && typeof Editor.assetdb.exists === 'function'
            && typeof Editor.assetdb.create === 'function' && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.create.reconcile': !!(Editor && Editor.assetdb && typeof Editor.assetdb.exists === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.modify.plan': !!(Editor && Editor.assetdb && typeof Editor.assetdb.saveExists === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.modify.commit': !!(Editor && Editor.assetdb && typeof Editor.assetdb.saveExists === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.modify.reconcile': !!(Editor && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.recompile.plan': !!(Editor && Editor.assetdb && typeof Editor.assetdb.refresh === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.script.recompile.commit': !!(Editor && Editor.assetdb && typeof Editor.assetdb.refresh === 'function'
            && typeof Editor.assetdb.queryAssets === 'function'
            && diagnosticListeners.some((item) => item.eventName === 'asset-db:script-import-failed')),
        'creator.script.recompile.reconcile': !!(Editor && Editor.assetdb && typeof Editor.assetdb.queryAssets === 'function'),
        'creator.diagnostics.read': !!(Editor && ((Editor.Builder && typeof Editor.Builder.on === 'function')
            || (Editor.Ipc && typeof Editor.Ipc.on === 'function'))),
        'creator.diagnostics.snapshot': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'),
        'creator.preview.start': !!(Editor && Editor.Scene && typeof Editor.Scene.callSceneScript === 'function'
            && Editor.Ipc && typeof Editor.Ipc.sendToPanel === 'function'),
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
    if (!isSupportedCreatorVersion(currentVersion)) throw coded('CREATOR_VERSION_MISMATCH', `Expected ${EXPECTED_CREATOR_VERSION}; detected ${currentVersion || 'unknown'}.`);
    return callScene('snapshot', { maxNodes: 1 }).catch(() => ({ sceneName: null, sceneUuid: null }))
        .then((scene) => { lastSceneName = scene.sceneName || null; return ({ projectRoot: root, projectName: typeof metadata.name === 'string' ? metadata.name : path.basename(root),
            creatorVersion: currentVersion, extensionVersion: extensionPackage.version,
            activeScene: scene.sceneName || null, activeSceneUuid: scene.sceneUuid || null,
            editorRuntime: { node: process.versions.node, electron: process.versions.electron || null } }); });
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

function queryAssetByUuid(assetUuid) {
    if (!Editor.assetdb || typeof Editor.assetdb.queryAssets !== 'function') throw coded('ASSETDB_QUERY_UNAVAILABLE');
    return new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(coded('ASSETDB_QUERY_TIMEOUT'));
        }, 20000);
        try {
            Editor.assetdb.queryAssets('db://assets/**/*', null, (error, rows) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (error) { reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error))); return; }
                if (!Array.isArray(rows)) { reject(coded('ASSETDB_RESULT_INVALID')); return; }
                resolve(rows.find((row) => row && row.uuid === assetUuid && typeof row.url === 'string'
                    && row.url.startsWith('db://assets/')) || null);
            });
        } catch (error) {
            clearTimeout(timeout);
            reject(coded('ASSETDB_QUERY_FAILED', String(error.message || error)));
        }
    });
}

async function readAssetReferences(input) {
    const asset = await queryAssetByUuid(input.assetUuid);
    if (!asset) throw coded('ASSET_UUID_NOT_FOUND');
    const root = projectRoot();
    const ignoredPaths = [];
    if (asset.isSubAsset !== true && typeof asset.url === 'string' && asset.url.startsWith('db://assets/')) {
        const relativePath = asset.url.slice('db://assets/'.length);
        try {
            assetTargetPaths(relativePath);
            ignoredPaths.push(relativePath, `${relativePath}.meta`);
        } catch (_) {}
    }
    const references = scanAssetReferences(path.join(root, 'assets'), input.assetUuid, { ignorePaths: ignoredPaths });
    return { projectRoot: root, creatorVersion: editorVersion(), asset: {
        assetUuid: asset.uuid, url: asset.url, type: typeof asset.type === 'string' ? asset.type : null,
        importer: typeof asset.importer === 'string' ? asset.importer : null,
        isSubAsset: asset.isSubAsset === true,
    }, ...references,
    evidence: { method: 'bounded-text-reference-scan', binaryFilesSkipped: true,
        complete: references.complete, note: references.complete
            ? 'Text files under assets/ were scanned within the reported limits; binary file formats were skipped.'
            : 'The scan reached a symlink, unreadable file, size/file limit, or result cap. Absence of a result does not prove that the asset has no references.' } };
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

function safeExtensionEntry(packageDirectory, relativePath) {
    if (typeof relativePath !== 'string' || !relativePath || relativePath.includes('\\') || path.isAbsolute(relativePath))
        throw coded('EXTENSION_PROVIDER_ENTRY_INVALID');
    const segments = relativePath.split('/');
    if (segments.some((item) => !item || item === '.' || item === '..')) throw coded('EXTENSION_PROVIDER_ENTRY_INVALID');
    let cursor = packageDirectory;
    for (const segment of segments) {
        cursor = path.join(cursor, segment);
        const stat = fs.lstatSync(cursor);
        if (stat.isSymbolicLink()) throw coded('EXTENSION_PROVIDER_ENTRY_UNSAFE');
    }
    const real = fs.realpathSync(cursor);
    if (!real.startsWith(`${packageDirectory}${path.sep}`) || !fs.statSync(real).isFile())
        throw coded('EXTENSION_PROVIDER_ENTRY_UNSAFE');
    return real;
}

function providerCandidates() {
    const root = projectRoot();
    const candidates = [];
    const skipped = [];
    for (const baseName of ['packages', 'extensions']) {
        const base = path.join(root, baseName);
        let baseStat;
        try { baseStat = fs.lstatSync(base); }
        catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        if (!baseStat.isDirectory() || baseStat.isSymbolicLink()) throw coded('EXTENSION_PROVIDER_DIRECTORY_UNSAFE');
        const names = fs.readdirSync(base).sort();
        if (names.length > 512) throw coded('EXTENSION_PROVIDER_DIRECTORY_TOO_LARGE');
        for (const name of names) {
            if (candidates.length >= MAX_PROVIDER_PACKAGES) break;
            const directory = path.join(base, name);
            let directoryStat;
            try { directoryStat = fs.lstatSync(directory); } catch (_) { continue; }
            if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) continue;
            const manifestPath = path.join(directory, 'package.json');
            let manifestStat;
            try { manifestStat = fs.lstatSync(manifestPath); }
            catch (error) { if (error.code === 'ENOENT') continue; skipped.push({ package: name, code: 'EXTENSION_PROVIDER_MANIFEST_UNREADABLE' }); continue; }
            if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 64 * 1024) {
                skipped.push({ package: name, code: 'EXTENSION_PROVIDER_MANIFEST_UNSAFE' });
                continue;
            }
            let manifest;
            try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
            catch (_) { skipped.push({ package: name, code: 'EXTENSION_PROVIDER_MANIFEST_INVALID' }); continue; }
            const metadata = manifest && manifest['cocos-creator-agent'];
            if (!metadata || !Array.isArray(metadata.commands)) continue;
            let entry;
            try { entry = safeExtensionEntry(directory, manifest.main || 'main.js'); }
            catch (error) { skipped.push({ package: name, code: error.code || 'EXTENSION_PROVIDER_ENTRY_INVALID' }); continue; }
            try {
                const provider = normalizeProvider(manifest.name, metadata);
                candidates.push({ ...provider, directory, manifestPath, entry, metadata });
            } catch (error) { skipped.push({ package: name, code: error.code || 'EXTENSION_PROVIDER_METADATA_INVALID' }); }
        }
    }
    return { candidates, skipped };
}

function extensionIpcRequest(message, payload, timeoutMs = PROVIDER_IPC_TIMEOUT_MS) {
    if (!Editor.Ipc || typeof Editor.Ipc.sendToMain !== 'function') return Promise.reject(coded('CREATOR_IPC_UNAVAILABLE'));
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error, result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(coded('EXTENSION_PROVIDER_IPC_FAILED', String(error.code || error.message || error)));
            else resolve(result);
        };
        const timer = setTimeout(() => finish(coded('EXTENSION_PROVIDER_IPC_TIMEOUT')), timeoutMs + 100);
        try {
            Editor.Ipc.sendToMain(message, payload, (...args) => {
                if (args.length > 1) finish(args[0], args[1]);
                else if (args[0] instanceof Error || args[0] && typeof args[0].code === 'string') finish(args[0]);
                else finish(null, args[0]);
            }, timeoutMs);
        } catch (error) { finish(error); }
    });
}

function providerDescriptorMatches(first, second) {
    return canonical(first) === canonical(second);
}

async function discoverExtensionCommands() {
    const { candidates, skipped } = providerCandidates();
    const byId = new Map();
    for (const candidate of candidates) {
        if (byId.has(candidate.providerId)) { byId.set(candidate.providerId, null); skipped.push({ package: candidate.providerId, code: 'EXTENSION_PROVIDER_ID_AMBIGUOUS' }); }
        else byId.set(candidate.providerId, candidate);
    }
    const providers = [];
    const commands = [];
    for (const candidate of byId.values()) {
        if (!candidate) continue;
        const challenge = uuid();
        try {
            const response = await extensionIpcRequest(`${candidate.providerId}:cocosAgentDescribe`, {
                protocolVersion: '1', challenge,
            });
            if (!response || response.providerId !== candidate.providerId || response.protocolVersion !== '1'
                || response.challenge !== challenge || !Array.isArray(response.commands))
                throw coded('EXTENSION_PROVIDER_HANDSHAKE_MISMATCH');
            const live = normalizeProvider(candidate.providerId, {
                creatorVersion: EXPECTED_CREATOR_VERSION, protocolVersion: '1', commands: response.commands,
            });
            if (!providerDescriptorMatches(live.commands, candidate.commands)) throw coded('EXTENSION_PROVIDER_CONTRACT_MISMATCH');
            const provider = { providerId: candidate.providerId, providerFingerprint: candidate.providerFingerprint,
                title: candidate.providerId, commands: live.commands.map((command) => ({ ...command,
                    providerId: candidate.providerId, providerFingerprint: candidate.providerFingerprint, status: 'available' })) };
            providers.push(provider);
            commands.push(...provider.commands);
        } catch (error) {
            skipped.push({ package: candidate.providerId, code: error.code || 'EXTENSION_PROVIDER_UNAVAILABLE' });
        }
    }
    if (commands.length > MAX_PROVIDER_COMMANDS) throw coded('EXTENSION_PROVIDER_COMMAND_LIMIT_EXCEEDED');
    return { projectRoot: projectRoot(), creatorVersion: editorVersion(), providers, commands,
        skipped: skipped.slice(0, MAX_PROVIDER_PACKAGES) };
}

function redactProviderArguments(value) {
    const safe = {};
    for (const [key, child] of Object.entries(value)) {
        safe[key] = /token|secret|password|authorization|credential|api.?key/i.test(key)
            ? '[redacted]' : child;
    }
    return JSON.stringify(safe, null, 2).slice(0, 6000);
}


async function invokeExtensionCommand(input, context, requiredAccess) {
    if (input.providerFingerprint !== input.providerFingerprint.toLowerCase()) throw coded('EXTENSION_PROVIDER_FINGERPRINT_INVALID');
    let args;
    try { args = JSON.parse(input.argumentsJson); } catch (_) { throw coded('EXTENSION_COMMAND_INPUT_INVALID'); }
    const liveCatalog = await discoverExtensionCommands();
    const provider = liveCatalog.providers.find((item) => item.providerId === input.providerId);
    const command = provider && provider.commands.find((item) => item.id === input.commandId);
    if (!provider || !command || provider.providerFingerprint !== input.providerFingerprint) throw coded('EXTENSION_PROVIDER_CHANGED');
    if (command.access !== requiredAccess) throw coded('EXTENSION_COMMAND_ACCESS_MISMATCH');
    validateArguments(command.input, args);
    if (command.approval) {
        const approved = await authorizeCommit();
        if (!approved) throw coded('EXTENSION_COMMAND_NOT_APPROVED');
        try { await authorizeWriteRequest(context && context.requestId); }
        catch (error) { throw coded('EXTENSION_COMMAND_REQUEST_NO_LONGER_ACTIVE', String(error.code || error.message || error)); }
    }
    const freshCatalog = await discoverExtensionCommands();
    const freshProvider = freshCatalog.providers.find((item) => item.providerId === input.providerId);
    const freshCommand = freshProvider && freshProvider.commands.find((item) => item.id === input.commandId);
    if (!freshProvider || freshProvider.providerFingerprint !== provider.providerFingerprint
        || !freshCommand || !providerDescriptorMatches(freshCommand, command)) throw coded('EXTENSION_PROVIDER_CHANGED');
    validateArguments(freshCommand.input, args);
    const returned = await extensionIpcRequest(`${input.providerId}:cocosAgentInvoke`, {
        protocolVersion: '1', providerFingerprint: input.providerFingerprint, commandId: input.commandId, arguments: args,
    }, 30000);
    let resultBytes;
    try { resultBytes = Buffer.from(JSON.stringify(returned)); } catch (_) { throw coded('EXTENSION_COMMAND_RESULT_INVALID'); }
    if (!resultBytes || resultBytes.length > 256 * 1024) throw coded('EXTENSION_COMMAND_RESULT_TOO_LARGE');
    if (returned && typeof returned === 'object' && returned.commandId !== input.commandId)
        throw coded('EXTENSION_COMMAND_RESULT_ID_MISMATCH');
    return { projectRoot: projectRoot(), creatorVersion: editorVersion(), providerId: provider.providerId,
        providerFingerprint: provider.providerFingerprint, commandId: command.id, access: command.access,
        approvalSource: command.approval ? 'commit-tool-call' : null,
        recovery: command.approval ? { automaticRetry: false, requiresManualReviewOnInterruption: true } : null,
        result: returned && typeof returned === 'object' && Object.prototype.hasOwnProperty.call(returned, 'result') ? returned.result : returned };
}

function execute(command, input, context) {
    if (command === 'creator.extension.commands.list') return discoverExtensionCommands();
    if (command === 'creator.extension.command.invoke.read') return invokeExtensionCommand(input, context, 'read');
    if (command === 'creator.extension.command.invoke.plan') return invokeExtensionCommand(input, context, 'plan');
    if (command === 'creator.extension.command.invoke.write') return invokeExtensionCommand(input, context, 'write');
    if (command === 'creator.extension.command.invoke.control') return invokeExtensionCommand(input, context, 'control');
    if (command === 'creator.project.info') return projectInfo();
    if (command === 'creator.project.search') return Promise.resolve(searchProject(input));
    if (command === 'creator.asset.search') return searchAssets(input);
    if (command === 'creator.asset.references') return readAssetReferences(input);
    if (command === 'creator.asset.import.plan') return createAssetImportPlan(input);
    if (command === 'creator.asset.import.commit') return commitAssetImport(input, context);
    if (command === 'creator.asset.import.reconcile') return reconcileAssetImport(input);
    if (command === 'creator.asset.move.plan') return createAssetMovePlan(input);
    if (command === 'creator.asset.move.commit') return commitAssetMove(input, context);
    if (command === 'creator.asset.move.reconcile') return reconcileAssetMove(input);
    if (command === 'creator.asset.delete.plan') return createAssetDeletePlan(input);
    if (command === 'creator.asset.delete.commit') return commitAssetDelete(input, context);
    if (command === 'creator.asset.delete.reconcile') return reconcileAssetDelete(input);
    if (command === 'creator.asset.import-settings.plan') return createTextureImportSettingsPlan(input);
    if (command === 'creator.asset.import-settings.commit') return commitTextureImportSettings(input, context);
    if (command === 'creator.asset.import-settings.reconcile') return reconcileTextureImportSettings(input);
    if (command === 'creator.prefab.create.plan') return createPrefabPlan(input);
    if (command === 'creator.prefab.create.commit') return commitPrefabCreate(input, context);
    if (command === 'creator.prefab.create.reconcile') return reconcilePrefabCreate(input);
    if (command === 'creator.prefab.source.inspect') return inspectPrefabSourceCommand(input, { allowAmbiguousPaths: true });
    if (command === 'creator.prefab.source.editable.inspect') return inspectPrefabEditableCommand(input);
    if (command === 'creator.prefab.instance.inspect') return inspectPrefabInstanceCommand(input);
    if (command === 'creator.prefab.instance.override.plan') return createPrefabInstanceOverridePlan(input);
    if (command === 'creator.prefab.instance.override.commit') return commitPrefabInstanceOverride(input, context);
    if (command === 'creator.prefab.instance.override.reconcile') return reconcilePrefabInstanceOverride(input);
    if (command === 'creator.prefab.source.patch.plan') return createPrefabSourcePatchPlan(input);
    if (command === 'creator.prefab.source.patch.commit') return commitPrefabSourcePatch(input, context);
    if (command === 'creator.prefab.source.patch.reconcile') return reconcilePrefabSourcePatch(input);
    if (command === 'creator.editor.eval.plan') return createEditorEvalPlan(input, 'inline');
    if (command === 'creator.editor.eval.commit') return commitEditorEval(input, context, 'inline');
    if (command === 'creator.editor.eval.reconcile') return reconcileEditorEval(input, 'inline');
    if (command === 'creator.editor.eval-file.plan') return createEditorEvalPlan(input, 'file');
    if (command === 'creator.editor.eval-file.commit') return commitEditorEval(input, context, 'file');
    if (command === 'creator.editor.eval-file.reconcile') return reconcileEditorEval(input, 'file');
    if (command === 'creator.script.read') return Promise.resolve(readScript(input));
    if (command === 'creator.scene.snapshot') return callScene('snapshot', { maxNodes: 100 });
    if (command === 'creator.scene.node.read') return callScene('nodeState', { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (command === 'creator.scene.ui.inspect') return callScene('uiComponentState',
        { sceneUuid: input.sceneUuid, nodeUuid: input.nodeUuid }, 20000);
    if (command === 'creator.scene.node.rename.plan') return createSceneNodeRenamePlan(input);
    if (command === 'creator.scene.node.rename.commit') return commitSceneNodeRename(input, context);
    if (command === 'creator.scene.node.rename.reconcile') return reconcileSceneNodeRename(input);
    if (command === 'creator.scene.node.delete.plan') return createSceneNodeDeletePlan(input);
    if (command === 'creator.scene.node.delete.commit') return commitSceneDestructiveOperation(readSceneNodeDeleteOperation(input.operationId), input, context);
    if (command === 'creator.scene.node.delete.reconcile') return reconcileSceneDestructiveOperation(readSceneNodeDeleteOperation(input.operationId));
    if (command === 'creator.scene.node.remove-component.plan') return createSceneComponentRemovePlan(input);
    if (command === 'creator.scene.node.remove-component.commit') return commitSceneDestructiveOperation(readSceneComponentRemoveOperation(input.operationId), input, context);
    if (command === 'creator.scene.node.remove-component.reconcile') return reconcileSceneDestructiveOperation(readSceneComponentRemoveOperation(input.operationId));
    if (command === 'creator.scene.node.reparent.plan') return createSceneNodeReparentPlan(input);
    if (command === 'creator.scene.node.reparent.commit') return commitSceneNodeReparent(input, context);
    if (command === 'creator.scene.node.reparent.reconcile') return reconcileSceneNodeReparent(input);
    if (command === 'creator.scene.compose.plan') return createSceneComposePlan(input);
    if (command === 'creator.scene.compose.commit') return commitSceneCompose(input, context);
    if (command === 'creator.scene.compose.reconcile') return reconcileSceneCompose(input);
    if (command === 'creator.scene.compose.compensate.plan') return createSceneComposeCompensationPlan(input);
    if (command === 'creator.scene.compose.compensate.commit') return commitSceneComposeCompensation(input, context);
    if (command === 'creator.scene.compose.compensate.reconcile') return reconcileSceneComposeCompensation(input);
    if (command === 'creator.scene.node.set-active.plan') return createSceneNodeActivePlan(input);
    if (command === 'creator.scene.node.set-active.commit') return commitSceneNodeActive(input, context);
    if (command === 'creator.scene.node.set-active.reconcile') return reconcileSceneNodeActive(input);
    if (command === 'creator.scene.node.set-transform.plan') return createSceneNodeTransformPlan(input);
    if (command === 'creator.scene.node.set-transform.commit') return commitSceneNodeTransform(input, context);
    if (command === 'creator.scene.node.set-transform.reconcile') return reconcileSceneNodeTransform(input);
    if (command === 'creator.scene.button-events.set.plan') return createSceneButtonEventsPlan(input);
    if (command === 'creator.scene.button-events.set.commit') return commitSceneButtonEvents(input, context);
    if (command === 'creator.scene.button-events.set.reconcile') return reconcileSceneButtonEvents(input);
    if (command === 'creator.scene.ui-events.set.plan') return createSceneUiEventsPlan(input);
    if (command === 'creator.scene.ui-events.set.commit') return commitSceneUiEvents(input, context);
    if (command === 'creator.scene.ui-events.set.reconcile') return reconcileSceneUiEvents(input);
    if (command === 'creator.scene.ui-events.set.compensate.plan') return createSceneUiEventsCompensationPlan(input);
    if (command === 'creator.scene.ui-events.set.compensate.commit') return commitSceneUiEvents(input, context);
    if (command === 'creator.scene.ui-events.set.compensate.reconcile') return reconcileSceneUiEvents(input);
    if (command === 'creator.scene.node.add-component.plan') return createSceneComponentAddPlan(input);
    if (command === 'creator.scene.node.add-component.commit') return commitSceneComponentAdd(input, context);
    if (command === 'creator.scene.node.add-component.reconcile') return reconcileSceneComponentAdd(input);
    if (command === 'creator.scene.node.set-component-property.plan') return createSceneComponentPropertyPlan(input);
    if (command === 'creator.scene.node.set-component-property.commit') return commitSceneComponentProperty(input, context);
    if (command === 'creator.scene.node.set-component-property.reconcile') return reconcileSceneComponentProperty(input);
    if (command === 'creator.scene.node.set-component-property.compensate.plan') return createSceneComponentPropertyCompensationPlan(input);
    if (command === 'creator.scene.node.set-component-property.compensate.commit') return commitSceneComponentProperty(input, context);
    if (command === 'creator.scene.node.set-component-property.compensate.reconcile') return reconcileSceneComponentProperty(input);
    if (command === 'creator.script.create.plan') return Promise.resolve(createScriptPlan(input));
    if (command === 'creator.script.create.commit') return commitScriptCreate(input, context);
    if (command === 'creator.script.create.reconcile') return Promise.resolve(reconcileScriptCreate(input));
    if (command === 'creator.script.modify.plan') return createScriptModifyPlan(input);
    if (command === 'creator.script.modify.commit') return commitScriptModify(input, context);
    if (command === 'creator.script.modify.reconcile') return reconcileScriptModify(input);
    if (command === 'creator.script.recompile.plan') return createScriptRecompilePlan(input);
    if (command === 'creator.script.recompile.commit') return commitScriptRecompile(input, context);
    if (command === 'creator.script.recompile.reconcile') return reconcileScriptRecompile(input);
    if (command === 'creator.diagnostics.read') return Promise.resolve(readDiagnostics(input));
    if (command === 'creator.diagnostics.snapshot') return readDomainDiagnosticsSnapshot(input);
    if (command === 'creator.preview.start') return startPreview(input, context);
    if (command.startsWith('creator.preview.') || command === 'creator.diagnostics.runtime') throw coded('BRIDGE_OWNED_COMMAND');
    throw coded('UNKNOWN_COMMAND');
}

function pollLoop() {
    if (stopped || timer) return;
    timer = setTimeout(async () => {
        timer = null;
        try {
            const version = editorVersion();
            if (!isSupportedCreatorVersion(version)) throw coded('CREATOR_VERSION_MISMATCH', `Expected ${EXPECTED_CREATOR_VERSION}; detected ${version || 'unknown'}.`);
            const root = projectRoot();
            const state = readBridgeState();
            if (!state) { bridgeSession = null; pollLoop(); return; }
            if (!bridgeSession || bridgeSession.bridgeId !== state.bridgeId || bridgeSession.projectRoot !== root) {
                const registration = await requestJson(state, 'POST', '/v1/creator/register', {
                    instanceId: INSTANCE_ID, projectRoot: root, creatorVersion: version,
                    extensionVersion: extensionPackage.version, contractFingerprint: CONTRACT_FINGERPRINT,
                    processId: process.pid,
                    capabilities: capabilityList(), activeScene: lastSceneName,
                }, 8000);
                bridgeSession = { bridgeId: state.bridgeId, sessionId: registration.sessionId, projectRoot: root };
                console.info(`[Cocos Creator Agent] Connected to local bridge for ${path.basename(root)} (${version}).`);
            }
            const result = await requestJson(state, 'POST', '/v1/creator/poll', {
                instanceId: INSTANCE_ID, sessionId: bridgeSession.sessionId, activeScene: lastSceneName,
                capabilities: capabilityList(),
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
        prefabEditModeApiAvailable = false;
        setupDiagnosticListeners();
        refreshPrefabEditModeCapability();
        pollLoop();
    },
    unload() {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
        if (activeRequest) activeRequest.destroy(coded('EXTENSION_UNLOADED'));
        activeRequest = null;
        removeDiagnosticListeners();
        prefabEditModeApiAvailable = false;
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
