import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runVcsStatus } from '../vcs-status.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function hash(filename) {
  return createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-status-'));
  const gitRoot = path.join(root, 'repo');
  const projectRoot = path.join(gitRoot, 'game');
  const assets = path.join(projectRoot, 'assets');
  fs.mkdirSync(path.join(assets, 'Scenes'), { recursive: true });
  fs.mkdirSync(path.join(assets, 'Prefabs'), { recursive: true });
  fs.mkdirSync(path.join(assets, 'Scripts'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'status-fixture', version: '2.4.15' }));
  fs.writeFileSync(path.join(assets, 'Scenes', 'Level.fire'), 'scene v1');
  fs.writeFileSync(path.join(assets, 'Scenes', 'Level.fire.meta'), JSON.stringify({ uuid: 'scene-uuid' }));
  fs.writeFileSync(path.join(assets, 'Prefabs', 'Hero.prefab'), 'prefab v1');
  fs.writeFileSync(path.join(assets, 'Prefabs', 'Hero.prefab.meta'), JSON.stringify({ uuid: 'prefab-uuid' }));
  fs.writeFileSync(path.join(assets, 'Scripts', 'Player.ts'), 'const player = 1;');
  fs.writeFileSync(path.join(assets, 'Scripts', 'Player.ts.meta'), JSON.stringify({ uuid: 'script-uuid' }));
  fs.mkdirSync(gitRoot, { recursive: true });
  execFileSync('git', ['-C', gitRoot, 'init'], { stdio: 'ignore' });
  git(gitRoot, ['config', 'user.name', 'VCS Status Test']);
  git(gitRoot, ['config', 'user.email', 'vcs-status@example.invalid']);
  git(gitRoot, ['add', '.']);
  git(gitRoot, ['commit', '-m', 'fixture']);
  return { root, gitRoot, projectRoot, assets };
}

test('vcs status groups Cocos changes, reports meta pairing, and leaves the index untouched', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const scene = path.join(state.assets, 'Scenes', 'Level.fire');
  fs.writeFileSync(scene, 'scene staged');
  git(state.gitRoot, ['add', 'game/assets/Scenes/Level.fire']);
  fs.writeFileSync(scene, 'scene unstaged');
  fs.writeFileSync(path.join(state.assets, 'Scripts', 'New Script.ts'), 'const value = 1;');
  fs.writeFileSync(path.join(state.assets, 'Orphan.bin.meta'), JSON.stringify({ uuid: 'orphan-uuid' }));
  fs.writeFileSync(path.join(state.gitRoot, 'README.md'), 'outside project change');

  const index = path.join(state.gitRoot, '.git', 'index');
  const indexHash = hash(index);
  const report = runVcsStatus(state);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.readOnly, true);
  assert.equal(report.projectName, 'status-fixture');
  assert.equal(report.creatorVersion, '2.4.15');
  assert.equal(report.clean, false);
  assert.equal(report.projectClean, false);
  assert.equal(report.repositoryChangeCount, 4);
  assert.equal(report.detached, false);
  assert.ok(report.head);
  assert.equal(report.groups.scenes[0].status, 'modified');
  assert.equal(report.groups.scenes[0].staged, true);
  assert.equal(report.groups.scenes[0].unstaged, true);
  const script = report.groups.scripts.find((item) => item.projectPath === 'assets/Scripts/New Script.ts');
  assert.equal(script.status, 'untracked');
  assert.equal(script.metaPairing.status, 'missing-meta');
  assert.equal(report.groups.metadata[0].metaPairing.status, 'orphan-meta');
  assert.deepEqual(report.outsideProjectChanges.map((item) => item.path), ['README.md']);
  assert.equal(hash(index), indexHash);
});

test('vcs status command emits JSON and requires an exact repository/project relationship', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [path.join(packageRoot, 'cli.mjs'), 'vcs', 'status',
    '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).clean, true);
  assert.throws(() => runVcsStatus({ gitRoot: state.projectRoot, projectRoot: state.projectRoot }), /GIT_ROOT_MISMATCH/);
  const outside = path.join(state.root, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'project.json'), '{}');
  assert.throws(() => runVcsStatus({ gitRoot: state.gitRoot, projectRoot: outside }), /PROJECT_OUTSIDE_GIT_ROOT/);
});
