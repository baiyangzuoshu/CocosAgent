import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const MARKER = '.cocos-creator-agent-managed.json';

function skillRoot(client, { local = false, cwd = process.cwd(), home = os.homedir(), env = process.env, dshHome } = {}) {
  if (client === 'codex') return local ? path.join(cwd, '.agents', 'skills') : path.join(env.CODEX_HOME || path.join(home, '.codex'), 'skills');
  if (client === 'claude-code') return local ? path.join(cwd, '.claude', 'skills') : path.join(env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'), 'skills');
  if (client === 'deepseek-harness') {
    if (local) throw new Error('DSH_LOCAL_SKILLS_UNSUPPORTED: install to the DeepSeek Harness user skill directory.');
    return path.join(dshHome || env.DSH_HOME || path.join(home, '.dsh'), 'skills');
  }
  throw new Error('CLIENT_UNSUPPORTED: choose codex, claude-code, or deepseek-harness');
}

function listFiles(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`SKILL_SOURCE_SYMLINK: ${path.join(relative, entry.name)}`);
    const childRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, childRelative));
    else if (entry.isFile()) files.push(childRelative);
    else throw new Error(`SKILL_SOURCE_ENTRY_UNSUPPORTED: ${childRelative}`);
  }
  return files;
}

function hashes(root, { excludeMarker = false } = {}) {
  const result = {};
  for (const relative of listFiles(root)) {
    if (excludeMarker && relative === MARKER) continue;
    result[relative.split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
  }
  return result;
}

function assertNoSymlinkComponents(target) {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const part of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`SKILL_TARGET_SYMLINK: ${current}`);
      if (!stat.isDirectory() && current !== resolved) throw new Error(`SKILL_TARGET_NOT_DIRECTORY: ${current}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function readMarker(target) {
  const markerPath = path.join(target, MARKER);
  try {
    const stat = fs.lstatSync(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error('SKILL_MARKER_UNSAFE');
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (marker.schemaVersion !== 1 || !marker.files || typeof marker.files !== 'object') throw new Error('SKILL_MARKER_INVALID');
    return marker;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function backupDirectory(target, label, backupRoot) {
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const backup = path.join(backupRoot, `${label}-${stamp}-${crypto.randomBytes(4).toString('hex')}`);
  fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
  fs.cpSync(target, backup, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true, verbatimSymlinks: true });
  return backup;
}

function installManagedDirectory(source, target, label, { force = false, dryRun = false, backupRoot } = {}) {
  if (!fs.existsSync(source)) throw new Error(`SKILL_SOURCE_NOT_FOUND: ${source}`);
  assertNoSymlinkComponents(path.dirname(target));
  const sourceHashes = hashes(source);
  if (!Object.keys(sourceHashes).length) throw new Error(`SKILL_SOURCE_EMPTY: ${source}`);
  let currentExists = false;
  let currentHashes = null;
  let marker = null;
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`SKILL_TARGET_UNSAFE: ${target}`);
    currentExists = true;
    marker = readMarker(target);
    currentHashes = hashes(target, { excludeMarker: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  if (currentExists && !marker && !force) return { label, target, status: 'conflict-unmanaged' };
  const drifted = currentExists && marker && JSON.stringify(currentHashes) !== JSON.stringify(marker.files);
  if (drifted && !force) return { label, target, status: 'conflict-modified' };
  if (dryRun) return { label, target, status: !currentExists ? 'would-install' : (force || drifted) ? 'would-backup-and-replace' : 'would-refresh' };

  let backup = null;
  if (currentExists && (force || drifted)) backup = backupDirectory(target, label, backupRoot);
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  const stage = path.join(parent, `.${path.basename(target)}.cocos-stage-${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(stage, { mode: 0o700 });
  try {
    for (const [relative, digest] of Object.entries(sourceHashes)) {
      const destination = path.join(stage, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
      fs.copyFileSync(path.join(source, relative), destination, fs.constants.COPYFILE_EXCL);
      if (crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex') !== digest) throw new Error(`SKILL_COPY_HASH_MISMATCH: ${relative}`);
    }
    fs.writeFileSync(path.join(stage, MARKER), `${JSON.stringify({ schemaVersion: 1, managedBy: 'cocos-creator-agent-cli', files: sourceHashes }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    const displaced = path.join(parent, `.${path.basename(target)}.cocos-old-${crypto.randomBytes(8).toString('hex')}`);
    if (currentExists) fs.renameSync(target, displaced);
    try { fs.renameSync(stage, target); }
    catch (error) { if (currentExists) fs.renameSync(displaced, target); throw error; }
    if (currentExists) fs.rmSync(displaced, { recursive: true, force: true });
  } catch (error) { fs.rmSync(stage, { recursive: true, force: true }); throw error; }
  return { label, target, status: !currentExists ? 'installed' : (force || drifted) ? 'replaced' : 'refreshed', ...(backup ? { backup } : {}) };
}

export function availableSkills({ skillsRoot = path.join(PACKAGE_ROOT, 'skills') } = {}) {
  if (!fs.existsSync(skillsRoot)) return [];
  return fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name).filter((name) => fs.existsSync(path.join(skillsRoot, name, 'SKILL.md'))).sort();
}

export function showSkill(name, { skillsRoot = path.join(PACKAGE_ROOT, 'skills'), list = false } = {}) {
  if (list) return availableSkills({ skillsRoot }).map((skill) => ({ name: skill, path: `${skill}/SKILL.md` }));
  if (!name) throw new Error('SKILL_NAME_REQUIRED');
  if (!availableSkills({ skillsRoot }).includes(name)) throw new Error(`SKILL_NOT_FOUND: ${name}`);
  return fs.readFileSync(path.join(skillsRoot, name, 'SKILL.md'), 'utf8');
}

export function installSkills(client, { local = false, force = false, dryRun = false, selected = [],
  cwd = process.cwd(), home = os.homedir(), env = process.env, packageVersion = 'unknown',
  skillsRoot = path.join(PACKAGE_ROOT, 'skills'), referencesRoot = path.join(PACKAGE_ROOT, 'references', '2x'), dshHome } = {}) {
  const targetRoot = skillRoot(client, { local, cwd, home, env, dshHome });
  const names = selected.length ? [...new Set(selected)] : availableSkills({ skillsRoot });
  const known = new Set(availableSkills({ skillsRoot }));
  for (const name of names) if (!known.has(name)) throw new Error(`SKILL_NOT_FOUND: ${name}`);
  if (!names.length) throw new Error('NO_SKILLS_AVAILABLE');
  const backupRoot = path.join(home, '.cocos-creator-agent', 'skill-backups');
  const entries = names.map((name) => ({ source: path.join(skillsRoot, name), target: path.join(targetRoot, name), label: name }));
  if (fs.existsSync(referencesRoot)) {
    entries.push({ source: referencesRoot, target: path.resolve(targetRoot, '..', 'references', '2x'), label: 'creator-2x-references' });
  }
  const options = { force, dryRun, backupRoot };
  const plans = entries.map((entry) => installManagedDirectory(entry.source, entry.target, entry.label, { ...options, dryRun: true }));
  const planConflicts = plans.filter((item) => item.status.startsWith('conflict-'));
  if (dryRun || (planConflicts.length && !force)) return { client, scope: local ? 'project' : 'user', skillsRoot: targetRoot,
    packageVersion, results: plans, success: planConflicts.length === 0,
    installedCount: plans.filter((item) => ['installed', 'refreshed', 'replaced'].includes(item.status)).length };
  const results = entries.map((entry) => installManagedDirectory(entry.source, entry.target, entry.label, options));
  const conflicts = results.filter((item) => item.status.startsWith('conflict-'));
  return { client, scope: local ? 'project' : 'user', skillsRoot: targetRoot, packageVersion, results,
    success: conflicts.length === 0, installedCount: results.filter((item) => ['installed', 'refreshed', 'replaced'].includes(item.status)).length };
}

export function listSkillStatus(client, { local = false, cwd = process.cwd(), home = os.homedir(), env = process.env,
  skillsRoot = path.join(PACKAGE_ROOT, 'skills'), dshHome } = {}) {
  const root = skillRoot(client, { local, cwd, home, env, dshHome });
  return availableSkills({ skillsRoot }).map((name) => {
    const target = path.join(root, name);
    if (!fs.existsSync(target)) return { name, status: 'not-installed', target };
    const marker = readMarker(target);
    if (!marker) return { name, status: 'unmanaged', target };
    return { name, status: JSON.stringify(hashes(target, { excludeMarker: true })) === JSON.stringify(marker.files) ? 'installed' : 'modified', target };
  });
}
