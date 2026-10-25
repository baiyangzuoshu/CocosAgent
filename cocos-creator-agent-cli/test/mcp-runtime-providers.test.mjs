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
    env: { ...process.env, HOME: home, COCOS_CREATOR_AGENT_CLI: cliShim }, stdio: ['pipe', 'pipe', 'pipe'] });
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
      const message = JSON.parse(line);
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
  return { child, request(method, params = {}) {
    const id = nextId++;
    const promise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`MCP timed out: ${method}; ${stderr}`)); }, 8000);
      pending.set(id, { resolve: (value) => { clearTimeout(timeout); resolve(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); } });
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return promise;
  } };
}

test('MCP discovers runtime Providers, publishes bounded schemas, calls by session, and rejects stale fingerprints', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-mcp-runtime-'));
  const home = path.join(root, 'home');
  const statePath = path.join(root, 'runtime-catalog.json');
  const callPath = path.join(root, 'runtime-call.json');
  const previewCallPath = path.join(root, 'preview-call.json');
  fs.mkdirSync(home, { recursive: true });
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const state = {
    sessions: [{ previewSessionId: sessionId, instanceId: '22222222-2222-4222-8222-222222222222',
      projectRoot: '/tmp/cocos-game', state: 'running' }],
    commands: [
      { providerId: 'game-state', id: 'get-score', title: 'Read score', description: 'Read score.',
        access: 'read', approval: false, status: 'available', providerFingerprint: 'a'.repeat(64), input: {
          type: 'object', required: ['limit'], properties: { limit: { type: 'integer', minimum: 1, maximum: 10 } },
          additionalProperties: false,
        } },
      { providerId: 'game-state', id: 'set-score', title: 'Set score', description: 'Set score.',
        access: 'control', approval: true, status: 'available', providerFingerprint: 'b'.repeat(64), input: {
          type: 'object', required: ['value'], properties: { value: { type: 'integer', minimum: 0, maximum: 999 } },
          additionalProperties: false,
        } },
    ],
  };
  fs.writeFileSync(statePath, JSON.stringify(state));
  const cliShim = path.join(root, 'cocos-agent-cli.mjs');
  fs.writeFileSync(cliShim, `#!/usr/bin/env node
import fs from 'node:fs';
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(${JSON.stringify(statePath)}, 'utf8'));
let result = {};
if (args[0] === 'catalog') result = { commands: [
  { id: 'creator.preview.start', access: 'control', description: 'Start Web Preview.', input: {
    type: 'object', properties: { port: { type: 'integer', minimum: 1024, maximum: 65535 } }, additionalProperties: false,
  } },
  { id: 'creator.preview.stop', access: 'control', description: 'Stop Web Preview.', input: {
    type: 'object', required: ['previewSessionId'], properties: { previewSessionId: { type: 'string' } }, additionalProperties: false,
  } },
] };
else if (args[0] === 'instances' && args[1] === 'list') result = { instances: [] };
else if (args[0] === 'call') {
  fs.writeFileSync(${JSON.stringify(previewCallPath)}, JSON.stringify(args));
  result = { called: true };
}
else if (args[0] === 'runtime' && args[1] === 'sessions' && args[2] === 'list') result = { sessions: state.sessions };
else if (args[0] === 'runtime' && args[1] === 'commands' && args[2] === 'list') result = { commands: state.commands };
else if (args[0] === 'runtime' && args[1] === 'command' && args[2] === 'call') {
  fs.writeFileSync(${JSON.stringify(callPath)}, JSON.stringify(args));
  result = { called: true };
}
process.stdout.write(JSON.stringify(result) + '\\n');
`);
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
  await mcp.request('initialize', { protocolVersion: '2024-11-05' });
  mcp.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const tools = (await mcp.request('tools/list')).tools;
  assert.ok(tools.some((item) => item.name === 'cocos_runtime_sessions_list'));
  assert.ok(tools.some((item) => item.name === 'cocos_runtime_commands_list'));
  assert.ok(tools.some((item) => item.name === 'cocos_preview_start'));
  assert.ok(tools.some((item) => item.name === 'cocos_preview_stop'));
  const readTool = tools.find((item) => item.description.includes('game-state:get-score'));
  const writeTool = tools.find((item) => item.description.includes('game-state:set-score'));
  assert.ok(readTool);
  assert.ok(writeTool);
  assert.deepEqual(readTool.inputSchema.required, ['previewSessionId', 'limit']);
  assert.equal(readTool.inputSchema.properties.previewSessionId.type, 'string');
  assert.equal(readTool.annotations.readOnlyHint, true);
  assert.equal(writeTool.annotations.destructiveHint, true);

  const previewStart = await mcp.request('tools/call', { name: 'cocos_preview_start', arguments: {
    instanceId: '22222222-2222-4222-8222-222222222222', port: 7456,
  } });
  assert.equal(previewStart.isError, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(previewCallPath, 'utf8')), [
    'call', '--instance', '22222222-2222-4222-8222-222222222222', '--command', 'creator.preview.start',
    '--input', '{"port":7456}', '--format', 'json',
  ]);
  const previewStop = await mcp.request('tools/call', { name: 'cocos_preview_stop', arguments: {
    instanceId: '22222222-2222-4222-8222-222222222222', previewSessionId: sessionId,
  } });
  assert.equal(previewStop.isError, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(previewCallPath, 'utf8')), [
    'call', '--instance', '22222222-2222-4222-8222-222222222222', '--command', 'creator.preview.stop',
    '--input', `{"previewSessionId":"${sessionId}"}`, '--format', 'json',
  ]);

  const called = await mcp.request('tools/call', { name: readTool.name, arguments: {
    previewSessionId: sessionId, limit: 3,
  } });
  assert.equal(called.isError, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(callPath, 'utf8')), [
    'runtime', 'command', 'call', '--session', sessionId, '--provider', 'game-state', '--command', 'get-score',
    '--fingerprint', 'a'.repeat(64), '--input', '{"limit":3}', '--format', 'json',
  ]);

  const beforeStaleCall = fs.readFileSync(callPath, 'utf8');
  state.commands[1].providerFingerprint = 'c'.repeat(64);
  fs.writeFileSync(statePath, JSON.stringify(state));
  const stale = await mcp.request('tools/call', { name: writeTool.name, arguments: {
    previewSessionId: sessionId, value: 17,
  } });
  assert.equal(stale.isError, true);
  assert.match(stale.content[0].text, /RUNTIME_PROVIDER_CHANGED/);
  assert.equal(fs.readFileSync(callPath, 'utf8'), beforeStaleCall);
});
