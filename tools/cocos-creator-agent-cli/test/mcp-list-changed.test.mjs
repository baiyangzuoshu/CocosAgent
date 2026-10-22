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
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({ commands: [] }));
  const cliShim = path.join(root, 'cocos-agent-cli.mjs');
  fs.writeFileSync(cliShim, `#!/usr/bin/env node\nimport fs from 'node:fs';\nconst args = process.argv.slice(2);\nconst state = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));\nlet result;\nif (args[0] === 'catalog') result = { commands: state.commands };\nelse if (args[0] === 'instances' && args[1] === 'list') result = { instances: [] };\nelse result = {};\nprocess.stdout.write(JSON.stringify(result) + '\\n');\n`);
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
