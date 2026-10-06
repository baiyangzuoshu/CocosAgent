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
    if (message.method === 'scene.pngSprite') {
        runSceneOperation(message);
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
            capabilities: ['bridge.ping', 'scene.snapshot', 'asset.importPng', 'scene.placePngSprite', 'scene.removePngSprite'],
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
