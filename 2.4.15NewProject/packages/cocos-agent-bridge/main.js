'use strict';

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CREATOR_VERSION = '2.4.15';
const PROTOCOL_VERSION = '0.1';
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SESSION_PATH = path.join(PROJECT_ROOT, 'temp', 'cocos-agent-bridge', 'session.json');
let timer = null;
let socket = null;
let connecting = false;
let lastSessionId = null;

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
            capabilities: ['bridge.ping'],
        }));
        console.log(`[COCOS_AGENT_BRIDGE_2] connected to local Agent session ${session.sessionId}`);
    });
    socket.on('message', onMessage);
    socket.on('close', () => { connecting = false; socket = null; });
    socket.on('error', () => { connecting = false; });
}

module.exports = {
    load() {
        connectFromSession();
        timer = setInterval(connectFromSession, 1000);
    },
    unload() {
        if (timer) clearInterval(timer);
        timer = null;
        if (socket) socket.close();
        socket = null;
    },
};
