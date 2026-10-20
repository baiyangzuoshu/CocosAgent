import assert from 'node:assert/strict';
import test from 'node:test';
import { configureMcp, MCP_SERVER_NAME, mcpStatus } from '../mcp/configure.mjs';

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
