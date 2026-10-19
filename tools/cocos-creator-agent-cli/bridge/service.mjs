import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CREATOR_VERSION, PROTOCOL_VERSION, COMMANDS, validateCommand, publicCatalog } from './contracts.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(os.homedir(), '.cocos-creator-agent');
const STATE_FILE = path.join(DATA_ROOT, 'third-party-bridge.json');
const MAX_BODY_BYTES = 1024 * 1024;
const INSTANCE_TTL_MS = 45000;
const POLL_WAIT_MS = 25000;
const REQUEST_TIMEOUT_MS = 30000;
const EXTENSION_VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'creator-extension/package.json'), 'utf8')).version;
const CONTRACT_FINGERPRINT = createHash('sha256')
  .update(fs.readFileSync(path.join(PLUGIN_ROOT, 'creator-extension/command-contract.json'))).digest('hex');
const instances = new Map();

if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('NODE_20_REQUIRED');
fs.mkdirSync(DATA_ROOT, { recursive: true, mode: 0o700 });
const rootStat = fs.lstatSync(DATA_ROOT);
if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('BRIDGE_DATA_DIRECTORY_UNSAFE');
try { fs.chmodSync(DATA_ROOT, 0o700); } catch (_) {}

const token = randomBytes(32).toString('hex');
const bridgeId = randomUUID();
let server;
let stopping = false;

function sendJson(response, status, value) {
  const bytes = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.length,
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(bytes);
}

function sendEmpty(response, status = 204) { response.writeHead(status, { 'cache-control': 'no-store' }); response.end(); }

function sendFailure(response, status, code, detail) {
  sendJson(response, status, { error: { code, ...(detail ? { detail: String(detail).slice(0, 300) } : {}) } });
}

function authorized(request) {
  const supplied = request.headers.authorization || '';
  const expected = `Bearer ${token}`;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY_BYTES) { reject(Object.assign(new Error('REQUEST_TOO_LARGE'), { status: 413 })); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (_) { reject(Object.assign(new Error('INVALID_JSON'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}

function instanceIsLive(instance) { return Date.now() - instance.lastSeenAt <= INSTANCE_TTL_MS; }

function settle(instance, requestId, outcome) {
  const job = instance.inFlight;
  if (!job || job.requestId !== requestId) return false;
  clearTimeout(job.timeout);
  instance.inFlight = null;
  job.resolve(outcome);
  return true;
}

function expireInstances() {
  for (const [id, instance] of instances) {
    if (instanceIsLive(instance)) continue;
    if (instance.pollWaiter) { clearTimeout(instance.pollWaiter.timeout); sendEmpty(instance.pollWaiter.response); }
    if (instance.inFlight) settle(instance, instance.inFlight.requestId, { error: { code: 'CREATOR_INSTANCE_DISCONNECTED' } });
    instances.delete(id);
  }
}

function resolveInstance(id, response) {
  expireInstances();
  const instance = instances.get(id);
  if (!instance) { sendFailure(response, 404, 'CREATOR_INSTANCE_NOT_FOUND'); return null; }
  if (!instanceIsLive(instance)) { sendFailure(response, 409, 'CREATOR_INSTANCE_STALE'); return null; }
  return instance;
}

function validCapabilities(value) {
  if (!Array.isArray(value) || value.length > COMMANDS.size) return false;
  const seen = new Set();
  return value.every((item) => {
    if (!item || typeof item.id !== 'string' || seen.has(item.id) || !COMMANDS.has(item.id)
      || !['available', 'unavailable'].includes(item.status)
      || (item.status === 'unavailable' && typeof item.reason !== 'string')) return false;
    seen.add(item.id);
    return true;
  });
}

function canonicalProjectRoot(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('PROJECT_ROOT_INVALID');
  const root = fs.realpathSync(value);
  const rootStat = fs.statSync(root);
  const metadata = path.join(root, 'project.json');
  const metaStat = fs.lstatSync(metadata);
  if (!rootStat.isDirectory() || !metaStat.isFile() || metaStat.isSymbolicLink()) throw new Error('PROJECT_ROOT_INVALID');
  return root;
}

function makeInstance(body) {
  if (!body || !/^[0-9a-f-]{36}$/i.test(body.instanceId || '') || body.creatorVersion !== CREATOR_VERSION
    || body.extensionVersion !== EXTENSION_VERSION || body.contractFingerprint !== CONTRACT_FINGERPRINT
    || !validCapabilities(body.capabilities)) throw Object.assign(new Error('CREATOR_REGISTRATION_INVALID'), { status: 400 });
  let projectRoot;
  try { projectRoot = canonicalProjectRoot(body.projectRoot); }
  catch (_) { throw Object.assign(new Error('PROJECT_ROOT_INVALID'), { status: 400 }); }
  const prior = instances.get(body.instanceId);
  if (prior?.pollWaiter) { clearTimeout(prior.pollWaiter.timeout); sendEmpty(prior.pollWaiter.response); }
  if (prior?.inFlight) settle(prior, prior.inFlight.requestId, { error: { code: 'CREATOR_SESSION_REPLACED' } });
  return {
    instanceId: body.instanceId,
    sessionId: randomUUID(),
    projectRoot,
    projectName: path.basename(projectRoot),
    creatorVersion: body.creatorVersion,
    extensionVersion: body.extensionVersion,
    capabilities: body.capabilities,
    activeScene: typeof body.activeScene === 'string' ? body.activeScene.slice(0, 120) : null,
    registeredAt: new Date().toISOString(),
    lastSeenAt: Date.now(),
    pollWaiter: null,
    inFlight: null,
  };
}

function publicInstance(instance) {
  return {
    instanceId: instance.instanceId,
    projectRoot: instance.projectRoot,
    projectName: instance.projectName,
    creatorVersion: instance.creatorVersion,
    extensionVersion: instance.extensionVersion,
    activeScene: instance.activeScene,
    connected: instanceIsLive(instance),
    registeredAt: instance.registeredAt,
    lastSeenAt: new Date(instance.lastSeenAt).toISOString(),
  };
}

function sendQueued(instance, response) {
  const job = instance.inFlight;
  if (!job || job.delivered) return false;
  job.delivered = true;
  sendJson(response, 200, { requestId: job.requestId, command: job.command, input: job.input });
  return true;
}

function pollInstance(instance, body, response) {
  if (body.sessionId !== instance.sessionId) { sendFailure(response, 409, 'CREATOR_SESSION_STALE'); return; }
  instance.lastSeenAt = Date.now();
  if (body.activeScene !== undefined) instance.activeScene = typeof body.activeScene === 'string' ? body.activeScene.slice(0, 120) : null;
  if (instance.pollWaiter) { sendFailure(response, 409, 'CREATOR_POLL_ALREADY_ACTIVE'); return; }
  if (sendQueued(instance, response)) return;
  const waiter = { response, timeout: null };
  waiter.timeout = setTimeout(() => {
    if (instance.pollWaiter === waiter) instance.pollWaiter = null;
    sendEmpty(response);
  }, POLL_WAIT_MS);
  instance.pollWaiter = waiter;
}

function dispatch(instance, body, response) {
  if (!body || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    sendFailure(response, 400, 'REQUEST_ID_INVALID'); return;
  }
  const checked = validateCommand(body.command, body.input);
  if (!checked.ok) { sendFailure(response, 400, checked.code, checked.field); return; }
  const capability = instance.capabilities.find((item) => item.id === body.command);
  if (!capability || capability.status !== 'available') { sendFailure(response, 409, capability?.reason || 'COMMAND_UNAVAILABLE'); return; }
  if (instance.inFlight) { sendFailure(response, 409, 'CREATOR_INSTANCE_BUSY'); return; }
  instance.lastSeenAt = Date.now();
  return new Promise((resolve) => {
    const job = { requestId: body.requestId, command: body.command, input: body.input, delivered: false, resolve };
    job.timeout = setTimeout(() => {
      if (instance.inFlight === job) settle(instance, job.requestId, { error: { code: 'CREATOR_COMMAND_TIMEOUT' } });
    }, REQUEST_TIMEOUT_MS);
    instance.inFlight = job;
    if (instance.pollWaiter) {
      const waiter = instance.pollWaiter;
      instance.pollWaiter = null;
      clearTimeout(waiter.timeout);
      sendQueued(instance, waiter.response);
    }
  });
}

async function route(request, response) {
  if (!authorized(request)) { sendFailure(response, 401, 'BRIDGE_AUTH_REQUIRED'); return; }
  const url = new URL(request.url, 'http://127.0.0.1');
  const routeKey = `${request.method} ${url.pathname}`;
  if (routeKey === 'GET /v1/health') {
    sendJson(response, 200, { running: true, bridgeId, protocolVersion: PROTOCOL_VERSION, creatorVersion: CREATOR_VERSION,
      extensionVersion: EXTENSION_VERSION, contractFingerprint: CONTRACT_FINGERPRINT, pid: process.pid }); return;
  }
  if (routeKey === 'GET /v1/instances') {
    expireInstances();
    sendJson(response, 200, { instances: [...instances.values()].map(publicInstance) }); return;
  }
  if (routeKey === 'POST /v1/creator/register') {
    const body = await readBody(request);
    const instance = makeInstance(body);
    instances.set(instance.instanceId, instance);
    sendJson(response, 200, { sessionId: instance.sessionId, bridgeId, protocolVersion: PROTOCOL_VERSION,
      capabilities: publicCatalog(instance.capabilities) }); return;
  }
  if (routeKey === 'POST /v1/creator/poll') {
    const body = await readBody(request);
    const instance = resolveInstance(body.instanceId, response);
    if (instance) pollInstance(instance, body, response);
    return;
  }
  if (routeKey === 'POST /v1/creator/respond') {
    const body = await readBody(request);
    const instance = resolveInstance(body.instanceId, response);
    if (!instance) return;
    if (body.sessionId !== instance.sessionId) { sendFailure(response, 409, 'CREATOR_SESSION_STALE'); return; }
    if (body.ok === true) {
      if (!Object.prototype.hasOwnProperty.call(body, 'result')) { sendFailure(response, 400, 'COMMAND_RESULT_MISSING'); return; }
      if (!settle(instance, body.requestId, { result: body.result })) { sendFailure(response, 409, 'COMMAND_REQUEST_STALE'); return; }
    } else {
      const code = typeof body.error?.code === 'string' ? body.error.code.slice(0, 80) : 'CREATOR_COMMAND_FAILED';
      const message = typeof body.error?.message === 'string' ? body.error.message.slice(0, 500) : code;
      if (!settle(instance, body.requestId, { error: { code, message } })) { sendFailure(response, 409, 'COMMAND_REQUEST_STALE'); return; }
    }
    sendJson(response, 200, { accepted: true }); return;
  }
  if (routeKey === 'POST /v1/stop') {
    sendJson(response, 200, { stopped: true });
    setTimeout(stop, 25).unref();
    return;
  }
  const capsMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/capabilities$/i);
  if (request.method === 'GET' && capsMatch) {
    const instance = resolveInstance(capsMatch[1], response);
    if (instance) sendJson(response, 200, { instance: publicInstance(instance), commands: publicCatalog(instance.capabilities) });
    return;
  }
  const callMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/call$/i);
  if (request.method === 'POST' && callMatch) {
    const instance = resolveInstance(callMatch[1], response);
    if (!instance) return;
    const body = await readBody(request);
    if (instance.inFlight) { sendFailure(response, 409, 'CREATOR_INSTANCE_BUSY'); return; }
    const jobPromise = dispatch(instance, body, response);
    if (!jobPromise) return;
    const outcome = await jobPromise;
    if (response.destroyed || response.writableEnded) return;
    if (outcome.error) sendFailure(response, 409, outcome.error.code, outcome.error.message);
    else sendJson(response, 200, { requestId: body.requestId, instanceId: instance.instanceId,
      projectRoot: instance.projectRoot, creatorVersion: instance.creatorVersion,
      extensionVersion: instance.extensionVersion, command: body.command, result: outcome.result });
    return;
  }
  sendFailure(response, 404, 'BRIDGE_ROUTE_NOT_FOUND');
}

function stop() {
  if (stopping) return;
  stopping = true;
  for (const instance of instances.values()) {
    if (instance.pollWaiter) { clearTimeout(instance.pollWaiter.timeout); sendEmpty(instance.pollWaiter.response); }
    if (instance.inFlight) settle(instance, instance.inFlight.requestId, { error: { code: 'BRIDGE_STOPPED' } });
  }
  try {
    const current = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (current.bridgeId === bridgeId) fs.unlinkSync(STATE_FILE);
  } catch (_) {}
  server?.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    if (response.headersSent || response.destroyed) return;
    sendFailure(response, error.status || 500, error.message || 'BRIDGE_INTERNAL_ERROR');
  });
});
server.requestTimeout = 40000;
server.headersTimeout = 5000;
server.listen(0, '127.0.0.1', () => {
  const state = { protocolVersion: PROTOCOL_VERSION, host: '127.0.0.1', port: server.address().port,
    token, bridgeId, pid: process.pid, startedAt: new Date().toISOString() };
  const temp = `${STATE_FILE}.${randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state), { flag: 'wx', mode: 0o600 });
  fs.renameSync(temp, STATE_FILE);
  try { fs.chmodSync(STATE_FILE, 0o600); } catch (_) {}
  process.stderr.write(`Cocos Creator Agent bridge ready (${state.host}:${state.port}).\n`);
});
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
