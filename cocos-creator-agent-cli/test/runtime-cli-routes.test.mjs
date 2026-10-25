import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const servicePath = path.join(packageRoot, 'bridge/service.mjs');
const cliPath = path.join(packageRoot, 'cli.mjs');

async function waitForBridge(statePath, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Bridge exited early (${child.exitCode}).`);
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const response = await fetch(`http://127.0.0.1:${state.port}/v1/health`, {
        headers: { authorization: `Bearer ${state.token}` },
      });
      if (response.ok) return state;
    } catch (_) {}
    await delay(50);
  }
  throw new Error('Timed out waiting for the test bridge to start.');
}

function request(state, method, route, body) {
  return fetch(`http://127.0.0.1:${state.port}${route}`, {
    method,
    headers: { authorization: `Bearer ${state.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args, '--format', 'json'], {
      cwd: packageRoot, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) { reject(new Error(stderr || stdout)); return; }
      try { resolve(JSON.parse(stdout)); }
      catch (_) { reject(new Error(`CLI returned invalid JSON: ${stdout}`)); }
    });
  });
}

test('runtime CLI lists sessions and reports missing Preview sessions through the Bridge routes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-cli-runtime-routes-'));
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  const statePath = path.join(home, '.cocos-creator-agent/third-party-bridge.json');
  const child = spawn(process.execPath, [servicePath], { cwd: packageRoot, env: { ...process.env, HOME: home },
    stdio: ['ignore', 'ignore', 'pipe'] });
  let serviceStderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => { serviceStderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2000)]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const state = await waitForBridge(statePath, child).catch((error) => {
    throw new Error(`${error.message}\n${serviceStderr}`);
  });
  const env = { ...process.env, HOME: home };
  assert.deepEqual(await runCli(['runtime', 'sessions', 'list'], env), { sessions: [] });

  const sessionId = '11111111-1111-4111-8111-111111111111';
  const missing = await request(state, 'GET', `/v1/runtime-sessions/${sessionId}/commands`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'PREVIEW_SESSION_NOT_FOUND');
  await assert.rejects(runCli(['runtime', 'commands', 'list', '--session', sessionId], env), /PREVIEW_SESSION_NOT_FOUND/);
  await assert.rejects(runCli(['runtime', 'command', 'call', '--session', sessionId, '--provider', 'game-state',
    '--command', 'get-score', '--fingerprint', 'a'.repeat(64), '--input', '{}'], env), /PREVIEW_SESSION_NOT_FOUND/);
});
