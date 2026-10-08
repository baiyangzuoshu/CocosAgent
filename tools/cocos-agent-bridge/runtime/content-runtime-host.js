'use strict';

// Local one-project runtime channel. The game never receives arbitrary filesystem access.
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('../vendor/ws');
const content = require('../content-release');

const NATIVE_SESSION_DIRECTORY = 'cocos-agent';
const NATIVE_SESSION_FILENAME = 'runtime-session.json';
const NATIVE_BOOTSTRAP_TTL_MS = 15 * 60 * 1000;

function sessionMatchesToken(supplied, token) {
    const a = Buffer.from(typeof supplied === 'string' ? supplied : '', 'utf8');
    const b = Buffer.from(token, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isNativeLoopbackOrigin(origin) {
    const match = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/.exec(origin || '');
    return !!match && Number(match[1]) <= 65535;
}

function prepareNativeSessionPath(nativeWritablePath) {
    if (typeof nativeWritablePath !== 'string' || !path.isAbsolute(nativeWritablePath)) {
        throw Error('NATIVE_WRITABLE_PATH_REQUIRED');
    }
    const directory = path.join(path.resolve(nativeWritablePath), NATIVE_SESSION_DIRECTORY);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const directoryStat = fs.lstatSync(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()
        || (typeof process.getuid === 'function' && directoryStat.uid !== process.getuid())) {
        throw Error('UNSAFE_NATIVE_SESSION_DIRECTORY');
    }
    fs.chmodSync(directory, 0o700);
    const filename = path.join(directory, NATIVE_SESSION_FILENAME);
    try {
        const existing = fs.lstatSync(filename);
        if (!existing.isFile() || existing.isSymbolicLink()) throw Error('UNSAFE_NATIVE_SESSION_FILE');
        let previous;
        try { previous = JSON.parse(fs.readFileSync(filename, 'utf8')); } catch (_) { previous = null; }
        if (!previous || !Number.isFinite(previous.bootstrapExpiresAt)
            || previous.bootstrapExpiresAt > Date.now()) throw Error('NATIVE_SESSION_ALREADY_ACTIVE');
        fs.unlinkSync(filename);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    return filename;
}

function writeNativeSession(filename, value) {
    const temporary = `${filename}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
        fs.renameSync(temporary, filename);
        fs.chmodSync(filename, 0o600);
    } finally { try { fs.unlinkSync(temporary); } catch (_) { /* renamed */ } }
}

function removeNativeSession(filename, sessionId) {
    if (!filename) return;
    try {
        const current = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (current.sessionId === sessionId) fs.unlinkSync(filename);
    } catch (_) { /* missing or already consumed */ }
}

function start(options) {
    const { projectRoot, creatorVersion } = options;
    const root = path.resolve(projectRoot);
    if (creatorVersion !== '2.4.15') throw Error('UNSUPPORTED_CREATOR_VERSION');
    const platform = options.platform || 'web-preview';
    if (!['web-preview', 'mac-native'].includes(platform)) throw Error('UNSUPPORTED_RUNTIME_PLATFORM');
    let preview = null;
    let origin = null;
    let nativeSessionPath = null;
    if (platform === 'web-preview') {
        preview = new URL(options.previewUrl);
        if (preview.protocol !== 'http:' || preview.hostname !== '127.0.0.1'
            || preview.port !== '7456') throw Error('INVALID_PREVIEW_URL');
        origin = preview.origin;
    } else {
        nativeSessionPath = prepareNativeSessionPath(options.nativeWritablePath);
    }
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomBytes(16).toString('hex');
    const bootstrapExpiresAt = Date.now() + NATIVE_BOOTSTRAP_TTL_MS;
    let client = null;
    let pending = null;
    let lastSent = null;
    let sequence = 0;
    let closed = false;
    let nativeBootstrapConsumed = false;
    const events = [];
    const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
    const sockets = new WebSocket.Server({ server, path: '/runtime', maxPayload: 32 * 1024,
        verifyClient: ({ req }, done) => {
            const supplied = new URL(req.url, 'http://127.0.0.1').searchParams.get('token');
            const validOrigin = platform === 'web-preview'
                ? req.headers.origin === origin
                : isNativeLoopbackOrigin(req.headers.origin);
            const validToken = sessionMatchesToken(supplied, token);
            if (!validOrigin || !validToken) events.push({ type: 'handshake-rejected',
                reason: !validToken ? 'invalid-token' : 'origin-policy',
                origin: req.headers.origin || null, platform });
            done(validOrigin && validToken);
        } });
    function current(pointer) {
        const fetched = content.get({ projectRoot: root, creatorVersion, releaseId: pointer.releaseId });
        if (!fetched.success || fetched.release.fingerprint !== pointer.fingerprint) return null;
        const checked = content.validate({ projectRoot: root, creatorVersion, manifest: fetched.release });
        if (!checked.success || checked.fingerprint !== fetched.release.fingerprint) return null;
        return fetched.release;
    }
    function dispatch() {
        if (!client || !client.ready || client.socket.readyState !== WebSocket.OPEN || pending) return;
        const state = content.get({ projectRoot: root, creatorVersion });
        if (!state.success || !state.selected || state.selected.fingerprint === lastSent) return;
        const release = current(state.selected);
        if (!release) return;
        const id = ++sequence;
        pending = { id, releaseId: release.releaseId, fingerprint: release.fingerprint };
        lastSent = release.fingerprint;
        client.socket.send(JSON.stringify({ type: 'apply', id, release, assetId: release.entryAssetId }));
        events.push({ type: 'dispatched', id, releaseId: release.releaseId });
    }
    sockets.on('connection', (socket) => {
        if (client) { socket.close(1008, 'one client only'); return; }
        client = { socket, ready: false };
        socket.on('message', (raw) => {
            let message;
            try { message = JSON.parse(String(raw)); } catch (_) { socket.close(1003); return; }
            if (!client || client.socket !== socket) return;
            if (!client.ready) {
                const clientPlatform = message.platform || 'web-preview';
                if (message.type !== 'hello' || message.creatorVersion !== creatorVersion
                    || clientPlatform !== platform || typeof message.scene !== 'string') {
                    socket.close(1008, 'target mismatch'); return;
                }
                if (platform === 'mac-native') {
                    if (message.sessionId !== sessionId
                        || (!nativeBootstrapConsumed && Date.now() > bootstrapExpiresAt)) {
                        socket.close(1008, 'native session expired'); return;
                    }
                    nativeBootstrapConsumed = true;
                    removeNativeSession(nativeSessionPath, sessionId);
                }
                client.ready = true;
                events.push({ type: 'connected', platform, creatorVersion, scene: message.scene });
                dispatch();
                return;
            }
            if (message.type !== 'receipt' || !pending || message.id !== pending.id
                || !message.receipt || message.receipt.releaseId !== pending.releaseId) {
                socket.close(1008, 'unexpected receipt'); return;
            }
            const receipt = message.receipt;
            const result = ['applied', 'already-active'].includes(receipt.outcome)
                ? (platform === 'mac-native' ? content.acceptNativeRuntime : content.acceptRuntime)(
                    { projectRoot: root, creatorVersion, platform, receipt })
                : { success: false, outcome: receipt.outcome, error: { code: receipt.code || 'NOT_APPLIED' } };
            events.push({ type: 'receipt', id: pending.id, receipt, acceptance: result });
            socket.send(JSON.stringify({ type: 'ack', id: pending.id, acceptance: result }));
            pending = null;
            dispatch();
        });
        socket.on('close', () => {
            if (client?.socket === socket) { client = null; pending = null; lastSent = null; events.push({ type: 'disconnected' }); }
        });
    });
    const timer = setInterval(() => {
        if (closed) return;
        try { dispatch(); } catch (error) { events.push({ type: 'host-error', code: error.code || error.message }); }
    }, 250);
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            let clientUrl = null;
            try {
                if (platform === 'web-preview') {
                    preview.searchParams.set('cocosAgentPort', String(port));
                    preview.searchParams.set('cocosAgentToken', token);
                    clientUrl = preview.toString();
                } else {
                    writeNativeSession(nativeSessionPath, { schemaVersion: '0.1', platform,
                        creatorVersion, host: '127.0.0.1', port, token, sessionId, bootstrapExpiresAt });
                }
            } catch (error) {
                server.close(() => reject(error));
                return;
            }
            resolve({ platform, previewUrl: clientUrl, sessionPath: nativeSessionPath, events, close: async () => {
                closed = true;
                clearInterval(timer);
                removeNativeSession(nativeSessionPath, sessionId);
                if (client) client.socket.close();
                await new Promise((done) => sockets.close(done));
                await new Promise((done) => server.close(done));
            } });
        });
    });
}

if (require.main === module) {
    const at = (flag) => {
        const index = process.argv.indexOf(flag);
        return index < 0 ? undefined : process.argv[index + 1];
    };
    const platform = at('--platform') || 'web-preview';
    start({ projectRoot: at('--project'), creatorVersion: at('--creator-version'), platform,
        previewUrl: at('--preview-url'), nativeWritablePath: at('--native-writable-path') })
        .then((host) => {
            process.stdout.write(`${JSON.stringify({ type: 'ready', platform: host.platform,
                previewUrl: host.previewUrl, sessionPath: host.sessionPath })}\n`);
            const shutdown = () => host.close().then(() => process.exit(0));
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
            setInterval(() => {
                while (host.events.length) process.stdout.write(`${JSON.stringify(host.events.shift())}\n`);
            }, 100);
        }).catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
module.exports = { start };
