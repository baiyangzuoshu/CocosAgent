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
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_FILES = 12000;
const MAX_CODE_SCAN_BYTES = 32 * 1024 * 1024;
const MAX_SCRIPT_BYTES = 128 * 1024;
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
    };
    return contract.commands.map((command) => {
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

function execute(command, input) {
    if (command === 'creator.project.info') return projectInfo();
    if (command === 'creator.project.search') return Promise.resolve(searchProject(input));
    if (command === 'creator.asset.search') return searchAssets(input);
    if (command === 'creator.script.read') return Promise.resolve(readScript(input));
    if (command === 'creator.scene.snapshot') return callScene('snapshot', { maxNodes: 100 });
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
                    const output = await execute(result.command, result.input || {});
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
        pollLoop();
    },
    unload() {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
        if (activeRequest) activeRequest.destroy(coded('EXTENSION_UNLOADED'));
        activeRequest = null;
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
