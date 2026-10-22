import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { diffCreatorSerializedAssets, inspectCreatorSerializedAsset } from './creator-asset-diff.mjs';

const MAX_GIT_OUTPUT = 18 * 1024 * 1024;
const ASSET_PATH = /\.(?:fire|prefab)$/i;

function coded(code) { const error = new Error(code); error.code = code; return error; }

function git(gitRoot, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', ['--no-optional-locks', '-C', gitRoot, ...args], {
    encoding: 'buffer', timeout: 30000, maxBuffer: MAX_GIT_OUTPUT, windowsHide: true,
  });
  if (result.error) throw coded(`GIT_COMMAND_FAILED:${result.error.message}`);
  if (result.status !== 0 && !allowFailure)
    throw coded(`GIT_COMMAND_FAILED:${(result.stderr || Buffer.alloc(0)).toString('utf8').trim()}`);
  return { status: result.status, stdout: result.stdout || Buffer.alloc(0), stderr: result.stderr || Buffer.alloc(0) };
}

function canonicalDirectory(value, option) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw coded(`${option}_MUST_BE_ABSOLUTE`);
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw coded(`${option}_MUST_BE_DIRECTORY`);
  return fs.realpathSync(value);
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function ensureProject(gitRoot, projectRoot) {
  const resolvedRoot = fs.realpathSync(git(gitRoot, ['rev-parse', '--show-toplevel']).stdout.toString('utf8').trim());
  if (resolvedRoot !== gitRoot) throw coded('GIT_ROOT_MISMATCH');
  if (!inside(gitRoot, projectRoot)) throw coded('PROJECT_OUTSIDE_GIT_ROOT');
  const projectFile = path.join(projectRoot, 'project.json');
  const stat = fs.lstatSync(projectFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw coded('PROJECT_JSON_UNSAFE');
  let project;
  try { project = JSON.parse(fs.readFileSync(projectFile, 'utf8')); }
  catch (_) { throw coded('PROJECT_JSON_INVALID'); }
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw coded('PROJECT_JSON_INVALID');
  if (project.version !== '2.4.15') throw coded('CREATOR_VERSION_UNSUPPORTED');
}

function projectAssetPath(projectRoot, inputPath) {
  if (typeof inputPath !== 'string' || !inputPath || inputPath.includes('\0') || path.isAbsolute(inputPath))
    throw coded('VCS_DIFF_PATH_INVALID');
  const portable = inputPath.replaceAll('\\', '/');
  const normalized = path.posix.normalize(portable);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized.startsWith('/')
    || !normalized.startsWith('assets/')
    || !ASSET_PATH.test(normalized)) throw coded('VCS_DIFF_PATH_INVALID');
  const absolute = path.resolve(projectRoot, ...normalized.split('/'));
  if (!inside(projectRoot, absolute)) throw coded('VCS_DIFF_PATH_INVALID');
  return { relative: normalized, absolute };
}

function readWorkingFile(root, relative, maxBytes) {
  const segments = relative.split('/');
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw coded('VCS_DIFF_SYMLINK_REFUSED');
    const final = index === segments.length - 1;
    if (!final && !stat.isDirectory()) throw coded('VCS_DIFF_PATH_NOT_REGULAR');
    if (final && (!stat.isFile() || stat.size > maxBytes)) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  }
  const before = fs.lstatSync(current);
  const bytes = fs.readFileSync(current);
  const after = fs.lstatSync(current);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
    || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) throw coded('VCS_DIFF_FILE_CHANGED_DURING_READ');
  return bytes;
}

function commitForRevision(gitRoot, revision) {
  if (typeof revision !== 'string' || !revision || revision.length > 256 || revision.startsWith('-'))
    throw coded('VCS_DIFF_REVISION_INVALID');
  const result = git(gitRoot, ['rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], { allowFailure: true });
  if (result.status !== 0) throw coded('VCS_DIFF_REVISION_INVALID');
  const commit = result.stdout.toString('utf8').trim();
  if (!/^[0-9a-f]{40,64}$/i.test(commit)) throw coded('VCS_DIFF_REVISION_INVALID');
  return commit;
}

function readRevisionFile(gitRoot, commit, relative, maxBytes) {
  const object = git(gitRoot, ['cat-file', 'blob', `${commit}:${relative}`], { allowFailure: true });
  if (object.status !== 0) throw coded('VCS_DIFF_REVISION_PATH_NOT_FOUND');
  if (object.stdout.length > maxBytes) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  return object.stdout;
}

function readRevisionFileIfPresent(gitRoot, commit, relative, maxBytes) {
  const object = git(gitRoot, ['cat-file', 'blob', `${commit}:${relative}`], { allowFailure: true });
  if (object.status !== 0) return null;
  if (object.stdout.length > maxBytes) throw coded('VCS_DIFF_FILE_UNSAFE_OR_TOO_LARGE');
  return object.stdout;
}

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }

export function runVcsDiff({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot, assetPath: inputAssetPath,
  from = 'HEAD', to } = {}) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  ensureProject(gitRoot, projectRoot);
  const asset = projectAssetPath(projectRoot, inputAssetPath);
  const metaRelative = `${asset.relative}.meta`;
  const repoPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const repoAssetPath = repoPrefix ? `${repoPrefix}/${asset.relative}` : asset.relative;
  const repoMetaPath = `${repoAssetPath}.meta`;

  const fromCommit = commitForRevision(gitRoot, from);
  const beforeBytes = readRevisionFile(gitRoot, fromCommit, repoAssetPath, 16 * 1024 * 1024);
  const beforeMetaBytes = readRevisionFile(gitRoot, fromCommit, repoMetaPath, 64 * 1024);
  let afterBytes;
  let afterMetaBytes;
  let toCommit = null;
  let afterScope;
  if (to === undefined || to === null || to === '') {
    afterBytes = readWorkingFile(projectRoot, asset.relative, 16 * 1024 * 1024);
    afterMetaBytes = readWorkingFile(projectRoot, metaRelative, 64 * 1024);
    const confirmedBytes = readWorkingFile(projectRoot, asset.relative, 16 * 1024 * 1024);
    const confirmedMetaBytes = readWorkingFile(projectRoot, metaRelative, 64 * 1024);
    if (sha256(confirmedBytes) !== sha256(afterBytes) || sha256(confirmedMetaBytes) !== sha256(afterMetaBytes))
      throw coded('VCS_DIFF_WORKTREE_CHANGED_DURING_READ');
    afterScope = 'working-tree';
  } else {
    toCommit = commitForRevision(gitRoot, to);
    afterBytes = readRevisionFile(gitRoot, toCommit, repoAssetPath, 16 * 1024 * 1024);
    afterMetaBytes = readRevisionFile(gitRoot, toCommit, repoMetaPath, 64 * 1024);
    afterScope = toCommit;
  }
  const semanticDiff = diffCreatorSerializedAssets({ beforeBytes, beforeMetaBytes,
    afterBytes, afterMetaBytes, assetPath: asset.relative });
  return { schemaVersion: 1, readOnly: true, projectRoot, gitRoot, creatorVersion: '2.4.15',
    asset: semanticDiff.asset,
    from: { revision: from, commit: fromCommit, scope: fromCommit,
      sourceSha256: sha256(beforeBytes), metaSha256: sha256(beforeMetaBytes) },
    to: { revision: to === undefined || to === null || to === '' ? null : to,
      commit: toCommit, scope: afterScope,
      sourceSha256: sha256(afterBytes), metaSha256: sha256(afterMetaBytes) },
    diff: semanticDiff };
}

function revisionAsset(gitRoot, commit, assetPath, metaPath) {
  const sourceBytes = readRevisionFileIfPresent(gitRoot, commit, assetPath, 16 * 1024 * 1024);
  const metaBytes = readRevisionFileIfPresent(gitRoot, commit, metaPath, 64 * 1024);
  if (sourceBytes === null && metaBytes === null) return null;
  if (sourceBytes === null || metaBytes === null) throw coded('VCS_BLAME_ASSET_PAIR_INCOMPLETE');
  return { sourceBytes, metaBytes,
    snapshot: inspectCreatorSerializedAsset({ sourceBytes, metaBytes, assetPath: path.posix.basename(assetPath) }) };
}

function nodeChange(before, after, nodeUuid, assetPath) {
  const beforeNode = before?.snapshot.nodes.find((node) => node.uuid === nodeUuid) || null;
  const afterNode = after?.snapshot.nodes.find((node) => node.uuid === nodeUuid) || null;
  if (!before && afterNode) return { type: 'added', node: afterNode };
  if (before && !after && beforeNode) return { type: 'asset-deleted', node: beforeNode };
  if (!before || !after) return null;
  const diff = diffCreatorSerializedAssets({ beforeBytes: before.sourceBytes, beforeMetaBytes: before.metaBytes,
    afterBytes: after.sourceBytes, afterMetaBytes: after.metaBytes, assetPath });
  const added = diff.added.find((node) => node.uuid === nodeUuid);
  if (added) return { type: 'added', node: added };
  const removed = diff.removed.find((node) => node.uuid === nodeUuid);
  if (removed) return { type: 'removed', node: removed };
  const changed = diff.changed.find((node) => node.uuid === nodeUuid);
  return changed ? { type: 'modified', change: changed } : null;
}

function commitDetails(gitRoot, commit) {
  const response = git(gitRoot, ['show', '-s', '--format=%H%x00%an%x00%ae%x00%aI%x00%s', commit]);
  const [hashValue, author, email, authoredAt, ...subject] = response.stdout.toString('utf8').split('\0');
  return { commit: hashValue, author, email, authoredAt,
    subject: subject.join('\0').replace(/[\r\n]+$/, '') };
}

function firstParent(gitRoot, commit) {
  const response = git(gitRoot, ['rev-list', '--parents', '-n', '1', commit]);
  const [current, parent] = response.stdout.toString('utf8').trim().split(/\s+/);
  if (current !== commit) throw coded('VCS_BLAME_HISTORY_INVALID');
  return parent || null;
}

export function runVcsObjectBlame({ gitRoot: requestedGitRoot, projectRoot: requestedProjectRoot,
  assetPath: inputAssetPath, nodeUuid, revision = 'HEAD', maxCommits = 128 } = {}) {
  const gitRoot = canonicalDirectory(requestedGitRoot, 'GIT_ROOT');
  const projectRoot = canonicalDirectory(requestedProjectRoot, 'PROJECT_ROOT');
  ensureProject(gitRoot, projectRoot);
  const asset = projectAssetPath(projectRoot, inputAssetPath);
  if (typeof nodeUuid !== 'string' || !nodeUuid || nodeUuid.length > 128 || nodeUuid.includes('\0'))
    throw coded('VCS_BLAME_NODE_UUID_INVALID');
  if (!Number.isInteger(maxCommits) || maxCommits < 1 || maxCommits > 256)
    throw coded('VCS_BLAME_HISTORY_LIMIT_INVALID');
  if (git(gitRoot, ['rev-parse', '--is-shallow-repository']).stdout.toString('utf8').trim() === 'true')
    throw coded('VCS_BLAME_SHALLOW_REPOSITORY_UNSUPPORTED');
  const targetCommit = commitForRevision(gitRoot, revision);
  const repoPrefix = path.relative(gitRoot, projectRoot).split(path.sep).filter(Boolean).join('/');
  const repoAssetPath = repoPrefix ? `${repoPrefix}/${asset.relative}` : asset.relative;
  const repoMetaPath = `${repoAssetPath}.meta`;
  const targetAsset = revisionAsset(gitRoot, targetCommit, repoAssetPath, repoMetaPath);
  const targetNode = targetAsset?.snapshot.nodes.find((node) => node.uuid === nodeUuid) || null;
  const history = git(gitRoot, ['log', '--first-parent', `--max-count=${maxCommits + 1}`, '--format=%H',
    targetCommit, '--', `:(literal)${repoAssetPath}`, `:(literal)${repoMetaPath}`]);
  const commits = history.stdout.toString('utf8').split(/\r?\n/).filter(Boolean);
  const truncated = commits.length > maxCommits;
  let lastChange = null;
  let historyScanned = 0;
  for (const commit of commits.slice(0, maxCommits)) {
    historyScanned += 1;
    const parent = firstParent(gitRoot, commit);
    const before = parent ? revisionAsset(gitRoot, parent, repoAssetPath, repoMetaPath) : null;
    const after = revisionAsset(gitRoot, commit, repoAssetPath, repoMetaPath);
    const change = nodeChange(before, after, nodeUuid, asset.relative);
    if (change) {
      lastChange = { ...commitDetails(gitRoot, commit), ...change };
      break;
    }
  }
  return { schemaVersion: 1, readOnly: true, projectRoot, gitRoot, creatorVersion: '2.4.15',
    asset: { path: asset.relative, uuid: targetAsset?.snapshot.assetUuid || null,
      type: targetAsset?.snapshot.assetType || path.extname(asset.relative).slice(1) },
    nodeUuid, revision, revisionCommit: targetCommit, existsAtRevision: Boolean(targetNode),
    found: Boolean(targetNode || lastChange), lastChange, history: { strategy: 'first-parent-path',
      scannedCommits: historyScanned, maxCommits, truncated },
    limitations: { objectIdentity: 'Creator serialized node UUID', componentChanges: 'Reported with the owning node change.',
      renames: 'The path history does not follow asset renames.',
      prefabOverrides: 'Scene changes on linked Prefab instances remain attributed to the scene instance node.' } };
}
