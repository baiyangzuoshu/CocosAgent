'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const WebSocket = require('./vendor/ws');
const catalogSchema = require('./catalog.schema.json');

const args = process.argv.slice(2);
const values = (flag) => args.flatMap((value, index) => value === flag ? [args[index + 1]] : []);
const one = (flag) => values(flag)[0];
const query = one('--query') || 'instances.list';
const selectedProject = one('--project') && path.resolve(one('--project'));
const selectedVersion = one('--creator-version');
const supported = new Set(['2.4.15', '3.8.7']);
const targetArgs = values('--target');

function output(success, data, error) {
    process.stdout.write(`${JSON.stringify(success ? { success, data } : { success, error })}\n`);
    process.exitCode = success ? 0 : 1;
}

if (!targetArgs.length || !['instances.list', 'instances.get', 'capabilities.list'].includes(query)) {
    output(false, null, { code: 'INVALID_ARGUMENT', message: 'Use --target <creatorVersion>=<projectPath> (repeatable) and --query instances.list|instances.get|capabilities.list.' });
    return;
}
if (query !== 'instances.list' && !selectedProject) {
    output(false, null, { code: 'PROJECT_REQUIRED', message: '--project is required for this query.' });
    return;
}
if (values('--project').length > 1 || values('--creator-version').length > 1
    || (selectedVersion && !supported.has(selectedVersion))) {
    output(false, null, { code: 'INVALID_ARGUMENT', message: 'Use at most one --project and a supported --creator-version.' });
    return;
}
if (query === 'instances.list' && (selectedProject || selectedVersion)) {
    output(false, null, { code: 'INVALID_ARGUMENT', message: 'instances.list does not accept --project or --creator-version.' });
    return;
}

const targets = [];
const seen = new Set();
for (const arg of targetArgs) {
    const index = arg.indexOf('=');
    const creatorVersion = arg.slice(0, index);
    const projectRoot = path.resolve(arg.slice(index + 1));
    if (index < 0 || !supported.has(creatorVersion) || !fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
        output(false, null, { code: 'INVALID_TARGET', message: `Invalid Creator target: ${arg}` });
        return;
    }
    if (seen.has(projectRoot)) {
        output(false, null, { code: 'AMBIGUOUS_EDITOR', message: `Project is listed more than once: ${projectRoot}` });
        return;
    }
    seen.add(projectRoot);
    targets.push({ creatorVersion, projectRoot, instanceId: null, state: 'disconnected', activeScene: null, catalogRevision: null, commands: [], error: null,
        sessionId: crypto.randomUUID(), token: crypto.randomBytes(32).toString('hex'), socket: null, requestId: null, nonce: null });
}
if (query !== 'instances.list') {
    const matches = targets.filter((target) => target.projectRoot === selectedProject);
    if (!matches.length) {
        output(false, null, { code: 'EDITOR_NOT_FOUND', message: `No target for project: ${selectedProject}` });
        return;
    }
    if (matches.length > 1) {
        output(false, null, { code: 'AMBIGUOUS_EDITOR', message: `More than one target for project: ${selectedProject}` });
        return;
    }
    if (selectedVersion && matches[0].creatorVersion !== selectedVersion) {
        output(false, null, { code: 'CREATOR_VERSION_MISMATCH', message: `Expected Creator ${selectedVersion}, target is ${matches[0].creatorVersion}.` });
        return;
    }
}

const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
const wss = new WebSocket.Server({
    server, path: '/cocos-agent-bridge', maxPayload: 16 * 1024,
    verifyClient: (info, done) => done(targets.some((target) => {
        const candidate = info.req.headers['x-cocos-agent-token'];
        const expected = Buffer.from(target.token);
        const actual = Buffer.from(typeof candidate === 'string' ? candidate : '');
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    })),
});
let timer;
let finished = false;

function sessionPath(target) { return path.join(target.projectRoot, 'temp', 'cocos-agent-bridge', 'session.json'); }
function publicInstance(target) {
    return { instanceId: target.instanceId, projectRoot: target.projectRoot, creatorVersion: target.creatorVersion,
        extensionVersion: target.extensionVersion || null, state: target.state,
        activeScene: target.activeScene, catalogRevision: target.catalogRevision, error: target.error };
}
function cleanup() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    for (const target of targets) {
        try {
            const file = sessionPath(target);
            if (JSON.parse(fs.readFileSync(file, 'utf8')).sessionId === target.sessionId) fs.unlinkSync(file);
        } catch (_) { /* Keep another session's file. */ }
        if (target.socket) target.socket.close();
    }
    wss.close();
    server.close();
}
function finish() {
    if (finished) return;
    for (const target of targets) {
        if (target.state === 'disconnected' && !target.error) target.error = 'EDITOR_NOT_CONNECTED';
    }
    if (query === 'instances.list') output(true, targets.map(publicInstance));
    else {
        const matches = targets.filter((target) => target.projectRoot === selectedProject);
        if (matches.length !== 1) output(false, null, { code: matches.length ? 'AMBIGUOUS_EDITOR' : 'EDITOR_NOT_FOUND', message: 'Target project does not select exactly one Editor.' });
        else if (matches[0].state !== 'ready') output(false, null, { code: matches[0].error || 'EDITOR_NOT_CONNECTED', message: `Creator catalog is unavailable: ${selectedProject}` });
        else if (query === 'instances.get') output(true, publicInstance(matches[0]));
        else output(true, { instance: publicInstance(matches[0]), commands: matches[0].commands });
    }
    cleanup();
}
function maybeFinish() {
    if (targets.every((target) => target.state === 'ready' || target.state === 'unavailable')) finish();
}
function sendRequest(target, method) {
    target.requestId = crypto.randomUUID();
    target.nonce = crypto.randomBytes(12).toString('hex');
    target.socket.send(JSON.stringify({ type: 'request', id: target.requestId, method, params: { nonce: target.nonce } }));
}
function unavailable(target, code) {
    target.state = 'unavailable';
    target.error = code;
    maybeFinish();
}

function validCatalog(target, result) {
    if (!Array.isArray(result.commands) || result.commands.length !== 5
        || !(result.activeScene === null || typeof result.activeScene === 'string')
        || !/^[0-9a-f]{64}$/.test(result.catalogRevision || '')) return false;
    const expected = {
        'scene.snapshot': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/snapshotInput', input: catalogSchema.$defs.snapshotInput, preconditions: ['activeScene'] },
        'scene.node.inspect': { access: 'read', inputSchema: 'catalog.schema.json#/$defs/nodeInspectInput', input: catalogSchema.$defs.nodeInspectInput, preconditions: ['activeScene'] },
        'asset.importPng': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/importPngInput', input: catalogSchema.$defs.importPngInput, preconditions: ['stagedPng', 'destinationFree'] },
        'scene.pngSprite': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/pngSpriteInput', input: catalogSchema.$defs.pngSpriteInput,
            preconditions: target.creatorVersion === '2.4.15' ? ['activeScene', 'canvasExisting', 'spriteFrameImported'] : ['activeScene', 'spriteFrameImported'] },
        'scene.node.create': { access: 'write', inputSchema: 'catalog.schema.json#/$defs/nodeCreateInput', input: catalogSchema.$defs.nodeCreateInput,
            preconditions: ['activeScene', 'parentIdentity'] },
    };
    const seen = new Set();
    for (const command of result.commands) {
        const rule = command && expected[command.id];
        if (!rule || seen.has(command.id) || command.contractVersion !== '0.1' || command.access !== rule.access
            || command.inputSchema !== rule.inputSchema || !isDeepStrictEqual(command.input, rule.input)
            || !isDeepStrictEqual(command.preconditions, rule.preconditions)
            || !['available', 'unavailable'].includes(command.status)
            || (command.status === 'available' ? command.reason !== null : typeof command.reason !== 'string')) return false;
        seen.add(command.id);
    }
    const commands = Object.fromEntries(result.commands.map((command) => [command.id, command]));
    const sceneReady = typeof result.activeScene === 'string' && result.activeScene.length > 0;
    if (commands['asset.importPng'].status !== 'available') return false;
    if (commands['scene.snapshot'].status !== (sceneReady ? 'available' : 'unavailable')
        || commands['scene.snapshot'].reason !== (sceneReady ? null : 'NO_OPEN_SCENE')) return false;
    if (commands['scene.node.inspect'].status !== (sceneReady ? 'available' : 'unavailable')
        || commands['scene.node.inspect'].reason !== (sceneReady ? null : 'NO_OPEN_SCENE')) return false;
    if (commands['scene.node.create'].status !== (sceneReady ? 'available' : 'unavailable')
        || commands['scene.node.create'].reason !== (sceneReady ? null : 'NO_OPEN_SCENE')) return false;
    if (!sceneReady && (commands['scene.pngSprite'].status !== 'unavailable' || commands['scene.pngSprite'].reason !== 'NO_OPEN_SCENE')) return false;
    if (sceneReady && target.creatorVersion === '3.8.7' && commands['scene.pngSprite'].status !== 'available') return false;
    if (sceneReady && target.creatorVersion === '2.4.15' && commands['scene.pngSprite'].status === 'unavailable'
        && commands['scene.pngSprite'].reason !== 'CANVAS_NOT_FOUND') return false;
    return true;
}

wss.on('connection', (socket, request) => {
    const target = targets.find((item) => item.token === request.headers['x-cocos-agent-token']);
    if (!target || target.socket) { socket.close(1008); return; }
    target.socket = socket;
    socket.on('message', (raw) => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) { unavailable(target, 'INVALID_RESPONSE'); return; }
        if (message.type === 'hello') {
            if (message.creatorVersion !== target.creatorVersion) {
                socket.send(JSON.stringify({ type: 'helloAck', accepted: false, reason: 'creator-version-mismatch' }));
                unavailable(target, 'CREATOR_VERSION_MISMATCH');
                return;
            }
            if (target.state !== 'disconnected' || message.protocolVersion !== '0.1'
                || path.resolve(message.projectRoot || '') !== target.projectRoot
                || message.extension !== 'cocos-agent-bridge' || !/^[0-9a-f-]{36}$/i.test(message.instanceId || '')) {
                socket.send(JSON.stringify({ type: 'helloAck', accepted: false, reason: 'instance-mismatch' }));
                unavailable(target, 'INSTANCE_MISMATCH');
                return;
            }
            target.instanceId = message.instanceId;
            target.state = 'connected';
            socket.send(JSON.stringify({ type: 'helloAck', accepted: true, sessionId: target.sessionId, protocolVersion: '0.1' }));
            sendRequest(target, 'capabilities.list');
            return;
        }
        if (message.type !== 'response' || message.id !== target.requestId) { unavailable(target, 'INVALID_RESPONSE'); return; }
        const result = message.result || {};
        if (target.state === 'connected') {
            if (result.creatorVersion && result.creatorVersion !== target.creatorVersion) {
                unavailable(target, 'CREATOR_VERSION_MISMATCH');
                return;
            }
            if (message.ok !== true || result.nonce !== target.nonce || result.instanceId !== target.instanceId
                || result.creatorVersion !== target.creatorVersion || path.resolve(result.projectRoot || '') !== target.projectRoot
                || !validCatalog(target, result)) {
                unavailable(target, 'CAPABILITY_CATALOG_INVALID');
                return;
            }
            target.commands = result.commands;
            target.activeScene = result.activeScene;
            target.catalogRevision = result.catalogRevision;
            target.extensionVersion = result.extensionVersion;
            target.state = 'catalogued';
            sendRequest(target, 'scene.snapshot');
            return;
        }
        if (target.state === 'catalogued') {
            if (message.ok === true) {
                if (result.nonce !== target.nonce || result.creatorVersion !== target.creatorVersion
                    || path.resolve(result.projectRoot || '') !== target.projectRoot || result.sceneName !== target.activeScene) {
                    unavailable(target, 'SCENE_CHANGED');
                    return;
                }
            } else if (target.activeScene !== null) {
                unavailable(target, 'SCENE_CHANGED');
                return;
            }
            target.state = 'ready';
            maybeFinish();
        }
    });
    socket.on('close', () => { if (!finished && target.state !== 'ready' && target.state !== 'unavailable') unavailable(target, 'EDITOR_DISCONNECTED'); });
    socket.on('error', () => { if (!finished) unavailable(target, 'EDITOR_DISCONNECTED'); });
});

server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    for (const target of targets) {
        const file = sessionPath(target);
        try {
            const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (existing.expiresAt > Date.now()) {
                target.error = 'ACTIVE_SESSION_EXISTS';
                target.state = 'unavailable';
                continue;
            }
        } catch (_) { /* No existing session. */ }
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ sessionId: target.sessionId, protocolVersion: '0.1',
            creatorVersion: target.creatorVersion, projectRoot: target.projectRoot,
            url: `ws://127.0.0.1:${address.port}/cocos-agent-bridge`, token: target.token,
            expiresAt: Date.now() + 20000 }), { mode: 0o600 });
        fs.chmodSync(file, 0o600);
    }
    timer = setTimeout(finish, 15000);
    maybeFinish();
});

process.on('SIGINT', () => { cleanup(); process.exit(130); });
