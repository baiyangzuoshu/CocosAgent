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

function launchBridge(home) {
  const child = spawn(process.execPath, [servicePath], { cwd: packageRoot, env: { ...process.env, HOME: home },
    stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  return { child, get stderr() { return stderr; } };
}

async function runCli(args, home) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args, '--format', 'json'], {
      cwd: repoRoot, env: { ...process.env, HOME: home }, stdio: ['ignore', 'pipe', 'pipe'],
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

async function register(state, contract, extensionPackage, instanceId, projectRoot) {
  const contractBytes = fs.readFileSync(contractPath);
  return request(state, 'POST', '/v1/creator/register', {
    instanceId, projectRoot, creatorVersion: contract.creatorVersion,
    extensionVersion: extensionPackage.version,
    contractFingerprint: crypto.createHash('sha256').update(contractBytes).digest('hex'),
    activeScene: 'Untitled',
    capabilities: contract.commands.map((command) => ({ id: command.id, status: 'available' })),
  });
}

async function waitForTaskStatus(state, taskId, expected) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const task = await request(state, 'GET', `/v1/tasks/${taskId}`);
    if (task.status === expected) return task;
    await delay(20);
  }
  throw new Error(`Task ${taskId} did not reach ${expected}.`);
}

async function stopBridge(state, processInfo) {
  await request(state, 'POST', '/v1/stop', {});
  await Promise.race([new Promise((resolve) => processInfo.child.once('exit', resolve)), delay(3000)]);
  if (processInfo.child.exitCode === null) processInfo.child.kill('SIGKILL');
}

test('tasks cancel before delivery and recover safely across a bridge restart', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-cli-tasks-recovery-'));
  const home = path.join(root, 'home');
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'tasks-recovery-test', version: '2.4.15' }));
  const statePath = path.join(home, '.cocos-creator-agent/third-party-bridge.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const extensionPackage = JSON.parse(fs.readFileSync(extensionPackagePath, 'utf8'));
  let firstProcess = launchBridge(home);
  let firstState;
  t.after(async () => {
    if (firstProcess.child.exitCode === null) firstProcess.child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => firstProcess.child.once('exit', resolve)), delay(2000)]);
    fs.rmSync(root, { recursive: true, force: true });
  });
  firstState = await waitForBridge(statePath, firstProcess.child).catch((error) => {
    throw new Error(`${error.message}\n${firstProcess.stderr}`);
  });

  const readInstanceId = crypto.randomUUID();
  const writeInstanceId = crypto.randomUUID();
  const componentInstanceId = crypto.randomUUID();
  const propertyInstanceId = crypto.randomUUID();
  const renameInstanceId = crypto.randomUUID();
  const reparentInstanceId = crypto.randomUUID();
  const cancelInstanceId = crypto.randomUUID();
  await register(firstState, contract, extensionPackage, readInstanceId, projectRoot);
  await register(firstState, contract, extensionPackage, writeInstanceId, projectRoot);
  await register(firstState, contract, extensionPackage, componentInstanceId, projectRoot);
  await register(firstState, contract, extensionPackage, propertyInstanceId, projectRoot);
  await register(firstState, contract, extensionPackage, renameInstanceId, projectRoot);
  await register(firstState, contract, extensionPackage, reparentInstanceId, projectRoot);
  await register(firstState, contract, extensionPackage, cancelInstanceId, projectRoot);

  const readTask = await request(firstState, 'POST', `/v1/instances/${readInstanceId}/tasks`, {
    command: 'creator.project.info', input: {},
  });
  const operationId = crypto.randomUUID();
  const writeTask = await request(firstState, 'POST', `/v1/instances/${writeInstanceId}/tasks`, {
    command: 'creator.script.create.commit', input: { operationId, planHash: 'a'.repeat(64) },
  });
  const componentOperationId = crypto.randomUUID();
  const componentTask = await request(firstState, 'POST', `/v1/instances/${componentInstanceId}/tasks`, {
    command: 'creator.scene.node.add-component.commit', input: { operationId: componentOperationId, planHash: 'b'.repeat(64) },
  });
  const propertyOperationId = crypto.randomUUID();
  const propertyTask = await request(firstState, 'POST', `/v1/instances/${propertyInstanceId}/tasks`, {
    command: 'creator.scene.node.set-component-property.commit', input: { operationId: propertyOperationId, planHash: 'c'.repeat(64) },
  });
  const renameOperationId = crypto.randomUUID();
  const renameTask = await request(firstState, 'POST', `/v1/instances/${renameInstanceId}/tasks`, {
    command: 'creator.scene.node.rename.commit', input: { operationId: renameOperationId, planHash: 'd'.repeat(64) },
  });
  const reparentOperationId = crypto.randomUUID();
  const reparentTask = await request(firstState, 'POST', `/v1/instances/${reparentInstanceId}/tasks`, {
    command: 'creator.scene.node.reparent.commit', input: { operationId: reparentOperationId, planHash: 'e'.repeat(64) },
  });
  const cancelTask = await request(firstState, 'POST', `/v1/instances/${cancelInstanceId}/tasks`, {
    command: 'creator.project.info', input: {},
  });
  await waitForTaskStatus(firstState, readTask.taskId, 'running');
  await waitForTaskStatus(firstState, writeTask.taskId, 'running');
  await waitForTaskStatus(firstState, componentTask.taskId, 'running');
  await waitForTaskStatus(firstState, propertyTask.taskId, 'running');
  await waitForTaskStatus(firstState, renameTask.taskId, 'running');
  await waitForTaskStatus(firstState, reparentTask.taskId, 'running');
  await waitForTaskStatus(firstState, cancelTask.taskId, 'running');
  const cancelled = await request(firstState, 'POST', `/v1/tasks/${cancelTask.taskId}/cancel`, {});
  assert.equal(cancelled.status, 'cancel-requested');
  await waitForTaskStatus(firstState, cancelTask.taskId, 'cancelled');

  await stopBridge(firstState, firstProcess);
  const readRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${readTask.taskId}.json`);
  const writeRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${writeTask.taskId}.json`);
  const componentRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${componentTask.taskId}.json`);
  const propertyRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${propertyTask.taskId}.json`);
  const renameRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${renameTask.taskId}.json`);
  const reparentRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${reparentTask.taskId}.json`);
  const cancelledRecordPath = path.join(home, '.cocos-creator-agent/tasks', `${cancelTask.taskId}.json`);
  assert.equal(JSON.parse(fs.readFileSync(readRecordPath, 'utf8')).status, 'interrupted');
  assert.equal(JSON.parse(fs.readFileSync(writeRecordPath, 'utf8')).status, 'needs-reconciliation');
  assert.equal(JSON.parse(fs.readFileSync(componentRecordPath, 'utf8')).status, 'needs-reconciliation');
  assert.equal(JSON.parse(fs.readFileSync(propertyRecordPath, 'utf8')).status, 'needs-reconciliation');
  assert.equal(JSON.parse(fs.readFileSync(renameRecordPath, 'utf8')).status, 'needs-reconciliation');
  assert.equal(JSON.parse(fs.readFileSync(reparentRecordPath, 'utf8')).status, 'needs-reconciliation');
  assert.equal(JSON.parse(fs.readFileSync(cancelledRecordPath, 'utf8')).status, 'cancelled');

  firstProcess = launchBridge(home);
  firstState = await waitForBridge(statePath, firstProcess.child).catch((error) => {
    throw new Error(`${error.message}\n${firstProcess.stderr}`);
  });
  const readRegistration = await register(firstState, contract, extensionPackage, readInstanceId, projectRoot);
  const writeRegistration = await register(firstState, contract, extensionPackage, writeInstanceId, projectRoot);
  const componentRegistration = await register(firstState, contract, extensionPackage, componentInstanceId, projectRoot);
  const propertyRegistration = await register(firstState, contract, extensionPackage, propertyInstanceId, projectRoot);
  const renameRegistration = await register(firstState, contract, extensionPackage, renameInstanceId, projectRoot);
  const reparentRegistration = await register(firstState, contract, extensionPackage, reparentInstanceId, projectRoot);

  const resumedRead = await runCli(['tasks', 'resume', '--instance', readInstanceId, '--id', readTask.taskId], home);
  const resumedWrite = await runCli(['tasks', 'resume', '--instance', writeInstanceId, '--id', writeTask.taskId], home);
  const resumedComponent = await runCli(['tasks', 'resume', '--instance', componentInstanceId, '--id', componentTask.taskId], home);
  const resumedProperty = await runCli(['tasks', 'resume', '--instance', propertyInstanceId, '--id', propertyTask.taskId], home);
  const resumedRename = await runCli(['tasks', 'resume', '--instance', renameInstanceId, '--id', renameTask.taskId], home);
  const resumedReparent = await runCli(['tasks', 'resume', '--instance', reparentInstanceId, '--id', reparentTask.taskId], home);
  const readPoll = await request(firstState, 'POST', '/v1/creator/poll', {
    instanceId: readInstanceId, sessionId: readRegistration.sessionId, activeScene: 'Untitled',
  });
  assert.equal(readPoll.command, 'creator.project.info');
  await request(firstState, 'POST', '/v1/creator/respond', {
    instanceId: readInstanceId, sessionId: readRegistration.sessionId, requestId: readPoll.requestId,
    ok: true, result: { projectName: 'tasks-recovery-test', projectRoot },
  });
  const writePoll = await request(firstState, 'POST', '/v1/creator/poll', {
    instanceId: writeInstanceId, sessionId: writeRegistration.sessionId, activeScene: 'Untitled',
  });
  assert.equal(writePoll.command, 'creator.script.create.reconcile');
  assert.deepEqual(writePoll.input, { operationId });
  await request(firstState, 'POST', '/v1/creator/respond', {
    instanceId: writeInstanceId, sessionId: writeRegistration.sessionId, requestId: writePoll.requestId,
    ok: true, result: { operationId, status: 'not-applied' },
  });
  const componentPoll = await request(firstState, 'POST', '/v1/creator/poll', {
    instanceId: componentInstanceId, sessionId: componentRegistration.sessionId, activeScene: 'Untitled',
  });
  assert.equal(componentPoll.command, 'creator.scene.node.add-component.reconcile');
  assert.deepEqual(componentPoll.input, { operationId: componentOperationId });
  await request(firstState, 'POST', '/v1/creator/respond', {
    instanceId: componentInstanceId, sessionId: componentRegistration.sessionId, requestId: componentPoll.requestId,
    ok: true, result: { operationId: componentOperationId, status: 'not-applied' },
  });
  const propertyPoll = await request(firstState, 'POST', '/v1/creator/poll', {
    instanceId: propertyInstanceId, sessionId: propertyRegistration.sessionId, activeScene: 'Untitled',
  });
  assert.equal(propertyPoll.command, 'creator.scene.node.set-component-property.reconcile');
  assert.deepEqual(propertyPoll.input, { operationId: propertyOperationId });
  await request(firstState, 'POST', '/v1/creator/respond', {
    instanceId: propertyInstanceId, sessionId: propertyRegistration.sessionId, requestId: propertyPoll.requestId,
    ok: true, result: { operationId: propertyOperationId, status: 'not-applied' },
  });
  const renamePoll = await request(firstState, 'POST', '/v1/creator/poll', {
    instanceId: renameInstanceId, sessionId: renameRegistration.sessionId, activeScene: 'Untitled',
  });
  assert.equal(renamePoll.command, 'creator.scene.node.rename.reconcile');
  assert.deepEqual(renamePoll.input, { operationId: renameOperationId });
  await request(firstState, 'POST', '/v1/creator/respond', {
    instanceId: renameInstanceId, sessionId: renameRegistration.sessionId, requestId: renamePoll.requestId,
    ok: true, result: { operationId: renameOperationId, status: 'not-applied' },
  });
  const reparentPoll = await request(firstState, 'POST', '/v1/creator/poll', {
    instanceId: reparentInstanceId, sessionId: reparentRegistration.sessionId, activeScene: 'Untitled',
  });
  assert.equal(reparentPoll.command, 'creator.scene.node.reparent.reconcile');
  assert.deepEqual(reparentPoll.input, { operationId: reparentOperationId });
  await request(firstState, 'POST', '/v1/creator/respond', {
    instanceId: reparentInstanceId, sessionId: reparentRegistration.sessionId, requestId: reparentPoll.requestId,
    ok: true, result: { operationId: reparentOperationId, status: 'not-applied' },
  });

  const completedRead = await runCli(['tasks', 'wait', '--id', readTask.taskId,
    '--after-sequence', String(resumedRead.eventSequence), '--wait-ms', '5000'], home);
  const completedWrite = await runCli(['tasks', 'wait', '--id', writeTask.taskId,
    '--after-sequence', String(resumedWrite.eventSequence), '--wait-ms', '5000'], home);
  const completedComponent = await runCli(['tasks', 'wait', '--id', componentTask.taskId,
    '--after-sequence', String(resumedComponent.eventSequence), '--wait-ms', '5000'], home);
  const completedProperty = await runCli(['tasks', 'wait', '--id', propertyTask.taskId,
    '--after-sequence', String(resumedProperty.eventSequence), '--wait-ms', '5000'], home);
  const completedRename = await runCli(['tasks', 'wait', '--id', renameTask.taskId,
    '--after-sequence', String(resumedRename.eventSequence), '--wait-ms', '5000'], home);
  const completedReparent = await runCli(['tasks', 'wait', '--id', reparentTask.taskId,
    '--after-sequence', String(resumedReparent.eventSequence), '--wait-ms', '5000'], home);
  assert.equal(completedRead.status, 'completed');
  assert.equal(completedRead.result.projectName, 'tasks-recovery-test');
  assert.equal(completedWrite.status, 'completed');
  assert.equal(completedWrite.resumingWith, 'creator.script.create.reconcile');
  assert.deepEqual(completedWrite.result, { operationId, status: 'not-applied' });
  assert.equal(completedComponent.status, 'completed');
  assert.equal(completedComponent.resumingWith, 'creator.scene.node.add-component.reconcile');
  assert.deepEqual(completedComponent.result, { operationId: componentOperationId, status: 'not-applied' });
  assert.equal(completedProperty.status, 'completed');
  assert.equal(completedProperty.resumingWith, 'creator.scene.node.set-component-property.reconcile');
  assert.deepEqual(completedProperty.result, { operationId: propertyOperationId, status: 'not-applied' });
  assert.equal(completedRename.status, 'completed');
  assert.equal(completedRename.resumingWith, 'creator.scene.node.rename.reconcile');
  assert.equal(completedReparent.status, 'completed');
  assert.equal(completedReparent.resumingWith, 'creator.scene.node.reparent.reconcile');
  assert.deepEqual(completedReparent.result, { operationId: reparentOperationId, status: 'not-applied' });
  assert.deepEqual(completedRename.result, { operationId: renameOperationId, status: 'not-applied' });
});
