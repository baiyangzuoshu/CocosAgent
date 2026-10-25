import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { CREATOR_VERSION, PROTOCOL_VERSION, validateCommand } from './contracts.mjs';
import { validateArguments, PROVIDER_ID, COMMAND_ID } from '../creator-extension/provider-contract.cjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI_PACKAGE = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'package.json'), 'utf8'));
const EXTENSION_PACKAGE = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, 'creator-extension/package.json'), 'utf8'));
const CONTRACT_FINGERPRINT = createHash('sha256').update(fs.readFileSync(path.join(PLUGIN_ROOT, 'creator-extension/command-contract.json'))).digest('hex');
export const DATA_ROOT = path.join(os.homedir(), '.cocos-creator-agent');
export const STATE_FILE = path.join(DATA_ROOT, 'third-party-bridge.json');

function readState() {
  let stat;
  try { stat = fs.lstatSync(STATE_FILE); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('BRIDGE_STATE_UNSAFE');
  const value = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (value.protocolVersion !== PROTOCOL_VERSION || value.host !== '127.0.0.1'
    || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535
    || typeof value.token !== 'string' || value.token.length < 48
    || typeof value.bridgeId !== 'string' || typeof value.pid !== 'number') throw new Error('BRIDGE_STATE_INVALID');
  return value;
}

export async function bridgeRequest(method, endpoint, body, { timeoutMs = 35000 } = {}) {
  const state = readState();
  if (!state) throw new Error('BRIDGE_NOT_RUNNING');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${state.port}${endpoint}`, {
      method,
      headers: { authorization: `Bearer ${state.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.code || `BRIDGE_HTTP_${response.status}`);
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('BRIDGE_REQUEST_TIMEOUT');
    throw error;
  } finally { clearTimeout(timeout); }
}

export async function ensureBridge() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('NODE_20_REQUIRED');
  const probe = async () => {
    try {
      const health = await bridgeRequest('GET', '/v1/health');
      if (health.protocolVersion !== PROTOCOL_VERSION || health.cliVersion !== CLI_PACKAGE.version || health.creatorVersion !== CREATOR_VERSION
        || health.extensionVersion !== EXTENSION_PACKAGE.version || health.contractFingerprint !== CONTRACT_FINGERPRINT) {
        try { await bridgeRequest('POST', '/v1/stop', {}); } catch (_) {}
        return null;
      }
      return readState();
    }
    catch (error) {
      if (['BRIDGE_NOT_RUNNING', 'BRIDGE_HTTP_ECONNREFUSED', 'ECONNREFUSED', 'fetch failed'].includes(error.message)) return null;
      throw error;
    }
  };
  const existing = await probe();
  if (existing) return existing;
  fs.mkdirSync(DATA_ROOT, { recursive: true, mode: 0o700 });
  const dataStat = fs.lstatSync(DATA_ROOT);
  if (!dataStat.isDirectory() || dataStat.isSymbolicLink()) throw new Error('BRIDGE_DATA_DIRECTORY_UNSAFE');
  try { fs.chmodSync(DATA_ROOT, 0o700); } catch (_) {}
  const lockPath = path.join(DATA_ROOT, 'third-party-bridge.start.lock');
  let lockFd;
  try {
    lockFd = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeSync(lockFd, String(process.pid));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const state = await probe();
      if (state) return state;
      try {
        const lockStat = fs.statSync(lockPath);
        if (Date.now() - lockStat.mtimeMs > 12000) {
          fs.unlinkSync(lockPath);
          return ensureBridge();
        }
      } catch (_) {}
    }
    throw new Error('BRIDGE_START_LOCK_TIMEOUT');
  }
  try {
    const concurrent = await probe();
    if (concurrent) return concurrent;
    const daemonPath = path.join(PLUGIN_ROOT, 'bridge', 'service.mjs');
    const child = spawn(process.execPath, [daemonPath, '--daemon'], {
      cwd: PLUGIN_ROOT, detached: true, stdio: 'ignore', env: { ...process.env, COCOS_CREATOR_AGENT_PLUGIN_ROOT: PLUGIN_ROOT },
    });
    child.unref();
    const deadline = Date.now() + 8000;
    let lastError;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      try {
        const state = await probe();
        if (state) return state;
      } catch (error) { lastError = error; }
    }
    throw new Error(`BRIDGE_START_FAILED:${lastError?.message || 'timeout'}`);
  } finally {
    try { fs.closeSync(lockFd); } catch (_) {}
    try { fs.unlinkSync(lockPath); } catch (_) {}
  }
}

export async function listInstances({ start = true } = {}) {
  if (start) await ensureBridge();
  return bridgeRequest('GET', '/v1/instances');
}

export async function listRuntimeSessions({ start = true } = {}) {
  if (start) await ensureBridge();
  return bridgeRequest('GET', '/v1/runtime-sessions');
}

export async function getRuntimeCommands(previewSessionId) {
  if (typeof previewSessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(previewSessionId))
    throw new Error('PREVIEW_SESSION_ID_INVALID');
  await ensureBridge();
  return bridgeRequest('GET', `/v1/runtime-sessions/${encodeURIComponent(previewSessionId)}/commands`);
}

export async function callRuntimeCommand(previewSessionId, providerId, commandId, input = {}, { expectedFingerprint } = {}) {
  if (typeof previewSessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(previewSessionId))
    throw new Error('PREVIEW_SESSION_ID_INVALID');
  if (typeof providerId !== 'string' || !PROVIDER_ID.test(providerId)) throw new Error('RUNTIME_PROVIDER_ID_INVALID');
  if (typeof commandId !== 'string' || !COMMAND_ID.test(commandId)) throw new Error('RUNTIME_COMMAND_ID_INVALID');
  if (typeof expectedFingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(expectedFingerprint))
    throw new Error('RUNTIME_PROVIDER_FINGERPRINT_REQUIRED');
  const catalog = await getRuntimeCommands(previewSessionId);
  const command = catalog.commands?.find((item) => item.providerId === providerId && item.id === commandId);
  if (!command || command.status !== 'available') throw new Error('RUNTIME_COMMAND_NOT_AVAILABLE');
  if (command.providerFingerprint !== expectedFingerprint) throw new Error('RUNTIME_PROVIDER_CHANGED');
  validateArguments(command.input, input);
  return bridgeRequest('POST', `/v1/runtime-sessions/${encodeURIComponent(previewSessionId)}/commands`, {
    providerId, commandId, providerFingerprint: expectedFingerprint, arguments: input,
  }, { timeoutMs: 40000 });
}

export async function disconnectInstance(instanceId, processId) {
  if (typeof instanceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(instanceId)) throw new Error('INSTANCE_ID_REQUIRED');
  if (!Number.isSafeInteger(processId) || processId < 1 || processId > 2147483647) throw new Error('PROCESS_ID_INVALID');
  return bridgeRequest('POST', `/v1/instances/${encodeURIComponent(instanceId)}/disconnect`, { processId });
}

export async function getCapabilities(instanceId, { start = true } = {}) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  if (start) await ensureBridge();
  return bridgeRequest('GET', `/v1/instances/${encodeURIComponent(instanceId)}/capabilities`);
}

export async function callCommand(instanceId, command, input = {}, { timeoutMs } = {}) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  const checked = validateCommand(command, input);
  if (!checked.ok) throw new Error(checked.code);
  await ensureBridge();
  const defaultTimeout = ['write', 'control'].includes(checked.command.access) ? 190000 : 35000;
  return bridgeRequest('POST', `/v1/instances/${encodeURIComponent(instanceId)}/call`, {
    requestId: randomUUID(), command, input,
  }, { timeoutMs: timeoutMs === undefined ? defaultTimeout : timeoutMs });
}

export async function getProjectTools(instanceId) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  await ensureBridge();
  return bridgeRequest('GET', `/v1/instances/${encodeURIComponent(instanceId)}/project-tools`);
}

export async function getExtensionCommands(instanceId) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  await ensureBridge();
  return bridgeRequest('GET', `/v1/instances/${encodeURIComponent(instanceId)}/extension-commands`);
}

export async function callExtensionCommand(instanceId, providerId, commandId, input = {}, { expectedFingerprint } = {}) {
  if (typeof providerId !== 'string' || !PROVIDER_ID.test(providerId)) throw new Error('EXTENSION_PROVIDER_ID_INVALID');
  if (typeof commandId !== 'string' || !COMMAND_ID.test(commandId)) throw new Error('EXTENSION_COMMAND_ID_INVALID');
  const catalog = await getExtensionCommands(instanceId);
  const command = catalog.commands?.find((item) => item.providerId === providerId && item.id === commandId);
  if (!command || command.status !== 'available') throw new Error('EXTENSION_COMMAND_NOT_AVAILABLE');
  if (expectedFingerprint && command.providerFingerprint !== expectedFingerprint) throw new Error('EXTENSION_COMMAND_CATALOG_CHANGED');
  validateArguments(command.input, input);
  const commandIdInContract = `creator.extension.command.invoke.${command.access}`;
  const wrappedInput = { providerId, commandId, providerFingerprint: command.providerFingerprint,
    argumentsJson: JSON.stringify(input) };
  const receipt = await callCommand(instanceId, commandIdInContract, wrappedInput);
  return { ...receipt, extensionCommand: { providerId, commandId, access: command.access,
    providerFingerprint: command.providerFingerprint, catalogHash: catalog.catalogHash } };
}

export async function callProjectTool(instanceId, toolId, input = {}, { expectedRegistryHash } = {}) {
  if (typeof toolId !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(toolId)) throw new Error('PROJECT_TOOL_ID_INVALID');
  const catalog = await getProjectTools(instanceId);
  if (expectedRegistryHash && catalog.registryHash !== expectedRegistryHash) throw new Error('PROJECT_TOOL_REGISTRY_CHANGED');
  const tool = catalog.tools?.find((item) => item.id === toolId);
  if (!tool) throw new Error('PROJECT_TOOL_NOT_FOUND');
  const receipt = await callCommand(instanceId, tool.commandId, input);
  return { ...receipt, projectTool: { id: tool.id, title: tool.title, registryHash: catalog.registryHash,
    commandId: tool.commandId } };
}

export async function startTask(instanceId, command, input = {}) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  await ensureBridge();
  return bridgeRequest('POST', `/v1/instances/${encodeURIComponent(instanceId)}/tasks`, { command, input }, { timeoutMs: 35000 });
}

export async function listTasks(instanceId) {
  if (instanceId !== undefined && (typeof instanceId !== 'string' || !instanceId)) throw new Error('INSTANCE_ID_INVALID');
  await ensureBridge();
  return bridgeRequest('GET', `/v1/tasks${instanceId ? `?instanceId=${encodeURIComponent(instanceId)}` : ''}`);
}

export async function getTask(taskId) {
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId)) throw new Error('TASK_ID_INVALID');
  await ensureBridge();
  return bridgeRequest('GET', `/v1/tasks/${encodeURIComponent(taskId)}`);
}

export async function waitTask(taskId, { afterSequence = 0, waitMs = 25000 } = {}) {
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId)) throw new Error('TASK_ID_INVALID');
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) throw new Error('TASK_EVENT_CURSOR_INVALID');
  if (!Number.isSafeInteger(waitMs) || waitMs < 0 || waitMs > 30000) throw new Error('TASK_WAIT_DURATION_INVALID');
  await ensureBridge();
  const query = new URLSearchParams({ afterSequence: String(afterSequence), waitMs: String(waitMs) });
  return bridgeRequest('GET', `/v1/tasks/${encodeURIComponent(taskId)}/wait?${query}`, undefined,
    { timeoutMs: waitMs + 5000 });
}

export async function cancelTask(taskId) {
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId)) throw new Error('TASK_ID_INVALID');
  await ensureBridge();
  return bridgeRequest('POST', `/v1/tasks/${encodeURIComponent(taskId)}/cancel`, {});
}

export async function resumeTask(instanceId, taskId) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  if (typeof taskId !== 'string' || !/^[0-9a-f-]{36}$/i.test(taskId)) throw new Error('TASK_ID_INVALID');
  await ensureBridge();
  return bridgeRequest('POST', `/v1/instances/${encodeURIComponent(instanceId)}/tasks/${encodeURIComponent(taskId)}/resume`, {});
}

export async function bridgeStatus() {
  const state = readState();
  if (!state) return { running: false };
  try { return { running: true, ...(await bridgeRequest('GET', '/v1/health')) }; }
  catch (error) { return { running: false, staleState: true, error: error.message, pid: state.pid }; }
}

export async function stopBridge() {
  if (!readState()) return { stopped: false, reason: 'NOT_RUNNING' };
  return bridgeRequest('POST', '/v1/stop', {});
}

export function pluginRoot() { return PLUGIN_ROOT; }
