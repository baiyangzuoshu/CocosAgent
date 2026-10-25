import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');
const cliPath = path.join(packageRoot, 'cli.mjs');

function startMcp(home, cliShim) {
  const child = spawn(process.execPath, [cliPath, 'mcp', 'serve'], { cwd: repoRoot,
    env: { ...process.env, HOME: home, COCOS_CREATOR_AGENT_CLI: cliShim,
      COCOS_MCP_TOOL_REFRESH_INTERVAL_MS: '1000' }, stdio: ['pipe', 'pipe', 'pipe'] });
  const pending = new Map();
  const notifications = [];
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
      const message = JSON.parse(line);
      if (typeof message.method === 'string') { notifications.push(message); continue; }
      const waiter = pending.get(message.id);
      if (!waiter) continue;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
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
      }, 8000);
      pending.set(id, { resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); } });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return promise;
  };
  return { child, request, notifications, get stderr() { return stderr; }, notify(method, params = {}) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  } };
}

test('MCP advertises listChanged and notifies after dynamic command tools change', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-mcp-list-changed-'));
  const home = path.join(root, 'home');
  const statePath = path.join(root, 'catalog.json');
  const cloudCallPath = path.join(root, 'cloud-call.json');
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ commands: [] }));
  const cliShim = path.join(root, 'cocos-agent-cli.mjs');
  fs.writeFileSync(cliShim, `#!/usr/bin/env node\nimport fs from 'node:fs';\nconst args = process.argv.slice(2);\nconst state = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));\nlet result;\nif (args[0] === 'catalog') result = { commands: state.commands };\nelse if (args[0] === 'instances' && args[1] === 'list') result = { instances: [] };\nelse if (args[0] === 'cloud') { fs.writeFileSync(${JSON.stringify(cloudCallPath)}, JSON.stringify(args)); result = { provider: 'github-actions', kind: args[2] }; }\nelse result = {};\nprocess.stdout.write(JSON.stringify(result) + '\\n');\n`);
  fs.chmodSync(cliShim, 0o755);
  let mcp;
  t.after(async () => {
    if (mcp?.child.exitCode === null) {
      mcp.child.kill('SIGTERM');
      await Promise.race([new Promise((resolve) => mcp.child.once('exit', resolve)), delay(1500)]);
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  mcp = startMcp(home, cliShim);
  const initialized = await mcp.request('initialize', { protocolVersion: '2024-11-05' });
  assert.equal(initialized.capabilities.tools.listChanged, true);
  mcp.notify('notifications/initialized');
  const first = await mcp.request('tools/list');
  assert.equal(first.tools.some((tool) => tool.name === 'cocos_project_info'), false);
  const vcsPlan = first.tools.find((tool) => tool.name === 'cocos_vcs_workflow_plan');
  const vcsApply = first.tools.find((tool) => tool.name === 'cocos_vcs_workflow_apply');
  assert.equal(vcsPlan.annotations.readOnlyHint, true);
  assert.equal(vcsApply.annotations.destructiveHint, true);
  assert.ok(vcsPlan.inputSchema.properties.operation.enum.includes('fetch'));
  assert.ok(vcsApply.inputSchema.required.includes('planHash'));
  const missingClose = await mcp.request('tools/call', { name: 'cocos_vcs_workflow_apply', arguments: {
    gitRoot: '/tmp/repo', projectRoot: '/tmp/repo/game', operation: 'switch', target: 'main', planHash: 'a'.repeat(64),
  } });
  assert.equal(missingClose.isError, true);
  assert.match(missingClose.content[0].text, /VCS_EDITOR_CLOSED_REQUIRED/);
  for (const name of ['cocos_cloud_actions_workflows', 'cocos_cloud_actions_runs', 'cocos_cloud_actions_jobs', 'cocos_cloud_actions_artifacts']) {
    const tool = first.tools.find((item) => item.name === name);
    assert.ok(tool, `Expected ${name} in tools/list`);
    assert.equal(tool.annotations.readOnlyHint, true);
  }
  for (const name of ['cocos_cloud_actions_dispatch', 'cocos_cloud_actions_cancel']) {
    const tool = first.tools.find((item) => item.name === name);
    assert.ok(tool, `Expected ${name} in tools/list`);
    assert.equal(tool.annotations.readOnlyHint, false);
    assert.equal(tool.annotations.destructiveHint, true);
    assert.equal(tool.annotations.openWorldHint, true);
  }
  const cloudResult = await mcp.request('tools/call', { name: 'cocos_cloud_actions_runs', arguments: {
    repository: 'acme/game', workflow: 'build.yml', status: 'completed', page: 2, perPage: 5,
  } });
  assert.match(cloudResult.content[0].text, /github-actions/);
  assert.deepEqual(JSON.parse(fs.readFileSync(cloudCallPath, 'utf8')), [
    'cloud', 'actions', 'runs', '--repository', 'acme/game', '--workflow', 'build.yml',
    '--status', 'completed', '--page', '2', '--per-page', '5', '--format', 'json',
  ]);

  const artifactTool = first.tools.find((tool) => tool.name === 'cocos_cloud_actions_artifacts');
  assert.equal(artifactTool.inputSchema.required.includes('runId'), true);
  await mcp.request('tools/call', { name: 'cocos_cloud_actions_artifacts', arguments: {
    repository: 'acme/game', runId: 42, page: 2, perPage: 5,
  } });
  assert.deepEqual(JSON.parse(fs.readFileSync(cloudCallPath, 'utf8')), [
    'cloud', 'actions', 'artifacts', '--repository', 'acme/game', '--run', '42', '--page', '2', '--per-page', '5', '--format', 'json',
  ]);

  await mcp.request('tools/call', { name: 'cocos_cloud_actions_dispatch', arguments: {
    repository: 'acme/game', workflow: 'build.yml', ref: 'main', inputs: { platform: 'web-mobile' },
  } });
  assert.deepEqual(JSON.parse(fs.readFileSync(cloudCallPath, 'utf8')), [
    'cloud', 'actions', 'dispatch', '--repository', 'acme/game', '--workflow', 'build.yml', '--ref', 'main',
    '--inputs', '{"platform":"web-mobile"}', '--format', 'json',
  ]);

  await mcp.request('tools/call', { name: 'cocos_cloud_actions_cancel', arguments: {
    repository: 'acme/game', runId: 99,
  } });
  assert.deepEqual(JSON.parse(fs.readFileSync(cloudCallPath, 'utf8')), [
    'cloud', 'actions', 'cancel', '--run', '99', '--repository', 'acme/game', '--format', 'json',
  ]);

  fs.writeFileSync(statePath, JSON.stringify({ commands: [{ id: 'creator.project.info',
    description: 'Read the selected Creator project identity.', access: 'read', input: {
      type: 'object', properties: {}, additionalProperties: false,
    } }] }));
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline && !mcp.notifications.some((message) => message.method === 'notifications/tools/list_changed'))
    await delay(25);
  assert.ok(mcp.notifications.some((message) => message.method === 'notifications/tools/list_changed'),
    `Expected tools/list_changed notification; stderr: ${mcp.stderr}`);
  const refreshed = await mcp.request('tools/list');
  assert.equal(refreshed.tools.some((tool) => tool.name === 'cocos_project_info'), true);
});
