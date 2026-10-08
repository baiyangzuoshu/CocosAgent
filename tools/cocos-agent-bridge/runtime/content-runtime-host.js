'use strict';

// Preview-only, one-project runtime channel. The game never receives filesystem access.
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const WebSocket = require('../vendor/ws');
const content = require('../content-release');

function start(options) {
    const { projectRoot, creatorVersion, previewUrl } = options;
    const root = path.resolve(projectRoot);
    if (creatorVersion !== '2.4.15') throw Error('UNSUPPORTED_CREATOR_VERSION');
    const preview = new URL(previewUrl);
    if (preview.protocol !== 'http:' || preview.hostname !== '127.0.0.1'
        || preview.port !== '7456') throw Error('INVALID_PREVIEW_URL');
    const origin = preview.origin;
    const token = crypto.randomBytes(32).toString('hex');
    let client = null;
    let pending = null;
    let lastSent = null;
    let sequence = 0;
    let closed = false;
    const events = [];
    const server = http.createServer((_request, response) => { response.writeHead(404); response.end(); });
    const sockets = new WebSocket.Server({ server, path: '/runtime', maxPayload: 32 * 1024,
        verifyClient: ({ req }, done) => {
            const supplied = new URL(req.url, 'http://127.0.0.1').searchParams.get('token');
            const a = Buffer.from(supplied || '', 'utf8');
            const b = Buffer.from(token, 'utf8');
            done(req.headers.origin === origin && a.length === b.length && crypto.timingSafeEqual(a, b));
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
                if (message.type !== 'hello' || message.creatorVersion !== creatorVersion
                    || typeof message.scene !== 'string') { socket.close(1008, 'target mismatch'); return; }
                client.ready = true;
                events.push({ type: 'connected', creatorVersion, scene: message.scene });
                dispatch();
                return;
            }
            if (message.type !== 'receipt' || !pending || message.id !== pending.id
                || !message.receipt || message.receipt.releaseId !== pending.releaseId) {
                socket.close(1008, 'unexpected receipt'); return;
            }
            const receipt = message.receipt;
            const result = ['applied', 'already-active'].includes(receipt.outcome)
                ? content.acceptRuntime({ projectRoot: root, creatorVersion, platform: 'web-preview', receipt })
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
            preview.searchParams.set('cocosAgentPort', String(port));
            preview.searchParams.set('cocosAgentToken', token);
            resolve({ previewUrl: preview.toString(), events, close: async () => {
                closed = true;
                clearInterval(timer);
                if (client) client.socket.close();
                await new Promise((done) => sockets.close(done));
                await new Promise((done) => server.close(done));
            } });
        });
    });
}

if (require.main === module) {
    const at = (flag) => process.argv[process.argv.indexOf(flag) + 1];
    start({ projectRoot: at('--project'), creatorVersion: at('--creator-version'), previewUrl: at('--preview-url') })
        .then((host) => {
            process.stdout.write(`${JSON.stringify({ type: 'ready', previewUrl: host.previewUrl })}\n`);
            const shutdown = () => host.close().then(() => process.exit(0));
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
            setInterval(() => {
                while (host.events.length) process.stdout.write(`${JSON.stringify(host.events.shift())}\n`);
            }, 100);
        }).catch((error) => { process.stderr.write(`${error.stack || error}\n`); process.exitCode = 1; });
}
module.exports = { start };
