import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runVcsWorkflow } from '../vcs-workflow.mjs';
import { runVcsImpact } from '../vcs-impact.mjs';

const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

function fixture(t, { rootProject = false } = {}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-workflow-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const gitRoot = fs.realpathSync(temporary);
  const projectRoot = rootProject ? gitRoot : path.join(gitRoot, 'game');
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ version: '2.4.15', name: 'workflow' }));
  fs.writeFileSync(path.join(projectRoot, 'assets', 'Counter.ts'), 'export const value = 1;\n');
  fs.writeFileSync(path.join(projectRoot, 'assets', 'Counter.ts.meta'), JSON.stringify({ uuid: 'counter' }));
  fs.writeFileSync(path.join(gitRoot, 'notes.txt'), 'base\n');
  git(gitRoot, 'init', '-b', 'main');
  git(gitRoot, 'config', 'user.name', 'Workflow fixture');
  git(gitRoot, 'config', 'user.email', 'workflow@example.invalid');
  git(gitRoot, 'config', 'commit.gpgSign', 'false');
  git(gitRoot, 'config', 'core.autocrlf', 'false');
  git(gitRoot, 'add', '.');
  git(gitRoot, 'commit', '-m', 'base');
  const base = git(gitRoot, 'rev-parse', 'HEAD');
  git(gitRoot, 'switch', '-c', 'feature');
  fs.writeFileSync(path.join(projectRoot, 'assets', 'Counter.ts'), 'export const value = 2;\n');
  git(gitRoot, 'add', '.');
  git(gitRoot, 'commit', '-m', 'feature');
  const feature = git(gitRoot, 'rev-parse', 'HEAD');
  git(gitRoot, 'switch', 'main');
  return { gitRoot, projectRoot, base, feature };
}

function apply(options) {
  const plan = runVcsWorkflow(options);
  assert.equal(plan.canApply, true, JSON.stringify(plan.blockers));
  return runVcsWorkflow({ ...options, apply: true, planHash: plan.planHash, editorClosed: true });
}

for (const operation of ['switch', 'sync']) test(`${operation} preserves staged, unstaged and untracked bytes outside incoming paths`, (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'staged\n');
  git(state.gitRoot, 'add', 'notes.txt');
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'unstaged\n');
  fs.writeFileSync(path.join(state.gitRoot, 'local.txt'), 'untracked\n');
  const index = git(state.gitRoot, 'ls-files', '--stage', '--', 'notes.txt');
  const result = apply({ ...state, operation, target: 'feature' });
  assert.equal(result.phase, 'applied', JSON.stringify(result));
  assert.equal(result.preservedLocalChanges, true);
  assert.equal(result.head, state.feature);
  assert.equal(result.branch, operation === 'switch' ? 'feature' : 'main');
  assert.equal(git(state.gitRoot, 'ls-files', '--stage', '--', 'notes.txt'), index);
  assert.equal(fs.readFileSync(path.join(state.gitRoot, 'notes.txt'), 'utf8'), 'unstaged\n');
  assert.equal(fs.readFileSync(path.join(state.gitRoot, 'local.txt'), 'utf8'), 'untracked\n');
  assert.equal(result.creatorPersistenceVerified, false);
});

test('plans reject byte-only local drift, target drift, config drift and missing plan hashes', (t) => {
  const state = fixture(t);
  const options = { ...state, operation: 'switch', target: 'feature' };
  fs.writeFileSync(path.join(state.gitRoot, 'local.txt'), 'first');
  const plan = runVcsWorkflow(options);
  fs.writeFileSync(path.join(state.gitRoot, 'local.txt'), 'other');
  assert.throws(() => runVcsWorkflow({ ...options, apply: true, editorClosed: true, planHash: plan.planHash }), { code: 'VCS_PRECONDITION_CHANGED' });
  const second = runVcsWorkflow(options);
  git(state.gitRoot, 'config', 'workflow.fixture', 'new');
  assert.throws(() => runVcsWorkflow({ ...options, apply: true, editorClosed: true, planHash: second.planHash }), { code: 'VCS_PRECONDITION_CHANGED' });
  const third = runVcsWorkflow(options);
  git(state.gitRoot, 'branch', '-f', 'feature', state.base);
  assert.throws(() => runVcsWorkflow({ ...options, apply: true, editorClosed: true, planHash: third.planHash }), { code: 'VCS_PRECONDITION_CHANGED' });
  assert.throws(() => runVcsWorkflow({ ...options, apply: true, editorClosed: true }), { code: 'VCS_PLAN_HASH_REQUIRED' });
  assert.equal(git(state.gitRoot, 'branch', '--show-current'), 'main');
});

test('asset and metadata changes overlap as one identity, including changes outside the selected project', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Counter.ts.meta'), JSON.stringify({ uuid: 'local-change' }));
  let plan = runVcsWorkflow({ ...state, operation: 'switch', target: 'feature' });
  assert.ok(plan.blockers.includes('uncommitted-path-overlap'));
  assert.deepEqual(plan.dirtyOverlapPaths, ['game/assets/Counter.ts.meta']);
  git(state.gitRoot, 'restore', '.');
  git(state.gitRoot, 'switch', 'feature');
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'incoming\n');
  git(state.gitRoot, 'add', 'notes.txt');
  git(state.gitRoot, 'commit', '-m', 'outside');
  git(state.gitRoot, 'switch', 'main');
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'local\n');
  plan = runVcsWorkflow({ ...state, operation: 'switch', target: 'feature' });
  assert.ok(plan.dirtyOverlapPaths.includes('notes.txt'));
});

test('sync ahead of target is unchanged and root-level Creator projects are supported', (t) => {
  const state = fixture(t, { rootProject: true });
  git(state.gitRoot, 'switch', 'feature');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Counter.ts'), 'local\n');
  const impact = runVcsImpact({ ...state, operation: 'sync', target: 'main' });
  assert.equal(impact.alreadyContainsTarget, true);
  assert.equal(impact.mergeRequired, false);
  assert.equal(impact.summary.total, 0);
  const result = apply({ ...state, operation: 'sync', target: 'main' });
  assert.equal(result.phase, 'unchanged');
  assert.equal(git(state.gitRoot, 'rev-parse', 'HEAD'), state.feature);
  assert.equal(fs.readFileSync(path.join(state.projectRoot, 'assets', 'Counter.ts'), 'utf8'), 'local\n');
});

test('divergent sync directs caller to merge, and a clean merge leaves the result uncommitted', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'main branch\n');
  git(state.gitRoot, 'add', '.');
  git(state.gitRoot, 'commit', '-m', 'main');
  const head = git(state.gitRoot, 'rev-parse', 'HEAD');
  const sync = runVcsWorkflow({ ...state, operation: 'sync', target: 'feature' });
  assert.ok(sync.blockers.includes('diverged-use-merge'));
  const result = apply({ ...state, operation: 'merge', target: 'feature' });
  assert.equal(result.phase, 'merge-pending', JSON.stringify(result));
  assert.equal(result.head, head);
  assert.equal(result.mergeHead, state.feature);
  assert.equal(git(state.gitRoot, 'diff', '--cached', '--name-only'), 'game/assets/Counter.ts');
  assert.equal(fs.readFileSync(path.join(state.gitRoot, 'notes.txt'), 'utf8'), 'main branch\n');
});

test('a conflicting merge reports unresolved state and never commits or retries it', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Counter.ts'), 'export const value = 3;\n');
  git(state.gitRoot, 'add', '.');
  git(state.gitRoot, 'commit', '-m', 'diverge');
  const head = git(state.gitRoot, 'rev-parse', 'HEAD');
  const result = apply({ ...state, operation: 'merge', target: 'feature' });
  assert.equal(result.phase, 'conflicts', JSON.stringify(result));
  assert.equal(result.conflicted, true);
  assert.equal(result.requiresManualReview, false);
  assert.equal(result.head, head);
  assert.equal(result.mergeHead, state.feature);
  assert.match(fs.readFileSync(path.join(state.projectRoot, 'assets', 'Counter.ts'), 'utf8'), /<<<<<<< HEAD/);
  const next = runVcsWorkflow({ ...state, operation: 'merge', target: 'feature' });
  assert.ok(next.blockers.includes('repository-operation-in-progress'));
});

test('merge rejects dirty state to avoid absorbing unrelated staged changes', (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'staged\n');
  git(state.gitRoot, 'add', 'notes.txt');
  const plan = runVcsWorkflow({ ...state, operation: 'merge', target: 'feature' });
  assert.ok(plan.blockers.includes('merge-requires-clean-worktree'));
  assert.equal(git(state.gitRoot, 'diff', '--cached', '--name-only'), 'notes.txt');
});

test('target Creator version, unsafe assets, cache tracking and missing metadata are rejected', (t) => {
  const state = fixture(t);
  git(state.gitRoot, 'switch', 'feature');
  fs.writeFileSync(path.join(state.projectRoot, 'project.json'), JSON.stringify({ version: '3.8.7' }));
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'New.bin'), 'no metadata');
  fs.mkdirSync(path.join(state.projectRoot, 'library'));
  fs.writeFileSync(path.join(state.projectRoot, 'library', 'cache'), 'generated');
  fs.symlinkSync('Counter.ts', path.join(state.projectRoot, 'assets', 'Link.ts'));
  git(state.gitRoot, 'add', '.');
  git(state.gitRoot, 'commit', '-m', 'invalid target');
  git(state.gitRoot, 'switch', 'main');
  const plan = runVcsWorkflow({ ...state, operation: 'switch', target: 'feature' });
  assert.ok(plan.blockers.includes('target-creator-version-unsupported'));
  assert.ok(plan.blockers.includes('asset-meta-pair:assets/New.bin'));
  assert.ok(plan.blockers.includes('tracked-cache:library/cache'));
  assert.ok(plan.blockers.includes('unsafe-asset:assets/Link.ts'));
});

test('branch creation and detached inspection bind the exact requested base commit', (t) => {
  const state = fixture(t);
  let result = apply({ ...state, operation: 'switch', target: 'feature', createBranch: 'codex/new-ui' });
  assert.equal(result.phase, 'applied', JSON.stringify(result));
  assert.equal(result.branch, 'codex/new-ui');
  result = apply({ ...state, operation: 'switch', target: state.base, detach: true });
  assert.equal(result.phase, 'applied', JSON.stringify(result));
  assert.equal(result.branch, null);
  assert.equal(result.head, state.base);
});

test('branch checked out by another worktree is rejected during preview', (t) => {
  const state = fixture(t);
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-other-worktree-'));
  fs.rmdirSync(worktree);
  t.after(() => fs.rmSync(worktree, { recursive: true, force: true }));
  git(state.gitRoot, 'worktree', 'add', worktree, 'feature');
  const plan = runVcsWorkflow({ ...state, operation: 'switch', target: 'feature' });
  assert.ok(plan.blockers.includes('branch-open-in-another-worktree'));
});

test('CLI applies a reviewed plan offline without starting the bridge', (t) => {
  const state = fixture(t);
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-cli-home-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const args = ['vcs', 'switch', '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--target', 'feature', '--format', 'json'];
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const preview = spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8' });
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  const plan = JSON.parse(preview.stdout);
  const applied = spawnSync(process.execPath, [cli, ...args, '--apply', '--plan-hash', plan.planHash, '--editor-closed'], { env, encoding: 'utf8' });
  assert.equal(applied.status, 0, applied.stdout + applied.stderr);
  const result = JSON.parse(applied.stdout);
  assert.equal(result.phase, 'applied', applied.stdout);
  assert.equal(result.editorConnectionCheck, 'bridge-unavailable');
  assert.equal(result.editorStateVerified, false);
  assert.equal(fs.existsSync(path.join(home, '.cocos-creator-agent', 'third-party-bridge.json')), false);
});

test('fetch previews without touching refs, fetches remote heads only, and preserves the working tree/index', (t) => {
  const state = fixture(t);
  const remote = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-remote-'));
  t.after(() => fs.rmSync(remote, { recursive: true, force: true }));
  git(remote, 'init', '--bare');
  git(state.gitRoot, 'remote', 'add', 'origin', remote);
  git(state.gitRoot, 'push', 'origin', 'feature:main');
  git(state.gitRoot, 'update-ref', '-d', 'refs/remotes/origin/main');
  git(state.gitRoot, 'branch', '--set-upstream-to=feature', 'main');
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'local staged');
  git(state.gitRoot, 'add', 'notes.txt');
  fs.writeFileSync(path.join(state.gitRoot, 'notes.txt'), 'local unstaged');
  const options = { ...state, operation: 'fetch' };
  const plan = runVcsWorkflow(options);
  assert.equal(plan.readOnly, true);
  assert.deepEqual(plan.remoteRefs, []);
  assert.equal(git(state.gitRoot, 'for-each-ref', 'refs/remotes/origin/'), '');
  const result = runVcsWorkflow({ ...options, apply: true, planHash: plan.planHash });
  assert.equal(result.phase, 'fetched', JSON.stringify(result));
  assert.equal(result.preservedLocalChanges, true);
  assert.equal(git(state.gitRoot, 'rev-parse', 'HEAD'), state.base);
  assert.equal(git(state.gitRoot, 'rev-parse', 'refs/remotes/origin/main'), state.feature);
  assert.equal(git(state.gitRoot, 'show', ':notes.txt'), 'local staged');
  assert.equal(fs.readFileSync(path.join(state.gitRoot, 'notes.txt'), 'utf8'), 'local unstaged');
  assert.throws(() => runVcsWorkflow({ ...options, remote: '--upload-pack=bad' }), { code: 'VCS_REMOTE_INVALID' });
});

test('both-side Creator asset changes cannot enter an unsafe textual merge', (t) => {
  const state = fixture(t);
  git(state.gitRoot, 'switch', 'feature');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Menu.prefab'), 'theirs');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Menu.prefab.meta'), JSON.stringify({ uuid: 'menu' }));
  git(state.gitRoot, 'add', '.');
  git(state.gitRoot, 'commit', '-m', 'their prefab');
  git(state.gitRoot, 'switch', 'main');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Menu.prefab'), 'ours');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Menu.prefab.meta'), JSON.stringify({ uuid: 'menu' }));
  git(state.gitRoot, 'add', '.');
  git(state.gitRoot, 'commit', '-m', 'our prefab');
  const plan = runVcsWorkflow({ ...state, operation: 'merge', target: 'feature' });
  assert.ok(plan.blockers.includes('creator-asset-semantic-resolution-required'));
  assert.deepEqual(plan.semanticMergeRequired, ['game/assets/Menu.prefab']);
  assert.throws(() => runVcsWorkflow({ ...state, operation: 'merge', target: 'feature', apply: true,
    planHash: plan.planHash, editorClosed: true }), { code: 'VCS_WORKFLOW_CONFLICT' });
  assert.equal(git(state.gitRoot, 'ls-files', '--unmerged'), '');
});
