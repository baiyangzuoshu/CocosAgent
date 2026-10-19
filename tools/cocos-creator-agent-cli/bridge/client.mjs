import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PROTOCOL_VERSION, validateCommand } from './contracts.mjs';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

export async function bridgeRequest(method, endpoint, body) {
  const state = readState();
  if (!state) throw new Error('BRIDGE_NOT_RUNNING');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
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
    try { await bridgeRequest('GET', '/v1/health'); return readState(); }
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

export async function listInstances() {
  await ensureBridge();
  return bridgeRequest('GET', '/v1/instances');
}

export async function getCapabilities(instanceId) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  await ensureBridge();
  return bridgeRequest('GET', `/v1/instances/${encodeURIComponent(instanceId)}/capabilities`);
}

export async function callCommand(instanceId, command, input = {}) {
  if (typeof instanceId !== 'string' || !instanceId) throw new Error('INSTANCE_ID_REQUIRED');
  const checked = validateCommand(command, input);
  if (!checked.ok) throw new Error(checked.code);
  await ensureBridge();
  return bridgeRequest('POST', `/v1/instances/${encodeURIComponent(instanceId)}/call`, {
    requestId: randomUUID(), command, input,
  });
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
