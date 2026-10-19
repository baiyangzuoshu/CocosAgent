'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('./vendor/ws');
const contract = require('./script-contract');
const arg = (name) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const root = path.resolve(arg('--project') || '.');
const command = arg('--command'); const instanceId = arg('--expected-instance-id');
let input;
try { input = JSON.parse(arg('--input')); } catch (_) {}
if (arg('--creator-version') !== '2.4.15' || !/^[0-9a-f-]{36}$/i.test(instanceId || '') || !contract.validInput(command, input)) {
    process.stderr.write('INVALID_SCRIPT_REQUEST\n'); process.exit(2);
}
const sessionId = crypto.randomUUID(); const nonce = crypto.randomUUID(); const token = crypto.randomBytes(32).toString('hex');
const sessionFile = path.join(root, 'temp/cocos-agent-bridge/session.json');
const server = http.createServer((req, res) => { res.writeHead(404); res.end(); });
const wss = new WebSocket.Server({ server, maxPayload: 400000 });
let finished = false; let connected = false; let sent = false; let timer;
function finish(result) {
    if (finished) return; finished = true; clearTimeout(timer);
    try { const session = JSON.parse(fs.readFileSync(sessionFile)); if (session.sessionId === sessionId) fs.unlinkSync(sessionFile); } catch (_) {}
    wss.clients.forEach((socket) => socket.terminate()); wss.close(); server.close();
    process.stdout.write(`command.result ${JSON.stringify({ command, result })}\n`);
}
function uncertain(code) {
    const write = ['script.patch', 'script.create'].includes(command) && sent;
    finish({ success: false, outcome: write ? 'needs-review' : 'failed', ...(input.operationId ? { operationId: input.operationId } : {}),
        error: { code, phase: 'execution', sideEffect: write ? 'possible' : 'none', retryable: false,
            message: write ? 'Query the original script operation and reconcile or compensate. Never repeat apply.' : code } });
}
wss.on('connection', (socket, req) => {
    if (connected || req.headers['x-cocos-agent-token'] !== token) { socket.close(1008); return; }
    connected = true;
    socket.on('message', (raw) => {
        let message; try { message = JSON.parse(raw); } catch (_) { uncertain('INVALID_RESPONSE'); return; }
        if (message.type === 'hello') {
            if (sent || message.instanceId !== instanceId || message.creatorVersion !== '2.4.15'
                || message.projectRoot !== root || message.extension !== 'cocos-agent-bridge' || message.protocolVersion !== '0.1') {
                uncertain('INSTANCE_MISMATCH'); return;
            }
            socket.send(JSON.stringify({ type: 'helloAck', accepted: true, sessionId, protocolVersion: '0.1' }));
            sent = true;
            socket.send(JSON.stringify({ type: 'request', id: nonce, method: command, params: { input, nonce, instanceId, sessionId } }));
            return;
        }
        if (message.type !== 'response' || message.id !== nonce) { uncertain('INVALID_RESPONSE'); return; }
        if (!message.ok) { finish({ success: false, outcome: 'failed', ...(input.operationId ? { operationId: input.operationId } : {}),
            error: { ...message.error, phase: 'preflight', sideEffect: message.error?.sideEffect || 'none', retryable: false } }); return; }
        if (!message.result || message.result.nonce !== nonce || message.result.instanceId !== instanceId
            || message.result.creatorVersion !== '2.4.15' || message.result.projectRoot !== root) { uncertain('RESULT_IDENTITY_MISMATCH'); return; }
        finish(message.result);
    });
    socket.on('close', () => { if (!finished) uncertain('EDITOR_DISCONNECTED'); });
    socket.on('error', () => { if (!finished) uncertain('EDITOR_DISCONNECTED'); });
});
server.listen(0, '127.0.0.1', () => {
    try {
        const existing = JSON.parse(fs.readFileSync(sessionFile));
        if (existing.expiresAt > Date.now()) { uncertain('ACTIVE_SESSION_EXISTS'); return; }
    } catch (_) {}
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.writeFileSync(sessionFile, JSON.stringify({ sessionId, protocolVersion: '0.1', creatorVersion: '2.4.15', projectRoot: root,
        url: `ws://127.0.0.1:${server.address().port}/cocos-agent-bridge`, token, expiresAt: Date.now() + 45000,
        scriptRequestNonce: nonce, scriptCommand: command, scriptInput: input }), { mode: 0o600 });
    fs.chmodSync(sessionFile, 0o600);
    timer = setTimeout(() => uncertain('SCRIPT_RESPONSE_TIMEOUT'), 35000);
});
