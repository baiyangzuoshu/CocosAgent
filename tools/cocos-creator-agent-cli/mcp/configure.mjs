import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MCP_SERVER_NAME = 'cocos-creator-agent';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CLI_ENTRY = path.resolve(HERE, '../cli.mjs');
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

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

function fileClientLocation(client, { local, cwd, home, env, platform }) {
  const root = fs.realpathSync(local ? cwd : home);
  let relative;
  if (client === 'cursor') relative = path.join('.cursor', 'mcp.json');
  else if (client === 'vscode' && local) relative = path.join('.vscode', 'mcp.json');
  else if (client === 'vscode' && platform === 'darwin') relative = path.join('Library', 'Application Support', 'Code', 'User', 'mcp.json');
  else if (client === 'vscode' && platform === 'win32') {
    const appData = typeof env.APPDATA === 'string' && path.isAbsolute(env.APPDATA)
      ? path.resolve(env.APPDATA) : path.join(root, 'AppData', 'Roaming');
    return { root: appData, path: path.join(appData, 'Code', 'User', 'mcp.json'), key: 'servers', scope: local ? 'local' : 'user' };
  } else if (client === 'vscode') {
    const configHome = typeof env.XDG_CONFIG_HOME === 'string' && path.isAbsolute(env.XDG_CONFIG_HOME)
      ? path.resolve(env.XDG_CONFIG_HOME) : path.join(root, '.config');
    return { root: configHome, path: path.join(configHome, 'Code', 'User', 'mcp.json'), key: 'servers', scope: local ? 'local' : 'user' };
  } else throw new Error('CLIENT_UNSUPPORTED: choose codex, claude-code, cursor, or vscode');
  return { root, path: path.join(root, relative), key: client === 'vscode' ? 'servers' : 'mcpServers',
    scope: local ? 'local' : 'user' };
}

function inspectConfigPath(location) {
  try {
    const rootStat = fs.lstatSync(location.root);
    if (rootStat.isSymbolicLink()) throw new Error('MCP_CONFIG_SYMLINK_REFUSED');
    if (!rootStat.isDirectory()) throw new Error('MCP_CONFIG_PATH_NOT_DIRECTORY');
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const relative = path.relative(location.root, location.path);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('MCP_CONFIG_PATH_INVALID');
  let current = location.root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (error?.code === 'ENOENT') break; throw error; }
    if (stat.isSymbolicLink()) throw new Error('MCP_CONFIG_SYMLINK_REFUSED');
    if (current !== location.path && !stat.isDirectory()) throw new Error('MCP_CONFIG_PATH_NOT_DIRECTORY');
    if (current === location.path && !stat.isFile()) throw new Error('MCP_CONFIG_FILE_INVALID');
  }
  try {
    const stat = fs.lstatSync(location.path);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('MCP_CONFIG_FILE_INVALID');
    const raw = fs.readFileSync(location.path, 'utf8');
    const text = raw.replace(/^\uFEFF/, '');
    const value = JSON.parse(text);
    if (!isObject(value)) throw new Error('MCP_CONFIG_ROOT_INVALID');
    const entries = value[location.key] === undefined ? {} : value[location.key];
    if (!isObject(entries)) throw new Error('MCP_CONFIG_SERVERS_INVALID');
    return { exists: true, raw, value, entries };
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, raw: null, value: {}, entries: {} };
    if (error instanceof SyntaxError) throw new Error('MCP_CONFIG_JSON_UNSUPPORTED: configuration must be valid JSON; no file was changed.');
    throw error;
  }
}

function writeConfig(location, value, expectedRaw) {
  try {
    if (fs.lstatSync(location.root).isSymbolicLink()) throw new Error('MCP_CONFIG_SYMLINK_REFUSED');
  } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  fs.mkdirSync(location.root, { recursive: true, mode: 0o700 });
  const relativeFile = path.relative(location.root, location.path);
  if (!relativeFile || relativeFile.startsWith('..') || path.isAbsolute(relativeFile)) throw new Error('MCP_CONFIG_PATH_INVALID');
  location.root = fs.realpathSync(location.root);
  location.path = path.join(location.root, relativeFile);
  const relativeDirectory = path.relative(location.root, path.dirname(location.path));
  let current = location.root;
  for (const part of relativeDirectory.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('MCP_CONFIG_SYMLINK_REFUSED');
      if (!stat.isDirectory()) throw new Error('MCP_CONFIG_PATH_NOT_DIRECTORY');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      fs.mkdirSync(current, { mode: 0o700 });
    }
  }
  inspectConfigPath(location);
  const temporary = path.join(path.dirname(location.path), `.${path.basename(location.path)}.${crypto.randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (inspectConfigPath(location).raw !== expectedRaw) throw new Error('MCP_CONFIG_CHANGED_DURING_WRITE: no configuration was replaced.');
    fs.renameSync(temporary, location.path);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function expectedFileEntry(client, invocation) {
  return { ...(client === 'vscode' ? { type: 'stdio' } : {}), command: invocation.command, args: invocation.args };
}

function fileEntryMatches(client, value, invocation) {
  return isObject(value) && (client !== 'vscode' || value.type === 'stdio')
    && value.command === invocation.command && Array.isArray(value.args)
    && value.args.length === invocation.args.length && value.args.every((arg, index) => arg === invocation.args[index]);
}

function writeFileClientConfig(client, location, { force, dryRun, invocation }) {
  const current = inspectConfigPath(location);
  const existing = current.entries[MCP_SERVER_NAME];
  if (existing && fileEntryMatches(client, existing, invocation))
    return { client, server: MCP_SERVER_NAME, status: 'already-configured', scope: location.scope, configPath: location.path };
  if (existing && !force)
    throw new Error(`MCP_SERVER_CONFLICT: ${client} already has ${MCP_SERVER_NAME}; inspect it or rerun with --force.`);
  if (dryRun) return { client, server: MCP_SERVER_NAME, status: existing ? 'would-replace' : 'would-configure',
    scope: location.scope, configPath: location.path, command: invocation.command, args: invocation.args };
  const value = { ...current.value, [location.key]: { ...current.entries,
    [MCP_SERVER_NAME]: expectedFileEntry(client, invocation) } };
  writeConfig(location, value, current.raw);
  return { client, server: MCP_SERVER_NAME, status: 'configured', scope: location.scope, configPath: location.path,
    command: invocation.command, args: invocation.args };
}

function fileClientStatus(client, location, invocation) {
  const current = inspectConfigPath(location);
  const entry = current.entries[MCP_SERVER_NAME];
  return { client, server: MCP_SERVER_NAME, scope: location.scope, configPath: location.path,
    status: !entry ? 'not-configured' : fileEntryMatches(client, entry, invocation) ? 'configured' : 'different-configuration' };
}

function isMissingConfiguration(result) {
  return result.status !== 0 && /not found|does not exist|unknown (mcp )?server|no mcp server|not configured/i.test(resultText(result));
}

function makeInvocation(client, scope, invocation) {
  if (client === 'codex') return { executable: 'codex', add: ['mcp', 'add', MCP_SERVER_NAME, '--', invocation.command, ...invocation.args],
    get: ['mcp', 'get', MCP_SERVER_NAME, '--json'], remove: ['mcp', 'remove', MCP_SERVER_NAME], list: ['mcp', 'list', '--json'] };
  if (client === 'claude-code') return { executable: 'claude',
    add: ['mcp', 'add', '--scope', scope, '--transport', 'stdio', MCP_SERVER_NAME, '--', invocation.command, ...invocation.args],
    get: ['mcp', 'get', MCP_SERVER_NAME], remove: ['mcp', 'remove', '--scope', scope, MCP_SERVER_NAME], list: ['mcp', 'list'] };
  throw new Error('CLIENT_UNSUPPORTED: choose codex, claude-code, cursor, or vscode');
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
  nodePath = process.execPath, cliEntry = process.argv[1] || DEFAULT_CLI_ENTRY, cwd = process.cwd(), home = os.homedir(),
  env = process.env, platform = process.platform } = {}) {
  if (client === 'codex' && local) throw new Error('CODEX_LOCAL_MCP_SCOPE_UNSUPPORTED: Codex mcp add writes user configuration.');
  const invocation = cliInvocation({ nodePath, cliEntry });
  if (client === 'cursor' || client === 'vscode') {
    const location = fileClientLocation(client, { local, cwd, home, env, platform });
    return writeFileClientConfig(client, location, { force, dryRun, invocation });
  }
  const scope = local ? 'local' : 'user';
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
  cliEntry = process.argv[1] || DEFAULT_CLI_ENTRY, local = false, cwd = process.cwd(), home = os.homedir(),
  env = process.env, platform = process.platform } = {}) {
  const invocation = cliInvocation({ nodePath, cliEntry });
  if (client === 'cursor' || client === 'vscode') {
    try { return fileClientStatus(client, fileClientLocation(client, { local, cwd, home, env, platform }), invocation); }
    catch (error) { return { client, server: MCP_SERVER_NAME, status: 'client-error', error: error.message }; }
  }
  const commands = makeInvocation(client, local ? 'local' : 'user', invocation);
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
    { id: 'cursor', configureCommand: 'edit MCP JSON config', scope: 'user or local' },
    { id: 'vscode', configureCommand: 'code --add-mcp or MCP JSON config', scope: 'user or local' },
  ];
}

export function removeMcp(client, { local = false, runner = defaultRunner, nodePath = process.execPath,
  cliEntry = process.argv[1] || DEFAULT_CLI_ENTRY, cwd = process.cwd(), home = os.homedir(), env = process.env,
  platform = process.platform } = {}) {
  const invocation = cliInvocation({ nodePath, cliEntry });
  if (client === 'cursor' || client === 'vscode') {
    const location = fileClientLocation(client, { local, cwd, home, env, platform });
    const current = inspectConfigPath(location);
    const existing = current.entries[MCP_SERVER_NAME];
    if (!existing) return { client, server: MCP_SERVER_NAME, status: 'not-configured', scope: location.scope,
      configPath: location.path };
    if (!fileEntryMatches(client, existing, invocation))
      throw new Error(`MCP_SERVER_CONFLICT: ${client} has a different ${MCP_SERVER_NAME} configuration; inspect it before removal.`);
    const entries = { ...current.entries };
    delete entries[MCP_SERVER_NAME];
    const value = { ...current.value };
    if (Object.keys(entries).length) value[location.key] = entries;
    else delete value[location.key];
    writeConfig(location, value, current.raw);
    return { client, server: MCP_SERVER_NAME, status: 'removed', scope: location.scope, configPath: location.path };
  }
  const scope = local ? 'local' : 'user';
  const commands = makeInvocation(client, scope, invocation);
  const result = runner(commands.executable, commands.remove);
  if (result.status !== 0) throw new Error(`MCP_REMOVE_FAILED: ${resultText(result) || result.error?.message || 'client command failed'}`);
  return { client, server: MCP_SERVER_NAME, status: 'removed', scope };
}
