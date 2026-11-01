import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_STATUS_BYTES = 64 * 1024 * 1024;
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

function git(gitRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['--no-optional-locks', '-C', gitRoot, ...args], {
    encoding: 'buffer', timeout: 30000, maxBuffer: MAX_STATUS_BYTES, windowsHide: true,
  });
  if (result.error) throw new Error(`GIT_COMMAND_FAILED:${result.error.message}`);
  if (result.status !== 0 && !allowFailure)
    throw new Error(`GIT_COMMAND_FAILED:${(result.stderr || Buffer.alloc(0)).toString('utf8').trim()}`);
  return { status: result.status, stdout: result.stdout || Buffer.alloc(0), stderr: result.stderr || Buffer.alloc(0) };
}

function canonicalDirectory(value, option) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${option}_MUST_BE_ABSOLUTE`);
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${option}_MUST_BE_DIRECTORY`);
  return fs.realpathSync(value);
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function readProjectInfo(projectRoot) {
  const filename = path.join(projectRoot, 'project.json');
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new Error('PROJECT_JSON_UNSAFE');
  const project = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw new Error('PROJECT_JSON_INVALID');
  return { name: typeof project.name === 'string' ? project.name : null,
    creatorVersion: typeof project.version === 'string' ? project.version : null };
}

function parsePorcelainV1(buffer) {
  const records = buffer.toString('utf8').split('\0');
  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4 || record[2] !== ' ') throw new Error('GIT_STATUS_OUTPUT_INVALID');
    const indexStatus = record[0];
    const worktreeStatus = record[1];
    let filename = record.slice(3);
    let renamedFrom = null;
    if (indexStatus === 'R' || indexStatus === 'C' || worktreeStatus === 'R' || worktreeStatus === 'C') {
      renamedFrom = records[index + 1];
      if (typeof renamedFrom !== 'string' || !renamedFrom) throw new Error('GIT_STATUS_RENAME_RECORD_INVALID');
      index += 1;
    }
    if (!filename || path.posix.isAbsolute(filename) || filename.split('/').includes('..'))
      throw new Error('GIT_STATUS_PATH_INVALID');
    const xy = `${indexStatus}${worktreeStatus}`;
    const state = CONFLICT_CODES.has(xy) ? 'conflicted'
      : xy === '??' ? 'untracked'
        : indexStatus === 'R' || worktreeStatus === 'R' ? 'renamed'
          : indexStatus === 'C' || worktreeStatus === 'C' ? 'copied'
            : indexStatus === 'D' || worktreeStatus === 'D' ? 'deleted'
              : indexStatus === 'A' || worktreeStatus === 'A' ? 'added' : 'modified';
    changes.push({ path: filename, status: state, indexStatus, worktreeStatus, renamedFrom,
      staged: indexStatus !== ' ' && indexStatus !== '?', unstaged: worktreeStatus !== ' ' && worktreeStatus !== '?' });
  }
  return changes;
}

function categoryFor(projectRelative) {
  const relative = projectRelative.replaceAll('\\', '/');
  if (relative.endsWith('.meta')) return 'metadata';
  if (relative === 'project.json' || relative.startsWith('settings/') || relative.startsWith('packages/')) return 'project-settings';
  const lower = relative.toLowerCase();
  if (/\.(fire|scene)$/.test(lower)) return 'scenes';
  if (lower.endsWith('.prefab')) return 'prefabs';
  if (/\.(js|ts|mjs|cjs)$/.test(lower)) return 'scripts';
  if (relative.startsWith('assets/')) return 'assets';
  return 'other';
}

function safeExists(root, relative, expectedType) {
  const segments = relative.split('/').filter(Boolean);
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') return { exists: false, safe: true }; throw error; }
    if (stat.isSymbolicLink()) return { exists: false, safe: false };
    const last = index === segments.length - 1;
    if (!last && !stat.isDirectory()) return { exists: false, safe: false };
    if (last && expectedType === 'file' && !stat.isFile()) return { exists: false, safe: false };
    if (last && expectedType === 'asset' && !stat.isFile() && !stat.isDirectory()) return { exists: false, safe: false };
  }
  return { exists: true, safe: true };
}

function metaPairing(projectRoot, projectRelative) {
  const relative = projectRelative.replaceAll('\\', '/');
  if (!relative.startsWith('assets/')) return null;
  const isMeta = relative.endsWith('.meta');
  const assetPath = isMeta ? relative.slice(0, -'.meta'.length) : relative;
  const asset = safeExists(projectRoot, assetPath, 'asset');
  const metadata = safeExists(projectRoot, `${assetPath}.meta`, 'file');
  if (!asset.safe || !metadata.safe) return { status: 'unsafe-path' };
  if (asset.exists && !metadata.exists) return { status: 'missing-meta', path: `${assetPath}.meta` };
  if (!asset.exists && metadata.exists) return { status: 'orphan-meta', path: assetPath };
  return { status: 'paired' };
}

function branchInfo(gitRoot) {
  const head = git(gitRoot, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true });
  const headHash = head.status === 0 ? head.stdout.toString('utf8').trim() : null;
  const branchResult = git(gitRoot, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true });
  const branch = branchResult.status === 0 ? branchResult.stdout.toString('utf8').trim() : null;
  const upstreamResult = git(gitRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { allowFailure: true });
  const upstream = upstreamResult.status === 0 ? upstreamResult.stdout.toString('utf8').trim() : null;
  let ahead = null;
  let behind = null;
  if (upstream) {
    const counts = git(gitRoot, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`], { allowFailure: true });
    if (counts.status === 0) {
      const [left, right] = counts.stdout.toString('utf8').trim().split(/\s+/).map(Number);
      if (Number.isInteger(left) && Number.isInteger(right)) { behind = left; ahead = right; }
    }
  }
  return { branch, detached: !branch, head: headHash, upstream, ahead, behind };
}

export function runVcsStatus({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot } = {}) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  const resolvedGitRoot = fs.realpathSync(git(gitRoot, ['rev-parse', '--show-toplevel']).stdout.toString('utf8').trim());
  if (resolvedGitRoot !== gitRoot) throw new Error('GIT_ROOT_MISMATCH');
  if (!inside(gitRoot, projectRoot)) throw new Error('PROJECT_OUTSIDE_GIT_ROOT');
  const project = readProjectInfo(projectRoot);
  const porcelain = git(gitRoot, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const repoChanges = parsePorcelainV1(porcelain.stdout);
  const projectPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const changes = [];
  const outsideProject = [];
  for (const change of repoChanges) {
    const projectRelative = projectPrefix
      ? change.path.startsWith(`${projectPrefix}/`) ? change.path.slice(projectPrefix.length + 1) : null
      : change.path;
    if (projectRelative === null) { outsideProject.push(change); continue; }
    changes.push({ ...change, projectPath: projectRelative, category: categoryFor(projectRelative),
      metaPairing: metaPairing(projectRoot, projectRelative) });
  }
  const groups = new Map();
  for (const item of changes) {
    const rows = groups.get(item.category) || [];
    rows.push(item);
    groups.set(item.category, rows);
  }
  const groupedChanges = Object.fromEntries([...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([category, rows]) => [category, rows.sort((a, b) => a.projectPath.localeCompare(b.projectPath))]));
  const summary = { total: changes.length, staged: 0, unstaged: 0, untracked: 0, conflicted: 0,
    added: 0, modified: 0, deleted: 0, renamed: 0, copied: 0, metaPairingIssues: 0 };
  for (const item of changes) {
    if (item.staged) summary.staged += 1;
    if (item.unstaged) summary.unstaged += 1;
    if (Object.hasOwn(summary, item.status)) summary[item.status] += 1;
    if (item.metaPairing && ['missing-meta', 'orphan-meta', 'unsafe-path'].includes(item.metaPairing.status))
      summary.metaPairingIssues += 1;
  }
  return { schemaVersion: 1, readOnly: true, gitRoot, projectRoot, projectName: project.name,
    creatorVersion: project.creatorVersion, ...branchInfo(gitRoot), clean: repoChanges.length === 0,
    projectClean: changes.length === 0, repositoryChangeCount: repoChanges.length,
    summary, groups: groupedChanges, outsideProjectChanges: outsideProject };
}
