import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CREATOR_VERSION, PROTOCOL_VERSION, COMMANDS, validateCommand, publicCatalog } from './contracts.mjs';
import { previewCommand, previewHostCapabilities, startPreview, stopAllPreviews, stopInstancePreviews } from './runtime-preview.mjs';
import { readProjectTools } from './project-tools.mjs';
import { loadTaskRecords, writeTaskRecord } from './task-store.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = path.join(os.homedir(), '.cocos-creator-agent');
const STATE_FILE = path.join(DATA_ROOT, 'third-party-bridge.json');
const MAX_BODY_BYTES = 1024 * 1024;
const INSTANCE_TTL_MS = 45000;
const POLL_WAIT_MS = 25000;
const REQUEST_TIMEOUT_MS = 30000;
const WRITE_REQUEST_TIMEOUT_MS = 180000;
const CONTROL_REQUEST_TIMEOUT_MS = 180000;
const CLI_VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8')).version;
const EXTENSION_VERSION = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'creator-extension/package.json'), 'utf8')).version;
const CONTRACT_FINGERPRINT = createHash('sha256')
  .update(fs.readFileSync(path.join(PLUGIN_ROOT, 'creator-extension/command-contract.json'))).digest('hex');
const instances = new Map();
const activeTaskByInstance = new Map();
const taskWaiters = new Map();
const TASK_WAIT_MAX_MS = 30000;
const MAX_TASK_WAITERS = 128;

if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('NODE_20_REQUIRED');
fs.mkdirSync(DATA_ROOT, { recursive: true, mode: 0o700 });
const rootStat = fs.lstatSync(DATA_ROOT);
if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('BRIDGE_DATA_DIRECTORY_UNSAFE');
try { fs.chmodSync(DATA_ROOT, 0o700); } catch (_) {}
const tasks = loadTaskRecords();
for (const task of tasks.values()) {
  if (!['queued', 'running', 'cancel-requested'].includes(task.status)) continue;
  const access = COMMANDS.get(task.command)?.access;
  task.status = !task.executionStarted || access === 'read' ? 'interrupted' : 'needs-reconciliation';
  task.interruption = 'bridge-restarted';
  task.updatedAt = new Date().toISOString();
  appendTaskEvent(task, task.status, { reason: task.interruption });
  writeTaskRecord(task);
}

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

function coded(code, status = 409, detail) {
  return Object.assign(new Error(code), { code, status, detail });
}

function appendTaskEvent(task, type, details = {}) {
  if (!Array.isArray(task.events)) task.events = [];
  const previous = task.events.reduce((highest, event) => Math.max(highest, Number(event?.sequence) || 0), 0);
  task.eventSequence = Math.max(Number(task.eventSequence) || 0, previous) + 1;
  task.events.push({ sequence: task.eventSequence, type, at: new Date().toISOString(), ...details });
  if (task.events.length > 24) task.events.splice(0, task.events.length - 24);
}

function persistTask(task, type, details = {}) {
  task.updatedAt = new Date().toISOString();
  if (type) appendTaskEvent(task, type, details);
  writeTaskRecord(task);
  resolveTaskWaiters(task);
}

function taskView(task, { includeResult = true } = {}) {
  const inputHash = createHash('sha256').update(JSON.stringify(task.input || {})).digest('hex');
  return {
    taskId: task.taskId, command: task.command, status: task.status, instanceId: task.instanceId,
    projectRoot: task.projectRoot, creatorVersion: task.creatorVersion, extensionVersion: task.extensionVersion,
    cliVersion: task.cliVersion,
    createdAt: task.createdAt, updatedAt: task.updatedAt, attempts: task.attempts,
    eventSequence: Number(task.eventSequence) || 0,
    inputSha256: inputHash, executionStarted: !!task.executionStarted,
    ...(task.resumingWith ? { resumingWith: task.resumingWith } : {}),
    ...(task.cancelRequestedAt ? { cancelRequestedAt: task.cancelRequestedAt } : {}),
    ...(task.interruption ? { interruption: task.interruption } : {}),
    ...(task.error ? { error: task.error } : {}),
    ...(includeResult && task.result !== undefined ? { result: task.result } : {}),
    events: task.events || [],
  };
}

function errorMessage(error) {
  return String(error?.message || error || 'TASK_FAILED').slice(0, 500);
}

function boundedTaskResult(value) {
  let encoded;
  try { encoded = JSON.stringify(value); }
  catch (_) { return { truncated: true, reason: 'RESULT_NOT_SERIALIZABLE' }; }
  const bytes = Buffer.from(encoded || 'null', 'utf8');
  if (bytes.length <= 1024 * 1024) return value;
  return { truncated: true, byteLength: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    jsonPreview: bytes.subarray(0, 256 * 1024).toString('utf8') };
}

function taskIsTerminal(task) {
  return ['completed', 'failed', 'cancelled'].includes(task.status);
}

function removeTaskWaiter(task, waiter) {
  const waiters = taskWaiters.get(task.taskId);
  if (!waiters) return;
  waiters.delete(waiter);
  if (!waiters.size) taskWaiters.delete(task.taskId);
}

function settleTaskWaiter(task, waiter, details = {}) {
  if (waiter.settled) return;
  waiter.settled = true;
  clearTimeout(waiter.timeout);
  waiter.response.removeListener('close', waiter.onClose);
  removeTaskWaiter(task, waiter);
  if (!waiter.response.destroyed && !waiter.response.writableEnded)
    sendJson(waiter.response, 200, { ...taskView(task), ...details });
}

function resolveTaskWaiters(task) {
  const waiters = taskWaiters.get(task.taskId);
  if (!waiters) return;
  for (const waiter of [...waiters]) {
    if (task.eventSequence > waiter.afterSequence || taskIsTerminal(task)) settleTaskWaiter(task, waiter);
  }
}

function waitForTaskEvent(task, response, afterSequence, waitMs) {
  if (task.eventSequence > afterSequence || taskIsTerminal(task)) {
    sendJson(response, 200, taskView(task));
    return;
  }
  let waiterCount = 0;
  for (const waiters of taskWaiters.values()) waiterCount += waiters.size;
  if (waiterCount >= MAX_TASK_WAITERS) { sendFailure(response, 429, 'TASK_WAITER_LIMIT'); return; }
  const waiter = { response, afterSequence, timeout: null, settled: false, onClose: null };
  waiter.onClose = () => {
    if (waiter.settled) return;
    waiter.settled = true;
    clearTimeout(waiter.timeout);
    removeTaskWaiter(task, waiter);
  };
  waiter.timeout = setTimeout(() => settleTaskWaiter(task, waiter, { waitTimedOut: true }), waitMs);
  response.once('close', waiter.onClose);
  if (!taskWaiters.has(task.taskId)) taskWaiters.set(task.taskId, new Set());
  taskWaiters.get(task.taskId).add(waiter);
}

function activeTask(instanceId) {
  const taskId = activeTaskByInstance.get(instanceId);
  const task = taskId ? tasks.get(taskId) : null;
  if (!task || taskIsTerminal(task) || ['interrupted', 'needs-reconciliation'].includes(task.status)) {
    activeTaskByInstance.delete(instanceId);
    return null;
  }
  return task;
}

function instanceIsLive(instance) {
  const activeCommand = instance.inFlight && COMMANDS.get(instance.inFlight.command);
  const ttl = ['write', 'control'].includes(activeCommand?.access) ? Math.max(WRITE_REQUEST_TIMEOUT_MS, CONTROL_REQUEST_TIMEOUT_MS) + 10000 : INSTANCE_TTL_MS;
  return Date.now() - instance.lastSeenAt <= ttl;
}

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
    void stopInstancePreviews(instance.instanceId, instance.sessionId);
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
  if (prior) void stopInstancePreviews(prior.instanceId, prior.sessionId);
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

function capabilityCatalog(instance) {
  const creator = instance.capabilities.filter((item) => COMMANDS.get(item.id)?.execution !== 'bridge');
  const creatorPreview = creator.find((item) => item.id === 'creator.preview.start');
  return publicCatalog([...creator.filter((item) => item.id !== 'creator.preview.start'),
    ...previewHostCapabilities(creatorPreview?.status === 'available')]);
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

function dispatch(instance, body, { taskId = null } = {}) {
  if (!body || typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    throw coded('REQUEST_ID_INVALID', 400);
  }
  const checked = validateCommand(body.command, body.input);
  if (!checked.ok) throw coded(checked.code, 400, checked.field);
  const bridgeOwned = checked.command.execution === 'bridge';
  const capability = bridgeOwned ? null : body.command === 'creator.preview.start'
    ? capabilityCatalog(instance).find((item) => item.id === body.command)
    : instance.capabilities.find((item) => item.id === body.command);
  if (!bridgeOwned && (!capability || capability.status !== 'available'))
    throw coded(capability?.reason || 'COMMAND_UNAVAILABLE');
  const active = activeTask(instance.instanceId);
  if (instance.inFlight || (active && active.taskId !== taskId)) throw coded('CREATOR_INSTANCE_BUSY');
  instance.lastSeenAt = Date.now();
  return new Promise((resolve) => {
    const job = { requestId: body.requestId, command: body.command, input: body.input, delivered: bridgeOwned, resolve, taskId };
    if (bridgeOwned) job.cancelled = false;
    job.timeout = setTimeout(() => {
      if (instance.inFlight === job) {
        job.cancelled = true;
        settle(instance, job.requestId, { error: { code: 'CREATOR_COMMAND_TIMEOUT' } });
      }
    }, checked.command.access === 'write' ? WRITE_REQUEST_TIMEOUT_MS
      : checked.command.access === 'control' ? CONTROL_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    instance.inFlight = job;
    if (bridgeOwned) {
      Promise.resolve().then(() => previewCommand(body.command, instance, body.input, () => job.cancelled)).then((result) => {
        if (instance.inFlight === job) settle(instance, job.requestId, { result });
      }, (error) => {
        if (instance.inFlight === job) settle(instance, job.requestId, { error: { code: error.code || 'PREVIEW_COMMAND_FAILED', message: error.message } });
      });
    } else if (instance.pollWaiter) {
      const waiter = instance.pollWaiter;
      instance.pollWaiter = null;
      clearTimeout(waiter.timeout);
      sendQueued(instance, waiter.response);
    }
  });
}

function createTask(instance, command, input) {
  const checked = validateCommand(command, input);
  if (!checked.ok) throw coded(checked.code, 400, checked.field);
  if (instance.inFlight || activeTask(instance.instanceId)) throw coded('CREATOR_INSTANCE_BUSY');
  const now = new Date().toISOString();
  const task = {
    schemaVersion: 1, taskId: randomUUID(), command, input,
    instanceId: instance.instanceId, sessionId: instance.sessionId,
    projectRoot: instance.projectRoot, creatorVersion: instance.creatorVersion,
    extensionVersion: instance.extensionVersion, cliVersion: CLI_VERSION, contractFingerprint: CONTRACT_FINGERPRINT,
    status: 'queued', createdAt: now, updatedAt: now, attempts: 0,
    executionStarted: false, events: [],
  };
  appendTaskEvent(task, 'queued');
  writeTaskRecord(task);
  tasks.set(task.taskId, task);
  activeTaskByInstance.set(instance.instanceId, task.taskId);
  setImmediate(() => { void executeTask(task, instance); });
  return task;
}

async function executeTask(task, instance, { command = task.command, input = task.input, recovery = false } = {}) {
  if (stopping || task.status === 'cancelled'
    || activeTaskByInstance.get(instance.instanceId) !== task.taskId) return;
  const requestId = randomUUID();
  task.status = 'running';
  task.sessionId = instance.sessionId;
  task.executionStarted = true;
  task.attempts += 1;
  task.error = null;
  task.result = undefined;
  task.resumingWith = recovery ? command : undefined;
  task.startedAt = new Date().toISOString();
  task.currentRequestId = requestId;
  persistTask(task, recovery ? 'resuming' : 'running', { command });
  try {
    const outcome = await dispatch(instance, { requestId, command, input }, { taskId: task.taskId });
    if (outcome.error) throw coded(outcome.error.code || 'CREATOR_COMMAND_FAILED', 409, outcome.error.message);
    let result = outcome.result;
    if (command === 'creator.preview.start') {
      result = await startPreview(instance, result, input || {}, () => !!task.cancelRequestedAt);
    }
    task.result = boundedTaskResult(result);
    task.completedAt = new Date().toISOString();
    task.status = 'completed';
    task.recoveryResult = recovery ? { command, completedAt: task.completedAt } : undefined;
    task.interruption = undefined;
    persistTask(task, 'completed', { command });
  } catch (error) {
    const code = error.code || error.message || 'TASK_FAILED';
    task.error = { code: String(code).slice(0, 100), message: errorMessage(error) };
    const access = COMMANDS.get(task.command)?.access;
    const approvedActionDeclined = ['TASK_CANCELLED_BEFORE_DELIVERY', 'WRITE_REQUEST_NOT_ACTIVE', 'WRITE_REQUEST_NO_LONGER_ACTIVE',
      'PREVIEW_REQUEST_NO_LONGER_ACTIVE', 'PREVIEW_NOT_APPROVED', 'OPERATION_NOT_APPROVED'].includes(String(code));
    if (recovery) {
      task.status = 'needs-reconciliation';
      task.interruption = 'reconcile-failed';
    } else if (approvedActionDeclined) {
      task.status = 'cancelled';
      task.interruption = undefined;
    } else if (task.cancelRequestedAt) {
      task.status = (access === 'write' || (access === 'control' && COMMANDS.get(task.command)?.approval === true))
        ? 'needs-reconciliation' : 'cancelled';
      task.interruption = task.status === 'needs-reconciliation' ? 'cancelled-after-dispatch-side-effect-uncertain' : undefined;
    } else if (['CREATOR_INSTANCE_DISCONNECTED', 'CREATOR_SESSION_REPLACED', 'BRIDGE_STOPPED',
      'CREATOR_COMMAND_TIMEOUT', 'BRIDGE_REQUEST_TIMEOUT'].includes(String(code))) {
      task.status = access === 'read' ? 'interrupted' : 'needs-reconciliation';
      task.interruption = String(code);
    } else {
      task.status = 'failed';
    }
    persistTask(task, task.status, { code: task.error.code });
  } finally {
    if (activeTaskByInstance.get(instance.instanceId) === task.taskId) activeTaskByInstance.delete(instance.instanceId);
    task.currentRequestId = null;
    persistTask(task);
  }
}

function cancelTask(task) {
  if (taskIsTerminal(task) || ['interrupted', 'needs-reconciliation'].includes(task.status)) return task;
  if (!task.executionStarted && task.status === 'queued') {
    task.status = 'cancelled';
    task.completedAt = new Date().toISOString();
    if (activeTaskByInstance.get(task.instanceId) === task.taskId) activeTaskByInstance.delete(task.instanceId);
    persistTask(task, 'cancelled', { beforeDispatch: true });
    return task;
  }
  if (!task.cancelRequestedAt) {
    task.cancelRequestedAt = new Date().toISOString();
    task.status = 'cancel-requested';
    const instance = instances.get(task.instanceId);
    const job = instance?.inFlight;
    if (job && job.taskId === task.taskId && instance.sessionId === task.sessionId) {
      job.cancelled = true;
      if (!job.delivered) settle(instance, job.requestId, { error: { code: 'TASK_CANCELLED_BEFORE_DELIVERY' } });
    }
    persistTask(task, 'cancel-requested', { cooperative: true });
  }
  return task;
}

function resumeTask(task, instance) {
  if (!['interrupted', 'needs-reconciliation'].includes(task.status)) throw coded('TASK_NOT_RESUMABLE');
  if (task.projectRoot !== instance.projectRoot || task.creatorVersion !== instance.creatorVersion
    || task.extensionVersion !== instance.extensionVersion || task.cliVersion !== CLI_VERSION
    || task.contractFingerprint !== CONTRACT_FINGERPRINT)
    throw coded('TASK_TARGET_IDENTITY_MISMATCH');
  if (instance.inFlight || activeTask(instance.instanceId)) throw coded('CREATOR_INSTANCE_BUSY');
  let command = task.command;
  let input = task.input;
  let recovery = false;
  const original = COMMANDS.get(task.command);
  if (task.executionStarted && original?.access !== 'read') {
    if (task.command === 'creator.script.create.commit' && typeof task.input?.operationId === 'string') {
      command = 'creator.script.create.reconcile';
      input = { operationId: task.input.operationId };
      recovery = true;
    } else if (task.command === 'creator.scene.node.set-active.commit' && typeof task.input?.operationId === 'string') {
      command = 'creator.scene.node.set-active.reconcile';
      input = { operationId: task.input.operationId };
      recovery = true;
    } else {
      throw coded('TASK_MANUAL_RECONCILIATION_REQUIRED');
    }
  }
  const checked = validateCommand(command, input);
  if (!checked.ok) throw coded(checked.code, 400, checked.field);
  task.status = 'queued';
  task.cancelRequestedAt = null;
  task.interruption = undefined;
  task.lastResumeRequestedAt = new Date().toISOString();
  task.recoveryRequested = recovery;
  persistTask(task, 'resume-requested', { command });
  activeTaskByInstance.set(instance.instanceId, task.taskId);
  setImmediate(() => { void executeTask(task, instance, { command, input, recovery }); });
  return task;
}

function sortedTasks(records) {
  return [...records].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

async function route(request, response) {
  if (!authorized(request)) { sendFailure(response, 401, 'BRIDGE_AUTH_REQUIRED'); return; }
  const url = new URL(request.url, 'http://127.0.0.1');
  const routeKey = `${request.method} ${url.pathname}`;
  if (routeKey === 'GET /v1/health') {
    sendJson(response, 200, { running: true, bridgeId, protocolVersion: PROTOCOL_VERSION, cliVersion: CLI_VERSION,
      creatorVersion: CREATOR_VERSION,
      extensionVersion: EXTENSION_VERSION, contractFingerprint: CONTRACT_FINGERPRINT, pid: process.pid }); return;
  }
  if (routeKey === 'GET /v1/instances') {
    expireInstances();
    sendJson(response, 200, { instances: [...instances.values()].map(publicInstance) }); return;
  }
  const projectToolsMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/project-tools$/i);
  if (request.method === 'GET' && projectToolsMatch) {
    const instance = resolveInstance(projectToolsMatch[1], response);
    if (!instance) return;
    const registry = readProjectTools(instance.projectRoot);
    const tools = registry.tools.map((tool) => {
      const capability = instance.capabilities.find((item) => item.id === tool.commandId);
      return { ...tool, status: capability?.status === 'available' ? 'available' : 'unavailable',
        reason: capability?.status === 'available' ? null : (capability?.reason || 'COMMAND_NOT_ADVERTISED') };
    });
    sendJson(response, 200, { instance: publicInstance(instance), ...registry, tools }); return;
  }
  if (routeKey === 'POST /v1/creator/register') {
    const body = await readBody(request);
    const instance = makeInstance(body);
    instances.set(instance.instanceId, instance);
    sendJson(response, 200, { sessionId: instance.sessionId, bridgeId, protocolVersion: PROTOCOL_VERSION,
      capabilities: capabilityCatalog(instance) }); return;
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
  if (routeKey === 'POST /v1/creator/authorize-write') {
    const body = await readBody(request);
    const instance = resolveInstance(body.instanceId, response);
    if (!instance) return;
    if (body.sessionId !== instance.sessionId) { sendFailure(response, 409, 'CREATOR_SESSION_STALE'); return; }
    const job = instance.inFlight;
    if (!job || job.requestId !== body.requestId || job.cancelled) { sendFailure(response, 409, 'WRITE_REQUEST_NOT_ACTIVE'); return; }
    const command = COMMANDS.get(job.command);
    if (!command || !(command.access === 'write' || (command.access === 'control' && command.approval === true))) {
      sendFailure(response, 403, 'APPROVED_ACTION_REQUIRED'); return;
    }
    instance.lastSeenAt = Date.now();
    sendJson(response, 200, { active: true, requestId: job.requestId }); return;
  }
  if (routeKey === 'POST /v1/stop') {
    sendJson(response, 200, { stopped: true });
    setTimeout(stop, 25).unref();
    return;
  }
  const instanceTasksMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/tasks$/i);
  if (request.method === 'GET' && instanceTasksMatch) {
    const instance = resolveInstance(instanceTasksMatch[1], response);
    if (!instance) return;
    const items = sortedTasks([...tasks.values()].filter((task) => task.instanceId === instance.instanceId)).slice(0, 100);
    sendJson(response, 200, { tasks: items.map((task) => taskView(task, { includeResult: false })) }); return;
  }
  if (request.method === 'POST' && instanceTasksMatch) {
    const instance = resolveInstance(instanceTasksMatch[1], response);
    if (!instance) return;
    const body = await readBody(request);
    const task = createTask(instance, body.command, body.input);
    response.once('close', () => {
      if (!response.writableEnded) cancelTask(task);
    });
    sendJson(response, 202, taskView(task)); return;
  }
  const taskStatusMatch = url.pathname.match(/^\/v1\/tasks\/([0-9a-f-]{36})$/i);
  const taskWaitMatch = url.pathname.match(/^\/v1\/tasks\/([0-9a-f-]{36})\/wait$/i);
  if (request.method === 'GET' && taskWaitMatch) {
    const task = tasks.get(taskWaitMatch[1]);
    if (!task) { sendFailure(response, 404, 'TASK_NOT_FOUND'); return; }
    const rawCursor = url.searchParams.get('afterSequence');
    const rawWait = url.searchParams.get('waitMs');
    const afterSequence = rawCursor === null ? 0 : Number(rawCursor);
    const waitMs = rawWait === null ? 25000 : Number(rawWait);
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0 || afterSequence > task.eventSequence) {
      sendFailure(response, 400, 'TASK_EVENT_CURSOR_INVALID'); return;
    }
    if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > TASK_WAIT_MAX_MS) {
      sendFailure(response, 400, 'TASK_WAIT_DURATION_INVALID'); return;
    }
    waitForTaskEvent(task, response, afterSequence, waitMs); return;
  }
  if (request.method === 'GET' && taskStatusMatch) {
    const task = tasks.get(taskStatusMatch[1]);
    if (!task) { sendFailure(response, 404, 'TASK_NOT_FOUND'); return; }
    sendJson(response, 200, taskView(task)); return;
  }
  if (request.method === 'GET' && routeKey === 'GET /v1/tasks') {
    const filterInstance = url.searchParams.get('instanceId');
    if (filterInstance && !/^[0-9a-f-]{36}$/i.test(filterInstance)) { sendFailure(response, 400, 'INSTANCE_ID_INVALID'); return; }
    const items = sortedTasks([...tasks.values()].filter((task) => !filterInstance || task.instanceId === filterInstance)).slice(0, 100);
    sendJson(response, 200, { tasks: items.map((task) => taskView(task, { includeResult: false })) }); return;
  }
  const taskCancelMatch = url.pathname.match(/^\/v1\/tasks\/([0-9a-f-]{36})\/cancel$/i);
  if (request.method === 'POST' && taskCancelMatch) {
    const task = tasks.get(taskCancelMatch[1]);
    if (!task) { sendFailure(response, 404, 'TASK_NOT_FOUND'); return; }
    sendJson(response, 200, taskView(cancelTask(task))); return;
  }
  const taskResumeMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/tasks\/([0-9a-f-]{36})\/resume$/i);
  if (request.method === 'POST' && taskResumeMatch) {
    const instance = resolveInstance(taskResumeMatch[1], response);
    if (!instance) return;
    const task = tasks.get(taskResumeMatch[2]);
    if (!task) { sendFailure(response, 404, 'TASK_NOT_FOUND'); return; }
    if (task.instanceId !== instance.instanceId) { sendFailure(response, 409, 'TASK_INSTANCE_MISMATCH'); return; }
    sendJson(response, 202, taskView(resumeTask(task, instance))); return;
  }
  const capsMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/capabilities$/i);
  if (request.method === 'GET' && capsMatch) {
    const instance = resolveInstance(capsMatch[1], response);
    if (instance) sendJson(response, 200, { instance: publicInstance(instance), commands: capabilityCatalog(instance) });
    return;
  }
  const callMatch = url.pathname.match(/^\/v1\/instances\/([0-9a-f-]{36})\/call$/i);
  if (request.method === 'POST' && callMatch) {
    const instance = resolveInstance(callMatch[1], response);
    if (!instance) return;
    const body = await readBody(request);
    const jobPromise = dispatch(instance, body);
    let callerCancelled = false;
    const cancelOnDisconnect = () => {
      callerCancelled = true;
      if (!response.writableEnded && instance.inFlight?.requestId === body.requestId) {
        instance.inFlight.cancelled = true;
        settle(instance, body.requestId, { error: { code: 'CALLER_DISCONNECTED' } });
      }
    };
    response.once('close', cancelOnDisconnect);
    let outcome;
    try {
      outcome = await jobPromise;
      if (response.destroyed || response.writableEnded || callerCancelled) return;
      if (!outcome.error && body.command === 'creator.preview.start') {
        try { outcome = { result: await startPreview(instance, outcome.result, body.input || {}, () => callerCancelled) }; }
        catch (error) { outcome = { error: { code: error.code || 'PREVIEW_START_FAILED', message: error.message || String(error) } }; }
      }
      if (response.destroyed || response.writableEnded || callerCancelled) {
        if (body.command === 'creator.preview.start') await stopInstancePreviews(instance.instanceId, instance.sessionId);
        return;
      }
      if (outcome.error) sendFailure(response, 409, outcome.error.code, outcome.error.message);
      else sendJson(response, 200, { requestId: body.requestId, instanceId: instance.instanceId,
        projectRoot: instance.projectRoot, creatorVersion: instance.creatorVersion,
        extensionVersion: instance.extensionVersion, command: body.command, result: outcome.result });
    } finally {
      response.removeListener('close', cancelOnDisconnect);
    }
    return;
  }
  sendFailure(response, 404, 'BRIDGE_ROUTE_NOT_FOUND');
}

function stop() {
  if (stopping) return;
  stopping = true;
  void stopAllPreviews();
  for (const instance of instances.values()) {
    if (instance.pollWaiter) { clearTimeout(instance.pollWaiter.timeout); sendEmpty(instance.pollWaiter.response); }
    if (instance.inFlight) settle(instance, instance.inFlight.requestId, { error: { code: 'BRIDGE_STOPPED' } });
  }
  for (const task of tasks.values()) {
    if (!['queued', 'running', 'cancel-requested'].includes(task.status)) continue;
    const access = COMMANDS.get(task.command)?.access;
    task.status = !task.executionStarted || access === 'read' ? 'interrupted' : 'needs-reconciliation';
    task.interruption = 'bridge-stopped';
    task.currentRequestId = null;
    persistTask(task, task.status, { reason: task.interruption });
  }
  for (const [taskId, waiters] of taskWaiters) {
    const task = tasks.get(taskId);
    if (!task) continue;
    for (const waiter of [...waiters]) settleTaskWaiter(task, waiter, { bridgeStopped: true });
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
    sendFailure(response, error.status || 500, error.code || error.message || 'BRIDGE_INTERNAL_ERROR', error.detail);
  });
});
server.requestTimeout = 210000;
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
