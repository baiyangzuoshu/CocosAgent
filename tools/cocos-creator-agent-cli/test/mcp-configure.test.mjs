import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { configureMcp, MCP_SERVER_NAME, mcpStatus, removeMcp, supportedMcpClients } from '../mcp/configure.mjs';

function fakeClient(initial = null) {
  let current = initial;
  const calls = [];
  const runner = (command, args) => {
    calls.push([command, args]);
    if (args[0] === 'mcp' && args[1] === 'get') {
      if (!current) return { status: 1, stdout: '', stderr: 'not found' };
      return { status: 0, stdout: JSON.stringify(current), stderr: '' };
    }
    if (args[0] === 'mcp' && args[1] === 'remove') { current = null; return { status: 0, stdout: '', stderr: '' }; }
    if (args[0] === 'mcp' && args[1] === 'add') {
      const split = args.indexOf('--');
      current = { command: args[split + 1], args: args.slice(split + 2) };
      return { status: 0, stdout: 'added', stderr: '' };
    }
    return { status: 2, stdout: '', stderr: 'unexpected call' };
  };
  return { runner, calls, get current() { return current; } };
}

test('Codex MCP configure registers the CLI-owned stdio server and is idempotent', () => {
  const fake = fakeClient();
  const options = { runner: fake.runner, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  const configured = configureMcp('codex', options);
  assert.equal(configured.status, 'configured');
  assert.equal(fake.current.command, '/usr/bin/node');
  assert.deepEqual(fake.current.args, ['/opt/cocos/cli.mjs', 'mcp', 'serve']);
  assert.equal(configureMcp('codex', options).status, 'already-configured');
  assert.equal(mcpStatus('codex', options).status, 'configured');
  assert.equal(fake.calls.filter(([, args]) => args[1] === 'add').length, 1);
});

test('MCP configure refuses a different same-name server unless force is explicit', () => {
  const fake = fakeClient({ command: 'node', args: ['old-server.mjs'] });
  const options = { runner: fake.runner, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  assert.throws(() => configureMcp('codex', options), /MCP_SERVER_CONFLICT/);
  assert.equal(fake.calls.some(([, args]) => args[1] === 'remove'), false);
  assert.equal(configureMcp('codex', { ...options, force: true }).status, 'configured');
  assert.deepEqual(fake.current.args, ['/opt/cocos/cli.mjs', 'mcp', 'serve']);
});

test('Codex nested transport response is recognized as the already configured CLI server', () => {
  const expected = { transport: { command: '/usr/bin/node', args: ['/opt/cocos/cli.mjs', 'mcp', 'serve'] } };
  const runner = () => ({ status: 0, stdout: JSON.stringify(expected), stderr: '' });
  const options = { runner, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  assert.equal(configureMcp('codex', options).status, 'already-configured');
  assert.equal(mcpStatus('codex', options).status, 'configured');
});

test('Claude Code MCP configure uses its native user-scope command', () => {
  const calls = [];
  const runner = (command, args) => {
    calls.push([command, args]);
    if (args[1] === 'get') return { status: 1, stdout: '', stderr: 'not found' };
    return { status: 0, stdout: 'added', stderr: '' };
  };
  const result = configureMcp('claude-code', { runner, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' });
  assert.equal(result.status, 'configured');
  assert.equal(calls[0][0], 'claude');
  assert.deepEqual(calls[1][1], ['mcp', 'add', '--scope', 'user', '--transport', 'stdio', MCP_SERVER_NAME,
    '--', '/usr/bin/node', '/opt/cocos/cli.mjs', 'mcp', 'serve']);
});

test('Codex local MCP scope fails instead of silently writing user configuration', () => {
  assert.throws(() => configureMcp('codex', { local: true }), /CODEX_LOCAL_MCP_SCOPE_UNSUPPORTED/);
});

test('MCP configure dry run describes a change without writing it', () => {
  const fake = fakeClient();
  const result = configureMcp('codex', { runner: fake.runner, dryRun: true,
    cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' });
  assert.equal(result.status, 'would-configure');
  assert.equal(fake.current, null);
  assert.equal(fake.calls.some(([, args]) => args[1] === 'add'), false);
});

test('Cursor local MCP configure preserves other servers, reports status, and removes only its own entry', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-cursor-mcp-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(path.join(cwd, '.cursor'), { recursive: true });
  const file = path.join(cwd, '.cursor', 'mcp.json');
  fs.writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: 'other-server', args: [] } } }));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { home, cwd, local: true, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  assert.equal(configureMcp('cursor', options).status, 'configured');
  const configured = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(configured.mcpServers.other, { command: 'other-server', args: [] });
  assert.deepEqual(configured.mcpServers[MCP_SERVER_NAME], { command: '/usr/bin/node',
    args: ['/opt/cocos/cli.mjs', 'mcp', 'serve'] });
  assert.equal(mcpStatus('cursor', options).status, 'configured');
  assert.equal(configureMcp('cursor', options).status, 'already-configured');
  assert.equal(removeMcp('cursor', options).status, 'removed');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { mcpServers: { other: { command: 'other-server', args: [] } } });
  assert.deepEqual(supportedMcpClients().map(({ id }) => id), ['codex', 'claude-code', 'cursor', 'vscode']);
});

test('VS Code MCP configure uses its servers schema and supports a dry run without creating files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vscode-mcp-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { home, cwd, local: true, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  const file = path.join(cwd, '.vscode', 'mcp.json');
  assert.equal(configureMcp('vscode', { ...options, dryRun: true }).status, 'would-configure');
  assert.equal(fs.existsSync(file), false);
  assert.equal(configureMcp('vscode', options).status, 'configured');
  const configured = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(configured.servers[MCP_SERVER_NAME], { type: 'stdio', command: '/usr/bin/node',
    args: ['/opt/cocos/cli.mjs', 'mcp', 'serve'] });
  assert.equal(mcpStatus('vscode', options).status, 'configured');
  assert.equal(removeMcp('vscode', options).status, 'removed');
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {});
});

test('VS Code user scope honors XDG_CONFIG_HOME and preserves unrelated servers', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vscode-user-mcp-'));
  const home = path.join(root, 'home');
  const configHome = path.join(root, 'xdg-config');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(cwd);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { home, cwd, env: { XDG_CONFIG_HOME: configHome }, platform: 'linux',
    cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  const file = path.join(configHome, 'Code', 'User', 'mcp.json');
  assert.equal(configureMcp('vscode', options).status, 'configured');
  assert.equal(mcpStatus('vscode', options).configPath, file);
  const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
  existing.servers.unrelated = { type: 'stdio', command: 'other', args: [] };
  fs.writeFileSync(file, JSON.stringify(existing));
  assert.throws(() => configureMcp('vscode', { ...options, cliEntry: '/other/cli.mjs' }), /MCP_SERVER_CONFLICT/);
  assert.equal(configureMcp('vscode', { ...options, cliEntry: '/other/cli.mjs', force: true }).status, 'configured');
  const replaced = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(replaced.servers.unrelated, { type: 'stdio', command: 'other', args: [] });
  assert.deepEqual(replaced.servers[MCP_SERVER_NAME], { type: 'stdio', command: '/usr/bin/node',
    args: ['/other/cli.mjs', 'mcp', 'serve'] });
});

test('native client removal still uses the selected client command', () => {
  const fake = fakeClient({ command: '/usr/bin/node', args: ['/opt/cocos/cli.mjs', 'mcp', 'serve'] });
  const result = removeMcp('codex', { runner: fake.runner, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' });
  assert.equal(result.status, 'removed');
  assert.equal(fake.current, null);
  assert.ok(fake.calls.some(([command, args]) => command === 'codex' && args[1] === 'remove'));
});

test('Cursor config refuses malformed JSON and symlink targets without changing external files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-mcp-safe-config-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(path.join(cwd, '.cursor'), { recursive: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const options = { home, cwd, local: true, cliEntry: '/opt/cocos/cli.mjs', nodePath: '/usr/bin/node' };
  const file = path.join(cwd, '.cursor', 'mcp.json');
  const malformed = '{"mcpServers": {}, // comment\n}';
  fs.writeFileSync(file, malformed);
  assert.throws(() => configureMcp('cursor', options), /MCP_CONFIG_JSON_UNSUPPORTED/);
  assert.equal(fs.readFileSync(file, 'utf8'), malformed);
  fs.unlinkSync(file);
  const outside = path.join(root, 'outside.json');
  fs.writeFileSync(outside, '{}');
  fs.symlinkSync(outside, file);
  assert.throws(() => configureMcp('cursor', options), /MCP_CONFIG_SYMLINK_REFUSED/);
  assert.equal(fs.readFileSync(outside, 'utf8'), '{}');
});
