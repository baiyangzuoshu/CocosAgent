import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const servicePath = path.join(packageRoot, 'bridge/service.mjs');
const cliPath = path.join(packageRoot, 'cli.mjs');
const contractPath = path.join(packageRoot, 'creator-extension/command-contract.json');
const extensionPackagePath = path.join(packageRoot, 'creator-extension/package.json');

async function waitForBridge(statePath, child) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Bridge exited early (${child.exitCode}).`);
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const health = await fetch(`http://127.0.0.1:${state.port}/v1/health`, {
        headers: { authorization: `Bearer ${state.token}` },
      });
      if (health.ok) return state;
    } catch (_) {}
    await delay(50);
  }
  throw new Error('Timed out waiting for the test bridge to start.');
}

async function request(state, method, route, body) {
  const response = await fetch(`http://127.0.0.1:${state.port}${route}`, {
    method,
    headers: { authorization: `Bearer ${state.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error?.code || `HTTP_${response.status}`);
  return payload;
}

function runCli(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args, '--format', 'json'], {
      cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) { reject(new Error(`CLI exited ${code}: ${stderr || stdout}`)); return; }
      try { resolve(JSON.parse(stdout)); }
      catch (_) { reject(new Error(`CLI returned invalid JSON: ${stdout}`)); }
    });
  });
}

test('tasks wait returns the next durable progress event and terminal result', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-cli-tasks-wait-'));
  const home = path.join(root, 'home');
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'tasks-wait-test', version: '2.4.15' }));
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
  const contractBytes = fs.readFileSync(contractPath);
  const contract = JSON.parse(contractBytes.toString('utf8'));
  const extensionPackage = JSON.parse(fs.readFileSync(extensionPackagePath, 'utf8'));
  const instanceId = crypto.randomUUID();
  await assert.rejects(request(state, 'POST', '/v1/creator/register', {
    instanceId, projectRoot, creatorVersion: '2.4.15', extensionVersion: '0.0.1',
    contractFingerprint: '0'.repeat(64), capabilities: [],
  }), /CREATOR_REGISTRATION_INVALID/);
  const rejected = await request(state, 'GET', '/v1/instances');
  assert.equal(rejected.instances.length, 0);
  assert.equal(rejected.rejectedInstances[0].reportedProjectRoot, projectRoot);
  assert.deepEqual(rejected.rejectedInstances[0].reasons, ['EXTENSION_VERSION_MISMATCH', 'COMMAND_CONTRACT_MISMATCH']);
  await assert.rejects(request(state, 'POST', `/v1/instances/${instanceId}/tasks`, {
    command: 'creator.project.info', input: {},
  }), /INSTANCE_NOT_FOUND/);
  const registration = await request(state, 'POST', '/v1/creator/register', {
    instanceId, projectRoot, creatorVersion: '2.4.15',
    extensionVersion: extensionPackage.version,
    contractFingerprint: crypto.createHash('sha256').update(contractBytes).digest('hex'),
    processId: 4321,
    activeScene: 'Untitled',
    capabilities: contract.commands.map((command) => ({ id: command.id, status: 'available' })),
  });
  assert.equal((await request(state, 'GET', '/v1/instances')).rejectedInstances.length, 0);
  const started = await request(state, 'POST', `/v1/instances/${instanceId}/tasks`, {
    command: 'creator.project.info', input: {},
  });
  assert.equal(started.status, 'queued');
  assert.equal(started.eventSequence, 1);

  const cliEnv = { ...process.env, HOME: home };
  const runningPromise = runCli(['tasks', 'wait', '--id', started.taskId,
    '--after-sequence', '1', '--wait-ms', '5000'], cliEnv);
  const running = await runningPromise;
  assert.equal(running.status, 'running');
  assert.equal(running.events.at(-1).type, 'running');
  assert.ok(running.eventSequence > 1);

  const timedOut = await runCli(['tasks', 'wait', '--id', started.taskId,
    '--after-sequence', String(running.eventSequence), '--wait-ms', '10'], cliEnv);
  assert.equal(timedOut.status, 'running');
  assert.equal(timedOut.waitTimedOut, true);

  const pollResponse = await request(state, 'POST', '/v1/creator/poll', {
    instanceId, sessionId: registration.sessionId, activeScene: 'Untitled',
    capabilities: [{ id: 'creator.project.info', status: 'available' },
      { id: 'creator.prefab.source.patch.plan', status: 'unavailable', reason: 'SCENE_LOADING' }],
  });
  assert.equal(pollResponse.command, 'creator.project.info');
  const capabilitiesWhileLoading = await request(state, 'GET', `/v1/instances/${instanceId}/capabilities`);
  assert.equal(capabilitiesWhileLoading.commands.find((entry) => entry.id === 'creator.prefab.source.patch.plan').status,
    'unavailable');
  await request(state, 'POST', '/v1/creator/respond', {
    instanceId, sessionId: registration.sessionId, requestId: pollResponse.requestId,
    ok: true, result: { projectName: 'tasks-wait-test', projectRoot },
  });

  const completed = await runCli(['tasks', 'wait', '--id', started.taskId,
    '--after-sequence', String(running.eventSequence), '--wait-ms', '5000'], cliEnv);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.eventSequence, running.eventSequence + 1);
  assert.deepEqual(completed.result, { projectName: 'tasks-wait-test', projectRoot });

  await assert.rejects(request(state, 'POST', '/v1/creator/poll', {
    instanceId, sessionId: 'stale-session', capabilities: [],
  }), /CREATOR_SESSION_STALE/);
  await assert.rejects(request(state, 'POST', '/v1/creator/poll', {
    instanceId, sessionId: registration.sessionId, capabilities: [{ id: 'unknown', status: 'available' }],
  }), /CAPABILITIES_INVALID/);
  const nextTask = await request(state, 'POST', `/v1/instances/${instanceId}/tasks`, {
    command: 'creator.project.info', input: {},
  });
  const readyPoll = await request(state, 'POST', '/v1/creator/poll', {
    instanceId, sessionId: registration.sessionId,
    capabilities: [{ id: 'creator.project.info', status: 'available' },
      { id: 'creator.prefab.source.patch.plan', status: 'available' }],
  });
  const capabilitiesAfterLoading = await request(state, 'GET', `/v1/instances/${instanceId}/capabilities`);
  assert.equal(capabilitiesAfterLoading.commands.find((entry) => entry.id === 'creator.prefab.source.patch.plan').status,
    'available');
  await request(state, 'POST', '/v1/creator/respond', {
    instanceId, sessionId: registration.sessionId, requestId: readyPoll.requestId,
    ok: true, result: { projectRoot },
  });
  assert.equal((await runCli(['tasks', 'wait', '--id', nextTask.taskId], cliEnv)).status, 'completed');

  await assert.rejects(request(state, 'POST', `/v1/instances/${instanceId}/disconnect`, { processId: 4322 }),
    /CREATOR_INSTANCE_IDENTITY_MISMATCH/);
  const disconnected = await request(state, 'POST', `/v1/instances/${instanceId}/disconnect`, { processId: 4321 });
  assert.deepEqual(disconnected, { disconnected: true, instanceId, processId: 4321 });
  const inventoryAfterDisconnect = await request(state, 'GET', '/v1/instances');
  assert.equal(inventoryAfterDisconnect.instances.some((item) => item.instanceId === instanceId), false);
});
