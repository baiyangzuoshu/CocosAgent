import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MCP_SERVER_NAME = 'cocos-creator-agent';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CLI_ENTRY = path.resolve(HERE, '../cli.mjs');

function cliInvocation({ nodePath = process.execPath, cliEntry = process.argv[1] || DEFAULT_CLI_ENTRY } = {}) {
  let resolvedEntry;
  try { resolvedEntry = fs.realpathSync(cliEntry); }
  catch (_) { resolvedEntry = path.resolve(cliEntry); }
  return { command: nodePath, args: [resolvedEntry, 'mcp', 'serve'] };
}

function defaultRunner(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    windowsHide: true, ...options });
  return { status: result.status, signal: result.signal, stdout: result.stdout || '', stderr: result.stderr || '',
    error: result.error };
}

function resultText(result) { return `${result.stdout || ''}${result.stderr || ''}`.trim(); }

function isMissingConfiguration(result) {
  return result.status !== 0 && /not found|does not exist|unknown (mcp )?server|no mcp server|not configured/i.test(resultText(result));
}

function makeInvocation(client, scope, invocation) {
  if (client === 'codex') return { executable: 'codex', add: ['mcp', 'add', MCP_SERVER_NAME, '--', invocation.command, ...invocation.args],
    get: ['mcp', 'get', MCP_SERVER_NAME, '--json'], remove: ['mcp', 'remove', MCP_SERVER_NAME], list: ['mcp', 'list', '--json'] };
  if (client === 'claude-code') return { executable: 'claude',
    add: ['mcp', 'add', '--scope', scope, '--transport', 'stdio', MCP_SERVER_NAME, '--', invocation.command, ...invocation.args],
    get: ['mcp', 'get', MCP_SERVER_NAME], remove: ['mcp', 'remove', '--scope', scope, MCP_SERVER_NAME], list: ['mcp', 'list'] };
  throw new Error('CLIENT_UNSUPPORTED: choose codex or claude-code');
}

function parseCodexConfig(stdout) {
  try {
    const value = JSON.parse(stdout);
    return value.server || value;
  } catch (_) { return null; }
}

function isExpectedConfig(client, stdout, invocation) {
  if (client === 'codex') {
    const config = parseCodexConfig(stdout);
    const transport = config?.transport || config;
    const command = transport?.command;
    const args = transport?.args;
    return command === invocation.command && Array.isArray(args)
      && args.join('\0') === invocation.args.join('\0');
  }
  const expectedCommand = [invocation.command, ...invocation.args].join(' ');
  const normalized = stdout.replaceAll('\\', '/');
  return normalized.includes(expectedCommand.replaceAll('\\', '/'))
    || (normalized.includes(invocation.command.replaceAll('\\', '/'))
      && normalized.includes(invocation.args.at(-1)) && normalized.includes('mcp serve'));
}

export function configureMcp(client, { force = false, local = false, dryRun = false, runner = defaultRunner,
  nodePath = process.execPath, cliEntry = process.argv[1] || DEFAULT_CLI_ENTRY } = {}) {
  if (client === 'codex' && local) throw new Error('CODEX_LOCAL_MCP_SCOPE_UNSUPPORTED: Codex mcp add writes user configuration.');
  const scope = local ? 'local' : 'user';
  const invocation = cliInvocation({ nodePath, cliEntry });
  const commands = makeInvocation(client, scope, invocation);
  const existing = runner(commands.executable, commands.get);
  if (existing.status === 0) {
    if (isExpectedConfig(client, existing.stdout, invocation)) return { client, server: MCP_SERVER_NAME, status: 'already-configured', scope,
      command: invocation.command, args: invocation.args };
    if (!force) throw new Error(`MCP_SERVER_CONFLICT: ${client} already has ${MCP_SERVER_NAME}; inspect it or rerun with --force.`);
    if (dryRun) return { client, server: MCP_SERVER_NAME, status: 'would-replace', scope, command: invocation.command, args: invocation.args };
    const removed = runner(commands.executable, commands.remove);
    if (removed.status !== 0) throw new Error(`MCP_REMOVE_FAILED: ${resultText(removed) || removed.error?.message || 'client command failed'}`);
  } else if (existing.error?.code === 'ENOENT') {
    throw new Error(`CLIENT_NOT_INSTALLED: ${commands.executable} was not found on PATH.`);
  } else if (!isMissingConfiguration(existing)) {
    throw new Error(`MCP_STATUS_FAILED: ${resultText(existing) || existing.error?.message || 'client command failed'}`);
  }

  if (dryRun) return { client, server: MCP_SERVER_NAME, status: 'would-configure', scope, command: invocation.command, args: invocation.args };
  const added = runner(commands.executable, commands.add);
  if (added.status !== 0) throw new Error(`MCP_CONFIGURE_FAILED: ${resultText(added) || added.error?.message || 'client command failed'}`);
  return { client, server: MCP_SERVER_NAME, status: 'configured', scope, command: invocation.command, args: invocation.args,
    message: resultText(added) || undefined };
}

export function mcpStatus(client, { runner = defaultRunner, nodePath = process.execPath,
  cliEntry = process.argv[1] || DEFAULT_CLI_ENTRY } = {}) {
  const invocation = cliInvocation({ nodePath, cliEntry });
  const commands = makeInvocation(client, 'user', invocation);
  const result = runner(commands.executable, commands.get);
  if (result.error?.code === 'ENOENT') return { client, server: MCP_SERVER_NAME, status: 'client-not-installed' };
  if (result.status !== 0) return { client, server: MCP_SERVER_NAME,
    status: isMissingConfiguration(result) ? 'not-configured' : 'client-error' };
  return { client, server: MCP_SERVER_NAME,
    status: isExpectedConfig(client, result.stdout, invocation) ? 'configured' : 'different-configuration' };
}

export function supportedMcpClients() {
  return [
    { id: 'codex', configureCommand: 'codex mcp add', scope: 'user' },
    { id: 'claude-code', configureCommand: 'claude mcp add', scope: 'user or local' },
  ];
}
