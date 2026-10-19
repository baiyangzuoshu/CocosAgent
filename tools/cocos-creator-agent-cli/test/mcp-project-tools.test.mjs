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
const mcpPath = path.join(repoRoot, 'plugins/cocos-creator-agent/mcp/server.mjs');
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

async function bridgeRequest(state, method, route, body) {
  const response = await fetch(`http://127.0.0.1:${state.port}${route}`, {
    method,
    headers: { authorization: `Bearer ${state.token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error?.code || `HTTP_${response.status}`);
  return payload;
}

function startMcp(home, cliShim) {
  const child = spawn(process.execPath, [mcpPath], { cwd: repoRoot,
    env: { ...process.env, HOME: home, COCOS_CREATOR_AGENT_CLI: cliShim },
    stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  let output = '';
  let stderr = '';
  let nextId = 1;
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    output += chunk;
    for (;;) {
      const newline = output.indexOf('\n');
      if (newline < 0) break;
      const line = output.slice(0, newline);
      output = output.slice(newline + 1);
      if (!line.trim()) continue;
      const response = JSON.parse(line);
      const waiter = pending.get(response.id);
      if (!waiter) continue;
      pending.delete(response.id);
      if (response.error) waiter.reject(new Error(response.error.message));
      else waiter.resolve(response.result);
    }
  });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.once('exit', (code) => {
    for (const waiter of pending.values()) waiter.reject(new Error(`MCP exited ${code}: ${stderr}`));
    pending.clear();
  });
  const request = (method, params = {}) => {
    const id = nextId++;
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}; ${stderr}`));
      }, 10000);
      pending.set(id, { resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); } });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return promise;
  };
  return { child, request, notify(method, params = {}) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  } };
}

test('MCP discovers a project alias and routes it through CLI to the selected Creator instance', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-mcp-project-tools-'));
  const home = path.join(root, 'home');
  const projectRoot = path.join(root, 'project');
  const dataRoot = path.join(home, '.cocos-creator-agent');
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'mcp-alias-test', version: '2.4.15' }));
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent/tools.json'), JSON.stringify({ schemaVersion: 1, tools: [{
    id: 'player-script', title: 'Read player script', description: 'Read the Player component through Creator.',
    commandId: 'creator.script.read',
  }] }));
  const canonicalRoot = fs.realpathSync(projectRoot);
  const cliShim = path.join(root, 'cocos-agent-cli.mjs');
  fs.writeFileSync(cliShim, `#!/usr/bin/env node\nimport { spawnSync } from 'node:child_process';\nconst child = spawnSync(${JSON.stringify(process.execPath)}, [${JSON.stringify(cliPath)}, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });\nprocess.exit(child.status ?? 1);\n`);
  fs.chmodSync(cliShim, 0o755);

  const bridge = spawn(process.execPath, [servicePath], { cwd: packageRoot,
    env: { ...process.env, HOME: home }, stdio: ['ignore', 'ignore', 'pipe'] });
  let bridgeStderr = '';
  bridge.stderr.setEncoding('utf8').on('data', (chunk) => { bridgeStderr += chunk; });
  const statePath = path.join(dataRoot, 'third-party-bridge.json');
  let bridgeState;
  let mcp;
  t.after(async () => {
    if (mcp?.child.exitCode === null) {
      mcp.child.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => mcp.child.once('exit', resolve)), delay(1500)]);
    }
    if (bridge.exitCode === null) {
      try { await bridgeRequest(bridgeState, 'POST', '/v1/stop', {}); } catch (_) { bridge.kill('SIGTERM'); }
    }
    await Promise.race([new Promise((resolve) => bridge.once('exit', resolve)), delay(2000)]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  bridgeState = await waitForBridge(statePath, bridge).catch((error) => {
    throw new Error(`${error.message}\n${bridgeStderr}`);
  });
  const contractBytes = fs.readFileSync(contractPath);
  const contract = JSON.parse(contractBytes.toString('utf8'));
  const extensionPackage = JSON.parse(fs.readFileSync(extensionPackagePath, 'utf8'));
  const instanceId = crypto.randomUUID();
  const registration = await bridgeRequest(bridgeState, 'POST', '/v1/creator/register', {
    instanceId, projectRoot: canonicalRoot, creatorVersion: contract.creatorVersion,
    extensionVersion: extensionPackage.version,
    contractFingerprint: crypto.createHash('sha256').update(contractBytes).digest('hex'),
    activeScene: 'Untitled',
    capabilities: contract.commands.map((command) => ({ id: command.id, status: 'available' })),
  });

  mcp = startMcp(home, cliShim);
  await mcp.request('initialize', { protocolVersion: '2024-11-05' });
  mcp.notify('notifications/initialized');
  const listing = await mcp.request('tools/list');
  const expectedName = `cocos_project_${crypto.createHash('sha256').update(canonicalRoot).digest('hex').slice(0, 10)}_player_script`;
  const alias = listing.tools.find((item) => item.name === expectedName);
  assert.ok(alias, `Project alias was not discovered. Got ${listing.tools.length} tools.`);
  assert.deepEqual(alias.inputSchema.required, ['instanceId', 'scriptPath']);

  const pollPromise = bridgeRequest(bridgeState, 'POST', '/v1/creator/poll', {
    instanceId, sessionId: registration.sessionId, activeScene: 'Untitled',
  });
  const callPromise = mcp.request('tools/call', { name: expectedName,
    arguments: { instanceId, scriptPath: 'assets/Scripts/Player.ts' } });
  const call = await pollPromise;
  assert.equal(call.command, 'creator.script.read');
  assert.deepEqual(call.input, { scriptPath: 'assets/Scripts/Player.ts' });
  await bridgeRequest(bridgeState, 'POST', '/v1/creator/respond', {
    instanceId, sessionId: registration.sessionId, requestId: call.requestId, ok: true,
    result: { scriptPath: 'assets/Scripts/Player.ts', source: 'class Player {}', uuid: crypto.randomUUID() },
  });
  const toolResult = await callPromise;
  assert.equal(toolResult.isError, false);
  assert.match(toolResult.content?.[0]?.text || '', /Player\.ts/);
});
