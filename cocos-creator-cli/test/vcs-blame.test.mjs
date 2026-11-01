import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runVcsDiff, runVcsObjectBlame } from '../vcs-diff.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sceneUuid = 'a0XObHorNAbIr2hxhGwXCb';
const heroUuid = 'b0XObHorNAbIr2hxhGwXCb';
const cameraUuid = 'c0XObHorNAbIr2hxhGwXCb';

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function writeScene(projectRoot, { heroActive = true, cameraName = 'Camera' } = {}) {
  const sceneFile = path.join(projectRoot, 'assets', 'Level.fire');
  const records = [
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneUuid, _name: 'Level', _parent: null,
      _children: [{ __id__: 2 }, { __id__: 3 }], _active: true },
    { __type__: 'cc.Node', _id: heroUuid, _name: 'Hero', _parent: { __id__: 1 },
      _children: [], _components: [], _active: heroActive },
    { __type__: 'cc.Node', _id: cameraUuid, _name: cameraName, _parent: { __id__: 1 },
      _children: [], _components: [], _active: true },
  ];
  fs.writeFileSync(sceneFile, JSON.stringify(records));
  fs.writeFileSync(`${sceneFile}.meta`, JSON.stringify({ uuid: sceneUuid, importer: 'scene' }));
}

function fixture() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-blame-')));
  const gitRoot = path.join(directory, 'repo');
  const projectRoot = path.join(gitRoot, 'game');
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'blame-fixture', version: '2.4.15' }));
  git(gitRoot, ['init', '-q']);
  git(gitRoot, ['config', 'user.name', 'VCS Blame Test']);
  git(gitRoot, ['config', 'user.email', 'vcs-blame@example.invalid']);
  writeScene(projectRoot);
  git(gitRoot, ['add', '.']);
  git(gitRoot, ['commit', '-m', 'Add scene objects']);
  const addedCommit = git(gitRoot, ['rev-parse', 'HEAD']);
  writeScene(projectRoot, { heroActive: false });
  git(gitRoot, ['add', 'game/assets/Level.fire']);
  git(gitRoot, ['commit', '-m', 'Deactivate Hero']);
  const heroCommit = git(gitRoot, ['rev-parse', 'HEAD']);
  writeScene(projectRoot, { heroActive: false, cameraName: 'MainCamera' });
  git(gitRoot, ['add', 'game/assets/Level.fire']);
  git(gitRoot, ['commit', '-m', 'Rename camera']);
  const cameraCommit = git(gitRoot, ['rev-parse', 'HEAD']);
  return { directory, gitRoot, projectRoot, addedCommit, heroCommit, cameraCommit };
}

test('vcs blame finds the last semantic change for one stable Creator node UUID', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const indexPath = path.join(state.gitRoot, '.git', 'index');
  const indexHash = createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex');
  const beforeStatus = git(state.gitRoot, ['status', '--porcelain']);

  const result = runVcsObjectBlame({ ...state, assetPath: 'assets/Level.fire', nodeUuid: heroUuid });

  assert.equal(result.readOnly, true);
  assert.equal(result.found, true);
  assert.equal(result.existsAtRevision, true);
  assert.equal(result.revisionCommit, state.cameraCommit);
  assert.equal(result.lastChange.commit, state.heroCommit);
  assert.equal(result.lastChange.subject, 'Deactivate Hero');
  assert.equal(result.lastChange.type, 'modified');
  assert.deepEqual(result.lastChange.change.changes.active, { before: true, after: false });
  assert.equal(result.history.strategy, 'first-parent-path');
  assert.equal(createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex'), indexHash);
  assert.equal(git(state.gitRoot, ['status', '--porcelain']), beforeStatus);

  const cli = spawnSync(process.execPath, [path.join(packageRoot, 'cli.mjs'), 'vcs', 'blame',
    '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--path', 'assets/Level.fire',
    '--node', heroUuid, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).lastChange.commit, state.heroCommit);
});

test('vcs diff compares serialized scene semantics between two Git revisions', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));

  const result = runVcsDiff({ ...state, assetPath: 'assets/Level.fire',
    from: state.addedCommit, to: state.cameraCommit });

  assert.equal(result.readOnly, true);
  assert.equal(result.from.commit, state.addedCommit);
  assert.equal(result.to.commit, state.cameraCommit);
  const hero = result.diff.changed.find((node) => node.uuid === heroUuid);
  const camera = result.diff.changed.find((node) => node.uuid === cameraUuid);
  assert.deepEqual(hero.changes.active, { before: true, after: false });
  assert.deepEqual(camera.changes.name, { before: 'Camera', after: 'MainCamera' });
});

test('vcs blame reports object creation and bounded history honestly', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const created = runVcsObjectBlame({ ...state, assetPath: 'assets/Level.fire', nodeUuid: heroUuid,
    revision: state.addedCommit });
  assert.equal(created.lastChange.commit, state.addedCommit);
  assert.equal(created.lastChange.type, 'added');
  assert.equal(created.existsAtRevision, true);

  const bounded = runVcsObjectBlame({ ...state, assetPath: 'assets/Level.fire', nodeUuid: heroUuid, maxCommits: 1 });
  assert.equal(bounded.history.scannedCommits, 1);
  assert.equal(bounded.history.truncated, true);
  assert.equal(bounded.lastChange, null);
  assert.equal(bounded.existsAtRevision, true);
});

test('vcs blame validates project identity, asset path, node UUID and history limit', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const options = { ...state, assetPath: 'assets/Level.fire', nodeUuid: heroUuid };
  assert.throws(() => runVcsObjectBlame({ ...options, nodeUuid: '' }), { code: 'VCS_BLAME_NODE_UUID_INVALID' });
  assert.throws(() => runVcsObjectBlame({ ...options, maxCommits: 257 }), { code: 'VCS_BLAME_HISTORY_LIMIT_INVALID' });
  assert.throws(() => runVcsObjectBlame({ ...options, assetPath: '../outside.fire' }), { code: 'VCS_DIFF_PATH_INVALID' });
});
