import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runVcsDoctor } from '../vcs-integrity.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(root, args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-vcs-doctor-'));
  const gitRoot = path.join(root, 'repo');
  const projectRoot = path.join(gitRoot, 'game');
  fs.mkdirSync(path.join(projectRoot, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'fixture', version: '2.4.15' }));
  fs.writeFileSync(path.join(projectRoot, 'assets', 'hero.png'), 'png fixture');
  fs.writeFileSync(path.join(projectRoot, 'assets', 'hero.png.meta'), JSON.stringify({ uuid: 'hero-uuid', importer: 'texture' }));
  fs.mkdirSync(gitRoot, { recursive: true });
  execFileSync('git', ['-C', gitRoot, 'init'], { stdio: 'ignore' });
  git(gitRoot, ['config', 'user.name', 'VCS Doctor Test']);
  git(gitRoot, ['config', 'user.email', 'vcs-doctor@example.invalid']);
  git(gitRoot, ['add', '.']);
  git(gitRoot, ['commit', '-m', 'fixture']);
  return { root, gitRoot, projectRoot };
}

test('vcs doctor reports asset metadata and conflict issues without changing the index or files', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'missing.js'), 'cc.Class({});');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'orphan.js.meta'), JSON.stringify({ uuid: 'orphan-uuid' }));
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'duplicate.json'), '{}');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'duplicate.json.meta'), JSON.stringify({
    uuid: 'hero-uuid', subMetas: { frame: { uuid: 'hero-uuid' } },
  }));
  fs.mkdirSync(path.join(state.projectRoot, 'assets', 'untracked-folder'));
  fs.mkdirSync(path.join(state.projectRoot, 'library'), { recursive: true });
  fs.writeFileSync(path.join(state.projectRoot, 'library', 'cache.json'), '{}');
  fs.writeFileSync(path.join(state.projectRoot, 'assets', 'Conflict.ts'), [
    '<<<<<<< HEAD', 'const value = 1;', '=======', 'const value = 2;', '>>>>>>> branch',
  ].join('\n'));
  git(state.gitRoot, ['add', 'game/library/cache.json']);
  git(state.gitRoot, ['commit', '-m', 'tracked cache fixture']);

  const indexPath = path.join(state.gitRoot, '.git/index');
  const indexHash = sha256(indexPath);
  const statusBefore = git(state.gitRoot, ['status', '--porcelain']);
  const filesBefore = new Map();
  for (const relative of [
    'project.json', 'assets/hero.png', 'assets/hero.png.meta', 'assets/missing.js', 'assets/orphan.js.meta',
    'assets/duplicate.json', 'assets/duplicate.json.meta', 'assets/Conflict.ts', 'library/cache.json',
  ]) filesBefore.set(relative, sha256(path.join(state.projectRoot, relative)));

  const report = runVcsDoctor(state);
  const findingIds = new Set(report.findings.map((finding) => finding.id));
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.readOnly, true);
  assert.equal(report.ok, false);
  assert.ok(findingIds.has('cache-tracked'));
  assert.ok(findingIds.has('asset-meta-missing'));
  assert.ok(findingIds.has('asset-meta-orphaned'));
  assert.ok(findingIds.has('asset-meta-missing'));
  assert.ok(findingIds.has('asset-uuid-duplicate'));
  assert.ok(findingIds.has('conflict-markers'));
  assert.equal(sha256(indexPath), indexHash);
  assert.equal(git(state.gitRoot, ['status', '--porcelain']), statusBefore);
  for (const [relative, hash] of filesBefore) assert.equal(sha256(path.join(state.projectRoot, relative)), hash);
});

test('vcs doctor reports a clean project and the CLI emits its JSON contract', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const report = runVcsDoctor(state);
  assert.equal(report.ok, true);
  assert.equal(report.summary.findings, 0);
  assert.equal(report.checks.trackedFileCount, 3);

  const result = spawnSync(process.execPath, [path.join(packageRoot, 'cli.mjs'), 'vcs', 'doctor',
    '--git-root', state.gitRoot, '--project-root', state.projectRoot, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.readOnly, true);
  assert.equal(output.projectName, 'fixture');
});

test('vcs doctor requires the exact Git root and keeps the Creator project inside it', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  assert.throws(() => runVcsDoctor({ gitRoot: path.join(state.gitRoot, 'game'), projectRoot: state.projectRoot }),
    /GIT_ROOT_MISMATCH/);
  const outside = path.join(state.root, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'project.json'), JSON.stringify({ name: 'outside' }));
  assert.throws(() => runVcsDoctor({ gitRoot: state.gitRoot, projectRoot: outside }), /PROJECT_OUTSIDE_GIT_ROOT/);
});
