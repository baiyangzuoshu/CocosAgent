import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runVcsImpact } from '../vcs-impact.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function hash(filename) {
  return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-impact-'));
  const gitRoot = path.join(root, 'repo');
  const projectRoot = path.join(gitRoot, 'game');
  const assets = path.join(projectRoot, 'assets');
  fs.mkdirSync(path.join(assets, 'Scenes'), { recursive: true });
  fs.mkdirSync(path.join(assets, 'Scripts'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'settings'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'impact-fixture', version: '2.4.15' }));
  fs.writeFileSync(path.join(assets, 'Scenes', 'Level.fire'), 'scene v1');
  fs.writeFileSync(path.join(assets, 'Scenes', 'Level.fire.meta'), JSON.stringify({ uuid: 'scene-uuid' }));
  fs.writeFileSync(path.join(assets, 'Scripts', 'Player.ts'), 'export const player = 1;');
  fs.writeFileSync(path.join(assets, 'Scripts', 'Player.ts.meta'), JSON.stringify({ uuid: 'script-uuid' }));
  fs.writeFileSync(path.join(projectRoot, 'settings', 'project.json'), JSON.stringify({ designWidth: 960 }));
  fs.mkdirSync(gitRoot, { recursive: true });
  execFileSync('git', ['-C', gitRoot, 'init'], { stdio: 'ignore' });
  git(gitRoot, ['config', 'user.name', 'VCS Impact Test']);
  git(gitRoot, ['config', 'user.email', 'vcs-impact@example.invalid']);
  git(gitRoot, ['add', '.']);
  git(gitRoot, ['commit', '-m', 'fixture']);
  git(gitRoot, ['branch', '-M', 'main']);
  git(gitRoot, ['switch', '-c', 'feature']);
  fs.writeFileSync(path.join(assets, 'Scenes', 'Level.fire'), 'scene v2');
  fs.writeFileSync(path.join(assets, 'Scenes', 'Level.fire.meta'), JSON.stringify({ uuid: 'scene-uuid-v2' }));
  fs.writeFileSync(path.join(assets, 'Scenes', 'Bundle.prefab'), 'prefab v1');
  fs.writeFileSync(path.join(assets, 'Scenes', 'Bundle.prefab.meta'), JSON.stringify({ uuid: 'prefab-uuid' }));
  fs.writeFileSync(path.join(assets, 'Scripts', 'Player.ts'), 'export const player = 2;');
  fs.writeFileSync(path.join(projectRoot, 'settings', 'project.json'), JSON.stringify({ designWidth: 1280 }));
  fs.writeFileSync(path.join(gitRoot, 'README.md'), 'feature notes');
  git(gitRoot, ['add', '.']);
  git(gitRoot, ['commit', '-m', 'feature changes']);
  git(gitRoot, ['switch', 'main']);
  return { root, gitRoot, projectRoot, assets };
}

test('vcs impact reports branch import effects and dirty overlaps without changing Git or project files', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(state.assets, 'Scripts', 'Player.ts'), 'export const player = 99;');
  fs.writeFileSync(path.join(state.assets, 'Scenes', 'Level.fire.meta'), JSON.stringify({ uuid: 'local-scene-meta' }));
  fs.writeFileSync(path.join(state.assets, 'Scripts', 'Local.ts'), 'export const local = true;');
  fs.mkdirSync(path.join(state.assets, 'Scenes', 'Bundle.prefab', 'nested'), { recursive: true });
  fs.writeFileSync(path.join(state.assets, 'Scenes', 'Bundle.prefab', 'nested', 'Local.ts'), 'export const nested = true;');
  const beforeHead = git(state.gitRoot, ['rev-parse', 'HEAD']);
  const indexPath = path.join(state.gitRoot, '.git', 'index');
  const beforeIndexHash = hash(indexPath);
  const report = runVcsImpact({ ...state, target: 'feature', operation: 'sync' });

  assert.equal(report.readOnly, true);
  assert.equal(report.operation, 'sync');
  assert.equal(report.currentBranch, 'main');
  assert.equal(report.fastForwardPossible, true);
  assert.equal(report.mergeRequired, false);
  assert.equal(report.compatibleCreatorVersion, true);
  assert.deepEqual(report.summary, { total: 7, project: 6, outsideProject: 1,
    assetDbImport: 5, metadata: 2, scripts: 1, scenes: 1, prefabs: 1, projectConfiguration: 1 });
  assert.equal(report.importImpact.assetDbImportRequired, true);
  assert.equal(report.importImpact.assetIdentityReviewRequired, true);
  assert.equal(report.importImpact.scriptRecompileRecommended, true);
  assert.equal(report.importImpact.sceneOrPrefabReloadRecommended, true);
  assert.equal(report.importImpact.editorStateChecked, false);
  assert.ok(report.dirtyOverlapPaths.some((item) => item.incomingPath === 'game/assets/Scripts/Player.ts'));
  assert.ok(report.dirtyOverlapPaths.some((item) => item.incomingPath === 'game/assets/Scenes/Level.fire.meta'));
  assert.ok(report.dirtyOverlapPaths.some((item) => item.incomingPath === 'game/assets/Scenes/Bundle.prefab'
    && item.dirtyPaths.includes('game/assets/Scenes/Bundle.prefab/nested/Local.ts')));
  assert.deepEqual(report.outsideProjectChanges, ['README.md']);
  assert.equal(git(state.gitRoot, ['rev-parse', 'HEAD']), beforeHead);
  assert.equal(hash(indexPath), beforeIndexHash);
  assert.equal(fs.readFileSync(path.join(state.assets, 'Scripts', 'Player.ts'), 'utf8'), 'export const player = 99;');
  assert.equal(fs.readFileSync(path.join(state.assets, 'Scenes', 'Level.fire.meta'), 'utf8'), JSON.stringify({ uuid: 'local-scene-meta' }));
});

test('vcs impact labels incompatible Creator versions and detects non-fast-forward sync targets', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  git(state.gitRoot, ['switch', '-c', 'diverged']);
  fs.writeFileSync(path.join(state.projectRoot, 'project.json'), JSON.stringify({ name: 'impact-fixture', version: '3.8.7' }));
  fs.writeFileSync(path.join(state.assets, 'Scripts', 'Other.ts'), 'export const other = true;');
  git(state.gitRoot, ['add', '.']);
  git(state.gitRoot, ['commit', '-m', 'incompatible divergent target']);
  git(state.gitRoot, ['switch', 'main']);
  fs.writeFileSync(path.join(state.projectRoot, 'settings', 'local.json'), '{}');
  git(state.gitRoot, ['add', '.']);
  git(state.gitRoot, ['commit', '-m', 'local commit']);

  const report = runVcsImpact({ ...state, target: 'diverged', operation: 'sync' });
  assert.equal(report.compatibleCreatorVersion, false);
  assert.equal(report.targetProject.creatorVersion, '3.8.7');
  assert.equal(report.fastForwardPossible, false);
  assert.equal(report.mergeRequired, true);
  assert.throws(() => runVcsImpact({ ...state, target: '--upload' }), { code: 'VCS_IMPACT_TARGET_INVALID' });
});

test('vcs impact uses the configured upstream for sync when no target is supplied', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const remote = path.join(state.root, 'remote.git');
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  git(state.gitRoot, ['remote', 'add', 'origin', remote]);
  git(state.gitRoot, ['push', 'origin', 'feature:main']);
  git(state.gitRoot, ['branch', '--set-upstream-to=origin/main', 'main']);

  const report = runVcsImpact({ ...state, operation: 'sync' });
  assert.equal(report.targetRef, 'origin/main');
  assert.equal(report.fastForwardPossible, true);
  assert.equal(report.mergeRequired, false);
  assert.equal(report.summary.assetDbImport, 5);
});

test('vcs impact command emits a JSON report for an explicit local target', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [path.join(packageRoot, 'cli.mjs'), 'vcs', 'impact',
    '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--target', 'feature', '--format', 'json'],
  { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.readOnly, true);
  assert.equal(report.targetRef, 'feature');
  assert.equal(report.summary.outsideProject, 1);
});
