'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('./vendor/ws');

const PROTOCOL_VERSION = '0.1';
const SUPPORTED_CREATORS = new Set(['2.4.15', '3.8.7']);

function argument(name) {
    const index = process.argv.indexOf(name);
    return index < 0 ? undefined : process.argv[index + 1];
}

function fail(message) {
    process.stderr.write(`${message}\n`);
    process.exit(2);
}

const projectRootArg = argument('--project');
const creatorVersion = argument('--creator-version');
if (!projectRootArg || !creatorVersion) {
    fail('Usage: node bridge-host.js --project <project-root> --creator-version <2.4.15|3.8.7>');
}
if (!SUPPORTED_CREATORS.has(creatorVersion)) {
    fail(`Unsupported Creator version: ${creatorVersion}`);
}

const projectRoot = path.resolve(projectRootArg);
if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    fail(`Project directory does not exist: ${projectRoot}`);
}

const sessionDirectory = path.join(projectRoot, 'temp', 'cocos-agent-bridge');
const sessionPath = path.join(sessionDirectory, 'session.json');
const token = crypto.randomBytes(32).toString('hex');
const sessionId = crypto.randomUUID();
const requestId = crypto.randomUUID();
const nonce = crypto.randomBytes(12).toString('hex');
let connectedSocket = null;
let finished = false;
let handshakeTimer = null;
let requestTimer = null;

function sameSecret(candidate) {
    if (typeof candidate !== 'string') return false;
    const expected = Buffer.from(token, 'utf8');
    const received = Buffer.from(candidate, 'utf8');
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function cleanUp(exitCode) {
    if (finished) return;
    finished = true;
    clearTimeout(handshakeTimer);
    clearTimeout(requestTimer);
    try {
        const current = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
        if (current.sessionId === sessionId) fs.unlinkSync(sessionPath);
    } catch (_) {
        // The session may already have been removed by the editor or user.
    }
    try { fs.rmdirSync(sessionDirectory); } catch (_) { /* Keep unrelated files. */ }
    if (connectedSocket && connectedSocket.readyState === WebSocket.OPEN) connectedSocket.close();
    try { server.close(); } catch (_) { /* Server may not have started. */ }
    process.exitCode = exitCode;
}

function send(socket, value) {
    if (socket.readyState !== WebSocket.OPEN) throw new Error('WebSocket is not open');
    socket.send(JSON.stringify(value));
}

const server = http.createServer((request, response) => {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
});

const webSocketServer = new WebSocket.Server({
    server,
    path: '/cocos-agent-bridge',
    maxPayload: 16 * 1024,
    verifyClient: (info, done) => done(sameSecret(info.req.headers['x-cocos-agent-token'])),
});

webSocketServer.on('error', (error) => {
    process.stderr.write(`Bridge WebSocket server error: ${error.message}\n`);
    cleanUp(1);
});

webSocketServer.on('connection', (socket) => {
    if (connectedSocket) {
        socket.close(1008, 'A bridge client is already connected');
        return;
    }
    connectedSocket = socket;
    process.stdout.write('Extension connected; waiting for version and project handshake.\n');
    handshakeTimer = setTimeout(() => {
        process.stderr.write('Handshake timed out.\n');
        cleanUp(1);
    }, 15000);

    socket.on('message', (raw) => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch (_) {
            process.stderr.write('Received invalid JSON.\n');
            cleanUp(1);
            return;
        }

        if (message.type === 'hello') {
            const projectMatches = path.resolve(message.projectRoot || '') === projectRoot;
            const versionMatches = message.creatorVersion === creatorVersion;
            const protocolMatches = message.protocolVersion === PROTOCOL_VERSION;
            const extensionMatches = message.extension === 'cocos-agent-bridge';
            if (!projectMatches || !versionMatches || !protocolMatches || !extensionMatches) {
                send(socket, {
                    type: 'helloAck',
                    accepted: false,
                    reason: !projectMatches ? 'project-mismatch' : !versionMatches ? 'creator-version-mismatch' : !protocolMatches ? 'protocol-version-mismatch' : 'extension-mismatch',
                });
                process.stderr.write(`Handshake rejected (project=${projectMatches}, creator=${versionMatches}, protocol=${protocolMatches}, extension=${extensionMatches}).\n`);
                cleanUp(1);
                return;
            }

            clearTimeout(handshakeTimer);
            send(socket, { type: 'helloAck', accepted: true, sessionId, protocolVersion: PROTOCOL_VERSION });
            process.stdout.write(`Handshake accepted: Creator ${creatorVersion}, project ${projectRoot}.\n`);
            send(socket, { type: 'request', id: requestId, method: 'bridge.ping', params: { nonce } });
            requestTimer = setTimeout(() => {
                process.stderr.write('bridge.ping timed out.\n');
                cleanUp(1);
            }, 10000);
            return;
        }

        if (message.type === 'response' && message.id === requestId) {
            clearTimeout(requestTimer);
            const result = message.result || {};
            const valid = message.ok === true
                && result.nonce === nonce
                && result.creatorVersion === creatorVersion
                && path.resolve(result.projectRoot || '') === projectRoot;
            if (!valid) {
                process.stderr.write(`bridge.ping validation failed (ok=${message.ok === true}, nonce=${result.nonce === nonce}, version=${result.creatorVersion === creatorVersion}, project=${path.resolve(result.projectRoot || '') === projectRoot}).\n`);
                cleanUp(1);
                return;
            }
            process.stdout.write(`bridge.ping verified: ${result.creatorVersion}, project identity confirmed, nonce echoed.\n`);
            cleanUp(0);
            return;
        }

        process.stderr.write(`Unexpected bridge message: ${String(message.type || 'unknown')}\n`);
        cleanUp(1);
    });

    socket.on('error', (error) => {
        process.stderr.write(`Bridge socket error: ${error.message}\n`);
        cleanUp(1);
    });
});

server.on('error', (error) => {
    process.stderr.write(`Bridge server error: ${error.message}\n`);
    cleanUp(1);
});

server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const session = {
        protocolVersion: PROTOCOL_VERSION,
        sessionId,
        creatorVersion,
        projectRoot,
        url: `ws://127.0.0.1:${address.port}/cocos-agent-bridge`,
        token,
        expiresAt: Date.now() + 1800000,
    };
    fs.mkdirSync(sessionDirectory, { recursive: true });
    const temporaryPath = `${sessionPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(session), { mode: 0o600 });
    fs.renameSync(temporaryPath, sessionPath);
    try { fs.chmodSync(sessionPath, 0o600); } catch (_) { /* ACLs apply on platforms without POSIX modes. */ }
    process.stdout.write(`Bridge ready for Creator ${creatorVersion}. Open or refresh the matching project extension.\n`);
    process.stdout.write(`Session discovery file: ${sessionPath}\n`);
});

process.on('SIGINT', () => cleanUp(130));
process.on('SIGTERM', () => cleanUp(143));
