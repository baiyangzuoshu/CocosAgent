import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { runVcsStatus } from './vcs-status.mjs';
import { runVcsImpact } from './vcs-impact.mjs';
import { isSupportedCreatorVersion } from './bridge/contracts.mjs';

const MAX_OUTPUT = 64 * 1024 * 1024;
const MAX_DIRTY_FILES = 4000;
const MAX_FILE_BYTES = 1024 * 1024 * 1024;
const CACHE_NAMES = new Set(['library', 'temp', 'local', 'build']);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fail = (code, detail) => { throw Object.assign(new Error(code), { code, ...(detail ? { detail } : {}) }); };

function git(root, args, { optional = false, mutation = false } = {}) {
  const result = spawnSync('git', ['--no-optional-locks', ...(mutation ? ['-c', 'submodule.recurse=false'] : []), '-C', root, ...args], {
    encoding: 'buffer', maxBuffer: MAX_OUTPUT, timeout: mutation ? 120000 : 30000, windowsHide: true,
  });
  if (result.error && !mutation) fail('VCS_GIT_READ_FAILED', { reason: result.error.code });
  if (result.status !== 0 && !optional && !mutation) fail('VCS_GIT_READ_FAILED', { command: args[0] });
  return { status: result.status, stdout: result.stdout || Buffer.alloc(0), stderr: result.stderr || Buffer.alloc(0),
    interrupted: Boolean(result.error || result.signal) };
}

function text(root, args, optional = false) { return git(root, args, { optional }).stdout.toString('utf8').trim(); }

function safeRelative(value) {
  if (!value || value.includes('\0') || value.includes('\\') || path.posix.isAbsolute(value)
    || value.split('/').some((part) => !part || part === '.' || part === '..')) fail('VCS_PATH_INVALID');
  return value;
}

function validateRootSegments(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail('VCS_ROOT_MUST_BE_ABSOLUTE');
  // macOS /tmp and /var themselves are system symlinks. Canonicalize the caller's root,
  // then refuse symlinks in paths below it rather than rejecting the system aliases.
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('VCS_ROOT_MUST_BE_DIRECTORY');
  return fs.realpathSync(value);
}

function context(options) {
  const gitRoot = validateRootSegments(options.gitRoot);
  const projectRoot = validateRootSegments(options.projectRoot);
  const relative = path.relative(gitRoot, projectRoot);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('PROJECT_OUTSIDE_GIT_ROOT');
  const status = runVcsStatus({ gitRoot, projectRoot });
  if (!isSupportedCreatorVersion(status.creatorVersion)) fail('CREATOR_VERSION_UNSUPPORTED');
  if (!status.head) fail('VCS_HEAD_REQUIRED');
  const prefix = relative.split(path.sep).filter(Boolean).join('/');
  return { gitRoot, projectRoot, prefix, status };
}

function commit(root, ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || ref.includes('\0') || ref.length > 256)
    fail('VCS_TARGET_INVALID');
  const result = git(root, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], { optional: true });
  const hash = result.stdout.toString('utf8').trim();
  if (result.status !== 0 || !/^[0-9a-f]{40,64}$/.test(hash)) fail('VCS_TARGET_INVALID');
  return hash;
}

function branchName(root, value) {
  if (typeof value !== 'string' || !value || value.startsWith('-') || value.startsWith('refs/')
    || value.includes('@{') || value.length > 240
    || git(root, ['check-ref-format', `refs/heads/${value}`], { optional: true }).status !== 0) fail('VCS_BRANCH_INVALID');
  return value;
}

function dirtyEntries(status) {
  return [...Object.values(status.groups).flat(), ...status.outsideProjectChanges]
    .sort((a, b) => a.path.localeCompare(b.path));
}

function workingFingerprint(root, relative) {
  safeRelative(relative);
  let current = root;
  const segments = relative.split('/');
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) { if (error.code === 'ENOENT') return { kind: 'absent' }; throw error; }
    if (stat.isSymbolicLink()) {
      if (index !== segments.length - 1) fail('VCS_DIRTY_SYMLINK_ANCESTOR');
      return { kind: 'symlink', sha256: sha(fs.readlinkSync(current)) };
    }
    if (index !== segments.length - 1) {
      if (!stat.isDirectory()) fail('VCS_DIRTY_PATH_UNSAFE');
      continue;
    }
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) fail('VCS_DIRTY_FILE_UNSAFE_OR_TOO_LARGE');
    const hash = createHash('sha256');
    const fd = fs.openSync(current, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const before = fs.fstatSync(fd);
      const buffer = Buffer.alloc(1024 * 1024);
      let length = 0;
      for (;;) {
        const count = fs.readSync(fd, buffer, 0, buffer.length, null);
        if (!count) break;
        length += count;
        if (length > MAX_FILE_BYTES) fail('VCS_DIRTY_FILE_UNSAFE_OR_TOO_LARGE');
        hash.update(buffer.subarray(0, count));
      }
      const after = fs.fstatSync(fd);
      const named = fs.lstatSync(current);
      if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs
        || after.ino !== named.ino || named.isSymbolicLink() || length !== after.size) fail('VCS_DIRTY_CHANGED_DURING_READ');
      return { kind: 'file', mode: after.mode & 0o777, size: after.size, sha256: hash.digest('hex') };
    } finally { fs.closeSync(fd); }
  }
}

function protectedState(root, entries) {
  if (entries.length > MAX_DIRTY_FILES) fail('VCS_DIRTY_FILES_TOO_MANY');
  const paths = [...new Set(entries.flatMap((item) => [item.path, ...(item.renamedFrom ? [item.renamedFrom] : [])]))].sort();
  return paths.map((relative) => ({ path: relative, worktree: workingFingerprint(root, relative),
    indexSha256: sha(git(root, ['ls-files', '--stage', '-z', '--', `:(literal)${relative}`]).stdout) }));
}

function repositoryState(ctx) {
  const entries = dirtyEntries(ctx.status);
  const progress = {};
  for (const name of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer']) {
    const filename = text(ctx.gitRoot, ['rev-parse', '--path-format=absolute', '--git-path', name]);
    if (fs.existsSync(filename)) progress[name] = true;
  }
  const indexPath = text(ctx.gitRoot, ['rev-parse', '--path-format=absolute', '--git-path', 'index']);
  if (fs.existsSync(`${indexPath}.lock`)) progress.indexLock = true;
  return { head: ctx.status.head, branch: ctx.status.branch, upstream: ctx.status.upstream,
    progress, protected: protectedState(ctx.gitRoot, entries),
    statusSha256: sha(JSON.stringify(entries.map(({ path: filename, indexStatus, worktreeStatus, renamedFrom }) =>
      ({ path: filename, indexStatus, worktreeStatus, renamedFrom })))),
    indexSha256: fs.existsSync(indexPath) ? sha(fs.readFileSync(indexPath)) : null,
    configSha256: sha(git(ctx.gitRoot, ['config', '--null', '--list']).stdout) };
}

function tree(root, revision) {
  const listed = git(root, ['ls-tree', '-r', '-z', '--full-tree', revision]).stdout.toString('utf8').split('\0').filter(Boolean);
  if (listed.length > 200000) fail('VCS_TARGET_TREE_TOO_LARGE');
  return new Map(listed.map((row) => {
    const split = row.indexOf('\t');
    const [mode, type, hash] = row.slice(0, split).split(' ');
    const filename = safeRelative(row.slice(split + 1));
    if (split < 0 || !/^[0-9a-f]{40,64}$/.test(hash)) fail('VCS_TREE_OUTPUT_INVALID');
    return [filename, { mode, type, hash }];
  }));
}

function targetIntegrity(ctx, revision, changes) {
  const rows = tree(ctx.gitRoot, revision);
  const prefix = ctx.prefix ? `${ctx.prefix}/` : '';
  const assetsPrefix = `${prefix}assets/`;
  const blockers = [];
  const warnings = [];
  const assetFiles = new Set([...rows.keys()].filter((item) => item.startsWith(assetsPrefix)));
  const assetDirs = new Set();
  for (const filename of assetFiles) {
    let directory = path.posix.dirname(filename);
    while (directory.startsWith(assetsPrefix)) { assetDirs.add(directory); directory = path.posix.dirname(directory); }
  }
  const projectFile = rows.get(`${prefix}project.json`);
  if (!projectFile || projectFile.mode !== '100644' && projectFile.mode !== '100755') blockers.push('target-project-missing-or-unsafe');
  for (const [filename, item] of rows) {
    if (!filename.startsWith(prefix)) continue;
    const projectPath = filename.slice(prefix.length);
    if (CACHE_NAMES.has(projectPath.split('/')[0])) blockers.push(`tracked-cache:${projectPath}`);
    if (projectPath.startsWith('assets/') && !['100644', '100755'].includes(item.mode)) blockers.push(`unsafe-asset:${projectPath}`);
  }
  const changed = changes.filter((item) => item.projectPath?.startsWith('assets/'));
  for (const item of changed) {
    const filename = item.path;
    const owner = filename.endsWith('.meta') ? filename.slice(0, -5) : filename;
    const ownerPresent = assetFiles.has(owner) || assetDirs.has(owner);
    const metaPresent = assetFiles.has(`${owner}.meta`);
    if (ownerPresent !== metaPresent) blockers.push(`asset-meta-pair:${owner.slice(prefix.length)}`);
    if (metaPresent) {
      const metadata = rows.get(`${owner}.meta`);
      if (!['100644', '100755'].includes(metadata.mode)) continue;
      const bytes = git(ctx.gitRoot, ['cat-file', 'blob', metadata.hash]).stdout;
      if (bytes.length > 2 * 1024 * 1024) { blockers.push(`metadata-too-large:${owner.slice(prefix.length)}`); continue; }
      let value;
      try { value = JSON.parse(bytes.toString('utf8')); } catch (_) { /* rejected below */ }
      if (!value || typeof value.uuid !== 'string' || !value.uuid) blockers.push(`metadata-identity-invalid:${owner.slice(prefix.length)}`);
      if (item.path.endsWith('.meta')) warnings.push(`review-metadata-identity:${item.projectPath}`);
    }
    // A newly added/deleted descendant also changes whether its folder sidecar has an owner.
    let parent = path.posix.dirname(owner);
    while (parent.startsWith(assetsPrefix)) {
      if (assetDirs.has(parent) !== assetFiles.has(`${parent}.meta`)) blockers.push(`asset-meta-pair:${parent.slice(prefix.length)}`);
      parent = path.posix.dirname(parent);
    }
  }
  return { blockers: [...new Set(blockers)].sort(), warnings: [...new Set(warnings)].sort() };
}

function related(a, b) {
  const owner = (value) => value.endsWith('.meta') ? value.slice(0, -5) : value;
  const first = owner(a), second = owner(b);
  return first === second || first.startsWith(`${second}/`) || second.startsWith(`${first}/`);
}

function overlapPaths(ctx, files) {
  return dirtyEntries(ctx.status).filter((entry) => files.some((file) => related(entry.path, file.path)
    || entry.renamedFrom && related(entry.renamedFrom, file.path))).map((entry) => entry.path);
}

function ancestor(root, a, b) {
  const result = git(root, ['merge-base', '--is-ancestor', a, b], { optional: true });
  if (![0, 1].includes(result.status)) fail('VCS_ANCESTRY_CHECK_FAILED');
  return result.status === 0;
}

function preview(ctx, options) {
  const operation = options.operation;
  if (!['switch', 'sync', 'merge'].includes(operation)) fail('VCS_OPERATION_INVALID');
  if (options.detach && (operation !== 'switch' || options.createBranch)) fail('VCS_SWITCH_OPTIONS_INVALID');
  if (options.createBranch && operation !== 'switch') fail('VCS_SWITCH_OPTIONS_INVALID');
  const targetRef = options.target || (operation === 'switch' && options.createBranch ? 'HEAD' : ctx.status.upstream);
  if (!targetRef) fail('VCS_TARGET_REQUIRED');
  const targetCommit = commit(ctx.gitRoot, targetRef);
  let destinationBranch = null;
  const blockers = [];
  if (operation === 'switch' && !options.detach) {
    destinationBranch = branchName(ctx.gitRoot, options.createBranch || targetRef);
    const existing = git(ctx.gitRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${destinationBranch}`], { optional: true }).status === 0;
    if (options.createBranch ? existing : !existing) blockers.push(options.createBranch ? 'branch-already-exists' : 'local-branch-required');
    if (!options.createBranch && existing && commit(ctx.gitRoot, `refs/heads/${destinationBranch}`) !== targetCommit) blockers.push('branch-target-mismatch');
    const worktrees = git(ctx.gitRoot, ['worktree', 'list', '--porcelain', '-z']).stdout.toString('utf8').split('\0\0');
    if (worktrees.some((record) => record.split('\0').includes(`branch refs/heads/${destinationBranch}`)
      && !record.split('\0').includes(`worktree ${ctx.gitRoot}`))) blockers.push('branch-open-in-another-worktree');
  }
  const impact = runVcsImpact({ gitRoot: ctx.gitRoot, projectRoot: ctx.projectRoot, target: targetCommit,
    operation: operation === 'switch' ? 'switch' : 'sync' });
  if (!impact.compatibleCreatorVersion) blockers.push('target-creator-version-unsupported');
  if (impact.truncated) blockers.push('impact-truncated');
  const allIncoming = [...impact.files];
  const overlaps = overlapPaths(ctx, allIncoming);
  if (overlaps.length) blockers.push('uncommitted-path-overlap');
  const state = repositoryState(ctx);
  if (Object.keys(state.progress).length) blockers.push('repository-operation-in-progress');
  if (ctx.status.summary.conflicted || ctx.status.outsideProjectChanges.some((item) => item.status === 'conflicted')) blockers.push('unresolved-conflicts');
  const containsTarget = ancestor(ctx.gitRoot, targetCommit, ctx.status.head);
  const fastForward = ancestor(ctx.gitRoot, ctx.status.head, targetCommit);
  if (operation === 'sync' && !fastForward && !containsTarget) blockers.push('diverged-use-merge');
  if (operation !== 'switch' && !ctx.status.branch) blockers.push('detached-head');
  // A pending merge must not absorb unrelated staged changes into a later merge commit.
  if (operation === 'merge' && !containsTarget && !ctx.status.clean) blockers.push('merge-requires-clean-worktree');
  const semanticMergeRequired = [];
  if (operation === 'merge' && !containsTarget) {
    const bases = text(ctx.gitRoot, ['merge-base', '--all', ctx.status.head, targetCommit], true).split(/\r?\n/).filter(Boolean);
    if (bases.length !== 1) blockers.push('single-merge-base-required');
    else {
      const changedPaths = (to) => git(ctx.gitRoot, ['diff', '--name-only', '-z', '--no-renames', bases[0], to, '--'])
        .stdout.toString('utf8').split('\0').filter(Boolean);
      const ours = changedPaths(ctx.status.head), theirs = changedPaths(targetCommit);
      for (const filename of ours) {
        if (/\.(?:fire|prefab)(?:\.meta)?$/i.test(filename) && theirs.some((other) => related(filename, other)))
          semanticMergeRequired.push(filename.replace(/\.meta$/, ''));
      }
      if (semanticMergeRequired.length) blockers.push('creator-asset-semantic-resolution-required');
    }
  }
  const integrity = targetIntegrity(ctx, targetCommit, allIncoming);
  blockers.push(...integrity.blockers);
  const noOp = operation === 'switch'
    ? !options.createBranch && destinationBranch === ctx.status.branch && targetCommit === ctx.status.head
    : containsTarget;
  const plan = { schemaVersion: 1, operation, gitRoot: ctx.gitRoot, projectRoot: ctx.projectRoot,
    creatorVersion: ctx.status.creatorVersion, targetRef, targetCommit, destinationBranch, createBranch: Boolean(options.createBranch),
    detach: Boolean(options.detach), state, noOp };
  return { ...plan, readOnly: true, phase: 'preview', planHash: sha(JSON.stringify(plan)),
    canApply: blockers.length === 0, blockers: [...new Set(blockers)], dirtyOverlapPaths: overlaps,
    semanticMergeRequired: [...new Set(semanticMergeRequired)].sort(),
    warnings: integrity.warnings, impact, editorStateVerified: false,
    instructions: ['Review the incoming repository and Creator resource changes before applying.',
      'Close the affected Creator projects through Cocos CLI before applying; --editor-closed records the caller confirmation.',
      'Git hooks and configured filters may run repository code. A merge is left uncommitted for review.'] };
}

export function runVcsWorkflow(options = {}) {
  const ctx = context(options);
  if (options.operation === 'fetch') return runFetch(ctx, options);
  const plan = preview(ctx, options);
  if (!options.apply) return plan;
  if (typeof options.planHash !== 'string' || !/^[0-9a-f]{64}$/.test(options.planHash)) fail('VCS_PLAN_HASH_REQUIRED');
  if (plan.planHash !== options.planHash) fail('VCS_PRECONDITION_CHANGED', { currentPlanHash: plan.planHash });
  if (!plan.canApply) fail('VCS_WORKFLOW_CONFLICT', { blockers: plan.blockers });
  if (!options.editorClosed && !plan.noOp) fail('VCS_EDITOR_CLOSED_REQUIRED');
  if (plan.noOp) return { ...plan, readOnly: false, phase: 'unchanged', applied: false,
    preservedLocalChanges: true, editorStateVerified: false };
  let command;
  if (options.operation === 'switch') command = ['switch', '--no-overwrite-ignore',
    ...(options.detach ? ['--detach', plan.targetCommit] : options.createBranch
      ? ['--no-track', '-c', plan.destinationBranch, plan.targetCommit] : [plan.destinationBranch])];
  else if (options.operation === 'sync') command = ['merge', '--ff-only', '--no-edit', '--no-overwrite-ignore', plan.targetCommit];
  else command = ['merge', '--no-commit', '--no-ff', '--no-overwrite-ignore', plan.targetCommit];
  const result = git(ctx.gitRoot, command, { mutation: true });
  let after;
  let preservedLocalChanges = false;
  let readbackError = null;
  try {
    after = runVcsStatus({ gitRoot: ctx.gitRoot, projectRoot: ctx.projectRoot });
    const preserved = protectedState(ctx.gitRoot, dirtyEntries(ctx.status));
    preservedLocalChanges = JSON.stringify(preserved) === JSON.stringify(plan.state.protected);
  } catch (error) { readbackError = error.code || error.message; }
  const conflicted = Boolean(after && (after.summary.conflicted || after.outsideProjectChanges.some((item) => item.status === 'conflicted')));
  const mergeHead = text(ctx.gitRoot, ['rev-parse', '--verify', 'MERGE_HEAD'], true) || null;
  const expected = options.operation === 'merge'
    ? after?.head === plan.state.head && mergeHead === plan.targetCommit
    : after?.head === plan.targetCommit && (options.detach ? after?.detached : after?.branch === (plan.destinationBranch || plan.state.branch));
  const requiresManualReview = result.interrupted || Boolean(readbackError) || !preservedLocalChanges
    || result.status !== 0 && !conflicted || !expected;
  return { schemaVersion: 1, readOnly: false, operation: options.operation, phase: requiresManualReview ? 'needs-reconciliation'
    : conflicted ? 'conflicts' : options.operation === 'merge' ? 'merge-pending' : 'applied',
    gitRoot: ctx.gitRoot, projectRoot: ctx.projectRoot, planHash: plan.planHash,
    fromCommit: plan.state.head, targetCommit: plan.targetCommit, head: after?.head ?? null,
    branch: after?.branch ?? null, mergeHead, applied: result.status === 0 && expected && preservedLocalChanges && !result.interrupted,
    requiresManualReview, outcomeUncertain: result.interrupted, preservedLocalChanges,
    ...(readbackError ? { readbackError } : {}), gitExitCode: result.status, conflicted,
    // Never return arbitrary Git stderr: credential helpers and filters may include secrets.
    status: after || null, editorStateVerified: false, creatorPersistenceVerified: false,
    nextAction: requiresManualReview ? 'Inspect Git status and the original target before any retry; no automatic retry or rollback was performed.'
      : conflicted ? 'Use vcs conflicts to inspect and resolve the pending merge.'
        : options.operation === 'merge' ? 'Review and commit the staged merge explicitly.'
          : 'Verify project identity before reopening Creator through Cocos CLI and checking AssetDB/scene state.' };
}

function remoteRefs(root, remote) {
  return text(root, ['for-each-ref', '--sort=refname', '--format=%(refname)%00%(objectname)', `refs/remotes/${remote}/`])
    .split('\n').filter(Boolean).map((row) => {
      const [ref, hash] = row.split('\0');
      return { ref, commit: hash };
    });
}

function runFetch(ctx, options) {
  if (options.target || options.createBranch || options.detach) fail('VCS_FETCH_OPTIONS_INVALID');
  const remote = options.remote || 'origin';
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(remote)
    || !text(ctx.gitRoot, ['remote']).split('\n').includes(remote)) fail('VCS_REMOTE_INVALID');
  const state = repositoryState(ctx);
  const refspec = `+refs/heads/*:refs/remotes/${remote}/*`;
  const plan = { schemaVersion: 1, operation: 'fetch', gitRoot: ctx.gitRoot, projectRoot: ctx.projectRoot,
    creatorVersion: ctx.status.creatorVersion, remote, refspec, state, remoteRefs: remoteRefs(ctx.gitRoot, remote) };
  const planHash = sha(JSON.stringify(plan));
  if (!options.apply) return { ...plan, planHash, readOnly: true, phase: 'preview', canApply: true,
    effects: ['Fetch remote heads into this remote tracking namespace only.',
      'No tag download, pruning, submodule recursion, checkout, staging or merge.'],
    instructions: ['Review this configured remote and its Git credential/transport configuration before applying.'] };
  if (typeof options.planHash !== 'string' || !/^[0-9a-f]{64}$/.test(options.planHash)) fail('VCS_PLAN_HASH_REQUIRED');
  if (options.planHash !== planHash) fail('VCS_PRECONDITION_CHANGED', { currentPlanHash: planHash });
  const result = git(ctx.gitRoot, ['fetch', '--atomic', '--no-tags', '--no-prune', '--no-recurse-submodules',
    '--no-auto-gc', '--', remote, refspec], { mutation: true });
  const after = context(options);
  const afterState = repositoryState(after);
  const preservedLocalChanges = afterState.head === state.head && afterState.branch === state.branch
    && afterState.indexSha256 === state.indexSha256 && afterState.statusSha256 === state.statusSha256
    && JSON.stringify(afterState.protected) === JSON.stringify(state.protected);
  const requiresManualReview = result.interrupted || result.status !== 0 || !preservedLocalChanges;
  return { schemaVersion: 1, operation: 'fetch', readOnly: false, gitRoot: ctx.gitRoot, projectRoot: ctx.projectRoot,
    phase: requiresManualReview ? 'needs-reconciliation' : 'fetched', planHash, remote,
    applied: !requiresManualReview, requiresManualReview, outcomeUncertain: result.interrupted,
    gitExitCode: result.status, preservedLocalChanges, remoteRefs: remoteRefs(ctx.gitRoot, remote),
    nextAction: requiresManualReview ? 'Inspect local remote-tracking refs before any retry; no automatic retry was performed.'
      : 'Generate a fresh sync or merge plan against the updated local upstream ref.' };
}
