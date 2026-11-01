import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runVcsConflictReport, runVcsConflictResolve } from '../vcs-diff.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneUuid = 'a0XObHorNAbIr2hxhGwXCb';
const heroUuid = 'b0XObHorNAbIr2hxhGwXCb';
const cameraUuid = 'c0XObHorNAbIr2hxhGwXCb';

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function writeScene(projectRoot, { heroActive = true, heroName = 'Hero', cameraName = 'Camera',
  sceneId = sceneUuid, metaTag = 'shared' } = {}) {
  const sceneFile = path.join(projectRoot, 'assets', 'Level.fire');
  fs.writeFileSync(sceneFile, JSON.stringify([
    { __type__: 'cc.SceneAsset', scene: { __id__: 1 } },
    { __type__: 'cc.Scene', _id: sceneId, _name: 'Level', _parent: null,
      _children: [{ __id__: 2 }, { __id__: 3 }], _active: true },
    { __type__: 'cc.Node', _id: heroUuid, _name: heroName, _parent: { __id__: 1 },
      _children: [], _components: [], _active: heroActive },
    { __type__: 'cc.Node', _id: cameraUuid, _name: cameraName, _parent: { __id__: 1 },
      _children: [], _components: [], _active: true },
  ]));
  fs.writeFileSync(`${sceneFile}.meta`, JSON.stringify({ uuid: sceneId, importer: 'scene', userData: { branch: metaTag } }));
}

function fixture({ ours, theirs, scriptConflict = false, oursMetaTag = 'shared', theirsMetaTag = 'shared' }) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-conflicts-')));
  const gitRoot = path.join(directory, 'repo');
  const projectRoot = path.join(gitRoot, 'game');
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'conflict-fixture', version: '2.4.15' }));
  if (scriptConflict) fs.writeFileSync(path.join(projectRoot, 'assets', 'Conflict.ts'), 'export const choice = "base";\n');
  git(gitRoot, ['init', '-q']);
  git(gitRoot, ['config', 'user.name', 'VCS Conflict Test']);
  git(gitRoot, ['config', 'user.email', 'vcs-conflicts@example.invalid']);
  writeScene(projectRoot);
  git(gitRoot, ['add', '.']);
  git(gitRoot, ['commit', '-m', 'Base scene']);
  const base = git(gitRoot, ['rev-parse', 'HEAD']);
  const mainBranch = git(gitRoot, ['branch', '--show-current']);

  git(gitRoot, ['checkout', '-qb', 'feature', base]);
  writeScene(projectRoot, { ...theirs, metaTag: theirsMetaTag });
  if (scriptConflict) fs.writeFileSync(path.join(projectRoot, 'assets', 'Conflict.ts'), 'export const choice = "theirs";\n');
  git(gitRoot, ['add', 'game/assets/Level.fire', 'game/assets/Level.fire.meta',
    ...(scriptConflict ? ['game/assets/Conflict.ts'] : [])]);
  git(gitRoot, ['commit', '-m', 'Feature scene changes']);
  git(gitRoot, ['checkout', '-q', mainBranch]);
  writeScene(projectRoot, { ...ours, metaTag: oursMetaTag });
  if (scriptConflict) fs.writeFileSync(path.join(projectRoot, 'assets', 'Conflict.ts'), 'export const choice = "ours";\n');
  git(gitRoot, ['add', 'game/assets/Level.fire', 'game/assets/Level.fire.meta',
    ...(scriptConflict ? ['game/assets/Conflict.ts'] : [])]);
  git(gitRoot, ['commit', '-m', 'Main scene changes']);
  const merge = spawnSync('git', ['-C', gitRoot, 'merge', '--no-edit', 'feature'], { encoding: 'utf8' });
  assert.notEqual(merge.status, 0, 'fixture must leave an unresolved Git conflict');
  return { directory, gitRoot, projectRoot };
}

function stateDigest(state) {
  const indexPath = path.join(state.gitRoot, '.git', 'index');
  const filePath = path.join(state.projectRoot, 'assets', 'Level.fire');
  return { index: createHash('sha256').update(fs.readFileSync(indexPath)).digest('hex'),
    workingFile: createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'),
    status: git(state.gitRoot, ['status', '--porcelain']) };
}

test('vcs conflicts explains disjoint scene changes without touching Git stages or files', (t) => {
  const state = fixture({ ours: { heroActive: false }, theirs: { cameraName: 'MainCamera' } });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const before = stateDigest(state);

  const report = runVcsConflictReport(state);

  assert.equal(report.readOnly, true);
  assert.equal(report.hasConflicts, true);
  assert.equal(report.summary.semanticAssets, 1);
  const asset = report.conflicts.find((item) => item.path === 'assets/Level.fire');
  assert.deepEqual(Object.keys(asset.stages).sort(), ['base', 'ours', 'theirs']);
  assert.equal(asset.semantic.available, true);
  assert.equal(asset.semantic.status, 'disjoint-or-converged');
  assert.equal(asset.semantic.overlap.conflictCount, 0);
  assert.ok(asset.semantic.nonOverlapping.oursKeys.some((key) => key.includes(`${heroUuid}:active`)));
  assert.ok(asset.semantic.nonOverlapping.theirsKeys.some((key) => key.includes(`${cameraUuid}:name`)));
  assert.equal(asset.semantic.resolution.required, true);
  assert.deepEqual(stateDigest(state), before);

  const cli = spawnSync(process.execPath, [path.join(packageRoot, 'cli.mjs'), 'vcs', 'conflicts',
    '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).summary.projectConflicts, report.summary.projectConflicts);
});

test('vcs conflicts identifies divergent writes to the same node field', (t) => {
  const state = fixture({ ours: { heroName: 'HeroLeft' }, theirs: { heroName: 'HeroRight' } });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const report = runVcsConflictReport(state);
  const asset = report.conflicts.find((item) => item.path === 'assets/Level.fire');
  const conflict = asset.semantic.overlap.conflicts.find((item) => item.key === `node:${heroUuid}:name`);

  assert.equal(asset.semantic.available, true);
  assert.equal(asset.semantic.status, 'overlapping-changes');
  assert.deepEqual(conflict.base, { present: true, value: 'Hero' });
  assert.deepEqual(conflict.ours, { present: true, value: 'HeroLeft' });
  assert.deepEqual(conflict.theirs, { present: true, value: 'HeroRight' });
  assert.equal(report.summary.semanticOverlaps, 1);
});

test('vcs conflicts refuses to merge serialized asset identity drift', (t) => {
  const state = fixture({ ours: { heroActive: false }, theirs: { sceneId: 'd0XObHorNAbIr2hxhGwXCb' } });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const report = runVcsConflictReport(state);
  const asset = report.conflicts.find((item) => item.path === 'assets/Level.fire');

  assert.equal(asset.semantic.available, false);
  assert.equal(asset.semantic.reason, 'CREATOR_ASSET_DIFF_IDENTITY_MISMATCH');
  assert.equal(asset.semantic.metadataIdentities.base.uuid, sceneUuid);
  assert.equal(asset.semantic.metadataIdentities.theirs.uuid, 'd0XObHorNAbIr2hxhGwXCb');
});

test('vcs conflicts reports non-serialized files by their Git stages', (t) => {
  const state = fixture({ ours: { heroActive: false }, theirs: { cameraName: 'MainCamera' }, scriptConflict: true });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const report = runVcsConflictReport(state);
  assert.ok(report.conflicts.some((item) => item.path === 'assets/Level.fire' && item.kind === 'scene'));
  const script = report.conflicts.find((item) => item.path === 'assets/Conflict.ts');
  assert.equal(script.kind, 'other');
  assert.equal(script.completeStages, true);
  assert.deepEqual(Object.keys(script.stages).sort(), ['base', 'ours', 'theirs']);
  assert.equal(report.readOnly, true);
});

test('vcs conflicts resolve plans without mutation and applies the selected scene side', (t) => {
  const state = fixture({ ours: { heroName: 'HeroOurs' }, theirs: { heroName: 'HeroTheirs' } });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const before = stateDigest(state);

  const plan = runVcsConflictResolve({ ...state, assetPath: 'assets/Level.fire', side: 'theirs' });

  assert.equal(plan.status, 'planned');
  assert.equal(plan.readOnly, true);
  assert.equal(plan.applyRequired, true);
  assert.ok(plan.guardedPaths.some((item) => item.path === 'assets/Level.fire.meta'));
  assert.deepEqual(stateDigest(state), before);

  const cliPlan = spawnSync(process.execPath, [path.join(packageRoot, 'cli.mjs'), 'vcs', 'conflicts', 'resolve',
    '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--path', 'assets/Level.fire',
    '--side', 'ours', '--format', 'json'], { encoding: 'utf8' });
  assert.equal(cliPlan.status, 0, cliPlan.stderr);
  assert.equal(JSON.parse(cliPlan.stdout).status, 'planned');

  const result = runVcsConflictResolve({ ...state, assetPath: 'assets/Level.fire', side: 'theirs', apply: true });
  assert.equal(result.status, 'resolved');
  assert.equal(result.indexUpdated, true);
  assert.equal(git(state.gitRoot, ['ls-files', '--unmerged']).length, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(state.projectRoot, 'assets', 'Level.fire'), 'utf8'))[2]._name, 'HeroTheirs');
  assert.equal(git(state.gitRoot, ['show', ':game/assets/Level.fire']).includes('HeroTheirs'), true);
});

test('vcs conflicts resolve selects matching scene metadata when both files conflict', (t) => {
  const state = fixture({ ours: { heroName: 'HeroOurs' }, theirs: { heroName: 'HeroTheirs' },
    oursMetaTag: 'ours', theirsMetaTag: 'theirs' });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));

  const result = runVcsConflictResolve({ ...state, assetPath: 'assets/Level.fire.meta', side: 'ours', apply: true });

  assert.equal(result.status, 'resolved');
  assert.deepEqual(result.files.map((item) => item.path).sort(), ['assets/Level.fire', 'assets/Level.fire.meta']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(state.projectRoot, 'assets', 'Level.fire'), 'utf8'))[2]._name, 'HeroOurs');
  assert.equal(JSON.parse(fs.readFileSync(path.join(state.projectRoot, 'assets', 'Level.fire.meta'), 'utf8')).userData.branch, 'ours');
  assert.equal(git(state.gitRoot, ['ls-files', '--unmerged']).length, 0);
});

test('vcs conflicts resolve stages an exact side for ordinary project files', (t) => {
  const state = fixture({ ours: { heroActive: false }, theirs: { cameraName: 'MainCamera' }, scriptConflict: true });
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));

  const result = runVcsConflictResolve({ ...state, assetPath: 'assets/Conflict.ts', side: 'ours', apply: true });

  assert.equal(result.status, 'resolved');
  assert.equal(fs.readFileSync(path.join(state.projectRoot, 'assets', 'Conflict.ts'), 'utf8'), 'export const choice = "ours";\n');
  assert.equal(git(state.gitRoot, ['show', ':game/assets/Conflict.ts']), 'export const choice = "ours";');
  assert.equal(git(state.gitRoot, ['ls-files', '--unmerged']).includes('Conflict.ts'), false);
});
