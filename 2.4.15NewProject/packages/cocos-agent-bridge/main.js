'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const WebSocket = require('ws');

const CREATOR_VERSION = '2.4.15';
const PROTOCOL_VERSION = '0.1';
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SESSION_PATH = path.join(PROJECT_ROOT, 'temp', 'cocos-agent-bridge', 'session.json');
const INBOX_PATH = path.join(PROJECT_ROOT, 'temp', 'cocos-agent-bridge', 'inbox');
let timer = null;
let socket = null;
let connecting = false;
let lastSessionId = null;
let activeSession = null;
let pendingSceneSave = null;
const instanceBytes = crypto.randomBytes(16);
instanceBytes[6] = (instanceBytes[6] & 0x0f) | 0x40;
instanceBytes[8] = (instanceBytes[8] & 0x3f) | 0x80;
const instanceHex = instanceBytes.toString('hex');
const INSTANCE_ID = `${instanceHex.slice(0, 8)}-${instanceHex.slice(8, 12)}-${instanceHex.slice(12, 16)}-${instanceHex.slice(16, 20)}-${instanceHex.slice(20)}`;
const COMMAND_INPUTS = {
    snapshot: { type: 'object', additionalProperties: false,
        properties: { targetNodeName: { type: 'string', minLength: 1, maxLength: 64 } } },
    nodeInspect: { type: 'object', additionalProperties: false, required: ['nodePath'],
        properties: { nodePath: { type: 'string', minLength: 1, maxLength: 240 } } },
    importPng: { type: 'object', additionalProperties: false, required: ['sourcePath'],
        properties: { sourcePath: { type: 'string', minLength: 1 } } },
    pngSprite: { type: 'object', additionalProperties: false, required: ['assetName', 'action'],
        properties: {
            assetName: { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\\.png$' },
            action: { enum: ['apply', 'compensate', 'replay'] },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
        } },
    nodeCreate: { type: 'object', additionalProperties: false, required: ['parentPath', 'parentUuid', 'nodeName', 'action'],
        properties: {
            parentPath: { type: 'string', minLength: 1, maxLength: 240 },
            parentUuid: { type: 'string', minLength: 1, maxLength: 64 },
            nodeName: { type: 'string', pattern: '^[A-Za-z0-9_ -]{1,64}$' },
            action: { enum: ['apply', 'compensate', 'replay'] },
            sourceOperationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
            operationId: { type: 'string', pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' },
        } },
};

function commandCatalog(context) {
    const sceneReady = typeof context.sceneName === 'string' && context.sceneName.length > 0;
    const spriteReady = sceneReady && context.hasCanvas === true;
    return [
        { id: 'scene.snapshot', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/snapshotInput', input: COMMAND_INPUTS.snapshot, preconditions: ['activeScene'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
        { id: 'scene.node.inspect', contractVersion: '0.1', access: 'read',
            inputSchema: 'catalog.schema.json#/$defs/nodeInspectInput', input: COMMAND_INPUTS.nodeInspect, preconditions: ['activeScene'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
        { id: 'asset.importPng', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/importPngInput', input: COMMAND_INPUTS.importPng, preconditions: ['stagedPng', 'destinationFree'],
            status: 'available', reason: null },
        { id: 'scene.pngSprite', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/pngSpriteInput', input: COMMAND_INPUTS.pngSprite, preconditions: ['activeScene', 'canvasExisting', 'spriteFrameImported'],
            status: spriteReady ? 'available' : 'unavailable', reason: spriteReady ? null : sceneReady ? 'CANVAS_NOT_FOUND' : 'NO_OPEN_SCENE' },
        { id: 'scene.node.create', contractVersion: '0.1', access: 'write',
            inputSchema: 'catalog.schema.json#/$defs/nodeCreateInput', input: COMMAND_INPUTS.nodeCreate, preconditions: ['activeScene', 'parentIdentity'],
            status: sceneReady ? 'available' : 'unavailable', reason: sceneReady ? null : 'NO_OPEN_SCENE' },
    ];
}

function send(value) {
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function onMessage(raw) {
    let message;
    try { message = JSON.parse(raw.toString()); } catch (_) { return; }

    if (message.type === 'helloAck') {
        if (message.accepted !== true) {
            console.warn(`[COCOS_AGENT_BRIDGE_2] handshake rejected: ${message.reason || 'unknown'}`);
            socket.close();
        }
        return;
    }

    if (message.type !== 'request' || typeof message.id !== 'string') return;
    if (message.method === 'capabilities.list') {
        Editor.Scene.callSceneScript('cocos-agent-bridge', 'catalog-context', {}, (error, context) => {
            if (error || !context) {
                send({ type: 'response', id: message.id, ok: false, error: { code: 'CATALOG_CONTEXT_UNAVAILABLE', message: String(error && error.message || error || 'No context') } });
                return;
            }
            const commands = commandCatalog(context);
            send({ type: 'response', id: message.id, ok: true, result: {
                nonce: message.params && message.params.nonce, instanceId: INSTANCE_ID,
                projectRoot: PROJECT_ROOT, creatorVersion: CREATOR_VERSION,
                extensionVersion: '0.1.0', activeScene: context.sceneName,
                catalogRevision: crypto.createHash('sha256').update(JSON.stringify({ scene: context.sceneName, commands })).digest('hex'),
                commands,
            } });
        });
        return;
    }
    if (message.method === 'scene.preflightPngSprite') {
        preflightSceneOperation(message);
        return;
    }
    if (message.method === 'scene.pngSprite') {
        runSceneOperation(message);
        return;
    }
    if (message.method === 'scene.node.create.preflight' || message.method === 'scene.node.create') {
        runNodeCreate(message);
        return;
    }
    if (message.method === 'asset.importPng') {
        importPng(message);
        return;
    }
    if (message.method === 'scene.snapshot') {
        const params = message.params || {};
        const nonce = params.nonce;
        Editor.Scene.callSceneScript('cocos-agent-bridge', 'snapshot', params, (error, snapshot) => {
            if (error) {
                send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SNAPSHOT_FAILED', message: String(error.message || error) } });
                return;
            }
            send({ type: 'response', id: message.id, ok: true, result: Object.assign({ nonce, creatorVersion: CREATOR_VERSION, projectRoot: PROJECT_ROOT }, snapshot) });
        });
        return;
    }

    if (message.method !== 'bridge.ping') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'METHOD_NOT_FOUND' } });
        return;
    }

    send({
        type: 'response',
        id: message.id,
        ok: true,
        result: {
            nonce: message.params && message.params.nonce,
            creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT,
        },
    });
    console.log(`[COCOS_AGENT_BRIDGE_2] bridge.ping replied for Creator ${CREATOR_VERSION}`);
}

function runNodeCreate(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.nodeOperation;
    if (!operation || params.sessionId !== activeSession.sessionId || params.operationId !== activeSession.operationId
        || params.nonce !== operation.nonce || params.parentPath !== operation.parentPath
        || params.parentUuid !== operation.parentUuid || params.nodeName !== operation.nodeName
        || params.action !== operation.action || params.targetNodeUuid !== operation.targetNodeUuid) {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_NODE_SESSION' } }); return;
    }
    const preflight = message.method.endsWith('.preflight');
    Editor.Scene.callSceneScript('cocos-agent-bridge', preflight ? 'node-create-preflight' : 'node-create-mutate', operation, (error, result) => {
        if (error) { send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'NODE_OPERATION_FAILED', message: String(error.message || error) } }); return; }
        const reply = () => send({ type: 'response', id: message.id, ok: true, result: Object.assign({
            nonce: params.nonce, operationId: params.operationId, creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT, action: operation.action, parentPath: operation.parentPath,
            parentUuid: operation.parentUuid, nodeName: operation.nodeName,
        }, result) });
        if (preflight) reply();
        else saveActiveScene((saveError) => {
            if (saveError) { send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SAVE_UNVERIFIED', message: String(saveError.message || saveError) } }); return; }
            result.saved = true; reply();
        });
    });
}

function runSceneOperation(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.sceneOperation;
    if (!operation || params.sessionId !== activeSession.sessionId || params.assetName !== operation.assetName
        || params.assetUuid !== operation.assetUuid || params.nodeName !== operation.nodeName
        || params.sceneAction !== operation.sceneAction || typeof params.nonce !== 'string') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_SCENE_SESSION' } });
        return;
    }
    const method = params.sceneAction === 'compensate' ? 'remove-png-sprite' : 'place-png-sprite';
    Editor.Scene.callSceneScript('cocos-agent-bridge', method, { spriteFrameUuid: operation.assetUuid, nodeName: operation.nodeName }, (error, result) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'SCENE_OPERATION_FAILED', message: String(error.message || error) } });
            return;
        }
        Editor.Ipc.sendToPanel('scene', 'scene:query-dirty-state', (dirtyError, dirty) => {
            console.log(`[COCOS_AGENT_BRIDGE_2] dirty after edit: ${dirtyError ? String(dirtyError) : JSON.stringify(dirty)}`);
        });
        saveActiveScene((saveError) => {
            if (saveError) {
                send({ type: 'response', id: message.id, ok: false, error: { code: 'SCENE_SAVE_UNVERIFIED', message: String(saveError.message || saveError) } });
                return;
            }
            send({
                type: 'response', id: message.id, ok: true,
                result: Object.assign({
                    nonce: params.nonce,
                    sessionId: activeSession.sessionId,
                    creatorVersion: CREATOR_VERSION,
                    projectRoot: PROJECT_ROOT,
                    action: params.sceneAction,
                    assetName: operation.assetName,
                    nodeName: operation.nodeName,
                    saved: true,
                }, result),
            });
        });
    });
}

function preflightSceneOperation(message) {
    const params = message.params || {};
    const operation = activeSession && activeSession.sceneOperation;
    const contract = params.operation || {};
    if (!operation || params.sessionId !== activeSession.sessionId || params.assetName !== operation.assetName
        || params.assetUuid !== operation.assetUuid || params.nodeName !== operation.nodeName
        || params.sceneAction !== operation.sceneAction || typeof params.nonce !== 'string'
        || contract.contractVersion !== '0.1' || contract.operationId !== activeSession.operationId
        || contract.capabilityId !== 'scene.pngSprite' || contract.action !== operation.sceneAction
        || contract.assetName !== operation.assetName || contract.assetUuid !== operation.assetUuid
        || contract.nodeName !== operation.nodeName || typeof contract.sceneName !== 'string') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_SCENE_SESSION', phase: 'preflight', message: 'Session manifest mismatch.', retryable: false, sideEffect: 'none' } });
        return;
    }
    Editor.Scene.callSceneScript('cocos-agent-bridge', 'preflight-png-sprite', {
        spriteFrameUuid: operation.assetUuid, nodeName: operation.nodeName, action: operation.sceneAction,
    }, (error, result) => {
        if (error) {
            send({ type: 'response', id: message.id, ok: false, error: { code: error.code || 'PREFLIGHT_FAILED', phase: 'preflight', message: String(error.message || error), retryable: false, sideEffect: 'none' } });
            return;
        }
        send({ type: 'response', id: message.id, ok: true, result: Object.assign({ nonce: params.nonce, creatorVersion: CREATOR_VERSION, projectRoot: PROJECT_ROOT }, result) });
    });
}

function saveActiveScene(callback) {
    if (pendingSceneSave) {
        callback(new Error('A scene save is already in progress.'));
        return;
    }
    let settled = false;
    const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        pendingSceneSave = null;
        callback(error || null);
    };
    const timeout = setTimeout(() => finish(new Error('Timed out waiting for scene:saved.')), 15000);
    pendingSceneSave = finish;
    Editor.Ipc.sendToPanel('scene', 'scene:stash-and-save');
}

function importPng(message) {
    const params = message.params || {};
    const staged = activeSession && activeSession.assetImport;
    if (!staged || params.sessionId !== activeSession.sessionId || typeof params.nonce !== 'string') {
        send({ type: 'response', id: message.id, ok: false, error: { code: 'INVALID_IMPORT_SESSION' } });
        return;
    }
    const failImport = (code, error) => send({
        type: 'response', id: message.id, ok: false,
        error: { code, message: String(error && error.message || error || code) },
    });
    if (!/^[0-9a-f-]{36}$/i.test(activeSession.sessionId)
        || staged.destinationFolder !== 'db://assets/resources'
        || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.png$/i.test(staged.assetName)
        || staged.destinationUrl !== `${staged.destinationFolder}/${staged.assetName}`
        || staged.fileName !== `${activeSession.sessionId}/${staged.assetName}`) {
        failImport('INVALID_IMPORT_MANIFEST');
        return;
    }
    const sourcePath = path.join(INBOX_PATH, staged.fileName);
    let data;
    try {
        const stat = fs.lstatSync(sourcePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== staged.byteLength || stat.size > 10 * 1024 * 1024) {
            failImport('INVALID_STAGED_FILE');
            return;
        }
        data = fs.readFileSync(sourcePath);
    } catch (error) {
        failImport('STAGED_FILE_UNAVAILABLE', error);
        return;
    }
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const width = data.length >= 24 ? data.readUInt32BE(16) : 0;
    const height = data.length >= 24 ? data.readUInt32BE(20) : 0;
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    if (!data.subarray(0, 8).equals(signature) || data.toString('ascii', 12, 16) !== 'IHDR'
        || sha256 !== staged.sha256 || width !== staged.width || height !== staged.height) {
        failImport('STAGED_FILE_MISMATCH');
        return;
    }
    if (Editor.assetdb.exists(staged.destinationUrl)) {
        failImport('ASSET_CONFLICT', `Asset already exists: ${staged.destinationUrl}`);
        return;
    }

    Editor.assetdb.import([sourcePath], staged.destinationFolder, (error, results) => {
        if (error) {
            failImport('ASSET_IMPORT_FAILED', error);
            return;
        }
        const imported = Array.isArray(results) && results.find((item) => item && item.url === staged.destinationUrl);
        const uuid = imported && imported.uuid || Editor.assetdb.urlToUuid(staged.destinationUrl);
        const type = imported && imported.type;
        if (!uuid || typeof type !== 'string' || !type) {
            const resultShape = Array.isArray(results)
                ? results.map((item) => item && ({ url: item.url, uuid: item.uuid, type: item.type, command: item.command }))
                : String(results);
            failImport('ASSET_IMPORT_UNVERIFIED', JSON.stringify({ url: staged.destinationUrl, exists: Editor.assetdb.exists(staged.destinationUrl), uuid, results: resultShape }));
            return;
        }
        send({
            type: 'response', id: message.id, ok: true,
            result: {
                nonce: params.nonce,
                sessionId: activeSession.sessionId,
                creatorVersion: CREATOR_VERSION,
                projectRoot: PROJECT_ROOT,
                sourceName: staged.assetName,
                assetName: staged.assetName,
                url: staged.destinationUrl,
                uuid,
                type,
                imported: true,
                invalid: false,
                sha256,
                byteLength: data.length,
                width,
                height,
            },
        });
    });
}

function connectFromSession() {
    if (connecting || (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))) return;
    let session;
    try {
        session = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    } catch (_) {
        return;
    }
    if (session.protocolVersion !== PROTOCOL_VERSION
        || session.creatorVersion !== CREATOR_VERSION
        || path.resolve(session.projectRoot || '') !== PROJECT_ROOT
        || typeof session.token !== 'string'
        || !/^ws:\/\/127\.0\.0\.1:\d+\/cocos-agent-bridge$/.test(session.url)
        || session.expiresAt < Date.now()) {
        if (lastSessionId !== session.sessionId) {
            lastSessionId = session.sessionId;
            console.warn('[COCOS_AGENT_BRIDGE_2] ignored incompatible or expired local session');
        }
        return;
    }

    activeSession = session;
    connecting = true;
    socket = new WebSocket(session.url, { headers: { 'x-cocos-agent-token': session.token } });
    socket.on('open', () => {
        connecting = false;
        lastSessionId = session.sessionId;
        socket.send(JSON.stringify({
            type: 'hello',
            protocolVersion: PROTOCOL_VERSION,
            creatorVersion: CREATOR_VERSION,
            projectRoot: PROJECT_ROOT,
            extension: 'cocos-agent-bridge',
            instanceId: INSTANCE_ID,
            capabilities: ['bridge.ping', 'scene.snapshot', 'asset.importPng', 'scene.preflightPngSprite', 'scene.placePngSprite', 'scene.removePngSprite', 'scene.node.create.preflight', 'scene.node.create'],
            operationContract: { id: 'scene.pngSprite', contractVersion: '0.1', creatorVersion: CREATOR_VERSION, access: 'scene-write', actions: ['apply', 'compensate', 'replay'], previewVerification: 'manual-web', compensation: 'identity-checked-node-removal' },
        }));
        console.log(`[COCOS_AGENT_BRIDGE_2] connected to local Agent session ${session.sessionId}`);
    });
    socket.on('message', onMessage);
    socket.on('close', () => { connecting = false; socket = null; });
    socket.on('error', () => { connecting = false; });
}

module.exports = {
    messages: {
        'scene:saved'() {
            if (pendingSceneSave) pendingSceneSave(null);
        },
    },
    load() {
        connectFromSession();
        timer = setInterval(connectFromSession, 1000);
    },
    unload() {
        if (timer) clearInterval(timer);
        timer = null;
        if (socket) socket.close();
        socket = null;
        activeSession = null;
    },
};
