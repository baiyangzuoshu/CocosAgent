import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BEGIN = '# cocos-creator-agent-cli:begin';
const END = '# cocos-creator-agent-cli:end';
const ENTRY_ID = 'cocos-creator-agent-mcp';

function dshPaths({ home = os.homedir(), env = process.env, dshHome, profile = 'web' } = {}) {
  const root = path.resolve(dshHome || env.DSH_HOME || path.join(home, '.dsh'));
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(profile)) throw new Error('DSH_PROFILE_INVALID: profile must be a simple name.');
  const profileRoot = path.join(root, 'profiles', profile);
  return { root, profileRoot, patchFile: path.join(profileRoot, 'cordis.patch.yml') };
}

function assertNoSymlinkPath(target) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`DSH_CONFIG_SYMLINK_REFUSED: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function assertInitializedProfile(paths) {
  for (const target of [paths.root, paths.profileRoot, path.join(paths.profileRoot, 'package.json')]) {
    let stat;
    try { stat = fs.lstatSync(target); }
    catch (error) { if (error.code === 'ENOENT') throw new Error(`DSH_PROFILE_NOT_INITIALIZED: run DeepSeek Harness once with profile '${path.basename(paths.profileRoot)}' before configuring it.`); throw error; }
    if (stat.isSymbolicLink()) throw new Error(`DSH_CONFIG_SYMLINK_REFUSED: ${target}`);
    if (target.endsWith('package.json') ? !stat.isFile() : !stat.isDirectory()) throw new Error(`DSH_PROFILE_INVALID: ${target}`);
  }
}

function readPatch(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('DSH_CONFIG_FILE_UNSAFE');
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

function quoteYaml(value) { return `'${String(value).replaceAll("'", "''")}'`; }

function managedBlock(invocation) {
  return [
    BEGIN,
    '- insert:',
    `    - id: ${ENTRY_ID}`,
    "      name: '@deepseek-ai/dsh-mcp-client'",
    '      config:',
    '        serverName: cocos-creator-agent',
    '        transport: stdio',
    `        command: ${quoteYaml(invocation.command)}`,
    '        args:',
    ...invocation.args.map((arg) => `          - ${quoteYaml(arg)}`),
    END,
  ].join('\n');
}

function locateManagedBlock(content) {
  const begin = content.indexOf(BEGIN);
  const end = content.indexOf(END);
  if (begin === -1 && end === -1) return null;
  if (begin === -1 || end === -1 || end < begin || content.indexOf(BEGIN, begin + BEGIN.length) !== -1
    || content.indexOf(END, end + END.length) !== -1) throw new Error('DSH_CONFIG_MANAGED_BLOCK_INVALID');
  const before = content.slice(0, begin);
  const blockEnd = end + END.length;
  const after = content.slice(blockEnd);
  return { before, block: content.slice(begin, blockEnd), after, start: begin, end: blockEnd };
}

function validatePatchShape(content) {
  const active = content.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  if (active.length && !active[0].startsWith('-'))
    throw new Error('DSH_CONFIG_PATCH_UNSUPPORTED: expected a top-level Cordis patch sequence; file was not changed.');
}

function atomicWrite(file, content, expected) {
  const directory = path.dirname(file);
  const current = readPatch(file);
  if (current !== expected) throw new Error('DSH_CONFIG_CHANGED_DURING_WRITE: configuration was not replaced.');
  const temporary = path.join(directory, `.${path.basename(file)}.${crypto.randomUUID()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    if (readPatch(file) !== expected) throw new Error('DSH_CONFIG_CHANGED_DURING_WRITE: configuration was not replaced.');
    fs.renameSync(temporary, file);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw error;
  }
}

function entryStatus(content, expected) {
  const found = locateManagedBlock(content);
  if (found) return found.block === expected ? { status: 'configured', found } : { status: 'different-configuration', found };
  if (content.includes(`id: ${ENTRY_ID}`)) throw new Error('DSH_CONFIG_UNMANAGED_CONFLICT: an entry with the Cocos id already exists.');
  return { status: 'not-configured', found: null };
}

export function configureDeepseekHarness(invocation, { home = os.homedir(), env = process.env, dshHome, profile = 'web',
  dryRun = false, force = false } = {}) {
  const paths = dshPaths({ home, env, dshHome, profile });
  assertNoSymlinkPath(paths.patchFile);
  assertInitializedProfile(paths);
  const current = readPatch(paths.patchFile);
  validatePatchShape(current);
  const expected = managedBlock(invocation);
  const state = entryStatus(current, expected);
  if (state.status === 'configured') return { client: 'deepseek-harness', scope: 'user', profile,
    configPath: paths.patchFile, status: 'already-configured', command: invocation.command, args: invocation.args };
  if (state.status === 'different-configuration' && !force)
    throw new Error('MCP_SERVER_CONFLICT: DeepSeek Harness has a modified Cocos CLI block; inspect it or rerun with --force.');
  if (dryRun) return { client: 'deepseek-harness', scope: 'user', profile, configPath: paths.patchFile,
    status: state.status === 'different-configuration' ? 'would-replace' : 'would-configure',
    command: invocation.command, args: invocation.args };
  const next = state.found
    ? `${state.found.before}${expected}${state.found.after}`
    : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${expected}\n`;
  atomicWrite(paths.patchFile, next, current);
  return { client: 'deepseek-harness', scope: 'user', profile, configPath: paths.patchFile,
    status: state.status === 'different-configuration' ? 'replaced' : 'configured', command: invocation.command, args: invocation.args };
}

export function deepseekHarnessStatus(invocation, options = {}) {
  try {
    const paths = dshPaths(options);
    assertNoSymlinkPath(paths.patchFile);
    assertInitializedProfile(paths);
    const content = readPatch(paths.patchFile);
    const state = entryStatus(content, managedBlock(invocation));
    return { client: 'deepseek-harness', scope: 'user', profile: options.profile || 'web', configPath: paths.patchFile,
      status: state.status };
  } catch (error) {
    return { client: 'deepseek-harness', scope: 'user', profile: options.profile || 'web',
      status: 'client-error', error: error.message };
  }
}

export function removeDeepseekHarness(invocation, options = {}) {
  const paths = dshPaths(options);
  assertNoSymlinkPath(paths.patchFile);
  assertInitializedProfile(paths);
  const current = readPatch(paths.patchFile);
  const state = entryStatus(current, managedBlock(invocation));
  if (state.status === 'not-configured') return { client: 'deepseek-harness', scope: 'user',
    profile: options.profile || 'web', configPath: paths.patchFile, status: 'not-configured' };
  if (state.status !== 'configured') throw new Error('MCP_SERVER_CONFLICT: refusing to remove a modified DeepSeek Harness block.');
  let next = `${state.found.before}${state.found.after}`;
  if (next.startsWith('\n\n')) next = next.slice(1);
  atomicWrite(paths.patchFile, next, current);
  return { client: 'deepseek-harness', scope: 'user', profile: options.profile || 'web',
    configPath: paths.patchFile, status: 'removed' };
}
