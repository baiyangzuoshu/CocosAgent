import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { cloneCreatorProject, createCreatorProject, listCreatorProjects, listCreatorTemplates } from '../project-lifecycle.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-project-lifecycle-'));
  const source = path.join(root, 'source');
  fs.mkdirSync(path.join(source, 'assets', 'Scenes'), { recursive: true });
  fs.mkdirSync(path.join(source, 'library'), { recursive: true });
  fs.mkdirSync(path.join(source, '.git'), { recursive: true });
  fs.writeFileSync(path.join(source, 'project.json'), JSON.stringify({
    engine: 'cocos-creator-js', packages: 'packages', name: 'source-name', id: 'old-project-id', version: '2.4.15', isNew: false,
  }, null, 2));
  fs.writeFileSync(path.join(source, 'assets', 'Scenes', 'main.fire'), '[{"__type__":"cc.SceneAsset"}]');
  fs.writeFileSync(path.join(source, 'assets', 'Scenes', 'main.fire.meta'), '{"uuid":"scene-uuid"}');
  fs.writeFileSync(path.join(source, 'library', 'cache.bin'), 'cache');
  fs.writeFileSync(path.join(source, '.git', 'config'), 'git metadata');
  return { root, source };
}

function templateFixture(root, id, version = '2.4.0') {
  const templateRoot = path.join(root, 'templates');
  const templatePath = path.join(templateRoot, id);
  fs.mkdirSync(path.join(templatePath, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(templatePath, 'project.json'), JSON.stringify({ engine: 'cocos-creator-js', packages: 'packages', version }));
  fs.writeFileSync(path.join(templatePath, 'template.json'), JSON.stringify({ name: `TEMPLATES.${id}.name`, desc: `TEMPLATES.${id}.desc` }));
  fs.writeFileSync(path.join(templatePath, 'assets', 'scene.fire.meta'), '{"uuid":"template-scene-uuid"}');
  return { templateRoot, templatePath };
}

test('project list discovers supported and unsupported projects while excluding caches and links', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const projectsRoot = path.join(state.root, 'projects');
  fs.mkdirSync(projectsRoot);
  const newer = path.join(projectsRoot, 'newer');
  fs.mkdirSync(newer);
  fs.writeFileSync(path.join(newer, 'project.json'), JSON.stringify({ name: 'newer', version: '3.8.7' }));
  const malformed = path.join(projectsRoot, 'malformed');
  fs.mkdirSync(malformed);
  fs.writeFileSync(path.join(malformed, 'project.json'), '{');
  const cacheProject = path.join(projectsRoot, 'temp', 'hidden');
  fs.mkdirSync(cacheProject, { recursive: true });
  fs.writeFileSync(path.join(cacheProject, 'project.json'), JSON.stringify({ name: 'hidden', version: '2.4.15' }));
  const linked = path.join(projectsRoot, 'linked');
  try { fs.symlinkSync(state.source, linked, 'dir'); } catch (_) {}

  const result = listCreatorProjects({ searchRoots: [projectsRoot, state.root] });
  const byPath = new Map(result.projects.map((project) => [project.projectRoot, project]));
  assert.equal(byPath.get(fs.realpathSync(state.source)).name, 'source-name');
  assert.equal(byPath.get(fs.realpathSync(state.source)).supported, true);
  assert.equal(byPath.get(fs.realpathSync(newer)).supported, false);
  assert.equal(byPath.has(fs.realpathSync(cacheProject)), false);
  assert.equal(byPath.has(linked), false);
  assert.ok(result.issues.some((issue) => issue.path === path.join(fs.realpathSync(malformed), 'project.json') && issue.code === 'PROJECT_JSON_INVALID'));
});

test('project list validates roots and scan depth and marks bounded scans', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const nested = path.join(state.root, 'one', 'two');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(nested, 'project.json'), JSON.stringify({ name: 'nested', version: '2.4.15' }));
  assert.equal(listCreatorProjects({ searchRoots: [state.root], maxDepth: 1 }).projects.some((project) => project.projectRoot === fs.realpathSync(nested)), false);
  assert.equal(listCreatorProjects({ searchRoots: [state.root], maxDepth: 2 }).projects.some((project) => project.projectRoot === fs.realpathSync(nested)), true);
  assert.throws(() => listCreatorProjects({ searchRoots: ['relative'] }), { code: 'PROJECT_SEARCH_ROOTS_INVALID' });
  assert.throws(() => listCreatorProjects({ searchRoots: [state.root], maxDepth: 9 }), { code: 'PROJECT_SEARCH_DEPTH_INVALID' });
});

test('project clone preserves asset metadata bytes, rotates project identity, and omits caches', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const target = path.join(state.root, 'clone');
  const result = cloneCreatorProject({ projectRoot: state.source, targetPath: target, name: 'Clone Project' });
  const project = JSON.parse(fs.readFileSync(path.join(target, 'project.json'), 'utf8'));
  assert.equal(result.success, true);
  assert.equal(result.projectName, 'Clone Project');
  assert.equal(result.opened, false);
  assert.notEqual(project.id, 'old-project-id');
  assert.equal(project.name, 'Clone Project');
  assert.equal(project.version, '2.4.15');
  assert.equal(fs.readFileSync(path.join(target, 'assets', 'Scenes', 'main.fire.meta'), 'utf8'), '{"uuid":"scene-uuid"}');
  assert.equal(fs.readFileSync(path.join(target, 'assets', 'Scenes', 'main.fire'), 'utf8'), '[{"__type__":"cc.SceneAsset"}]');
  assert.equal(fs.existsSync(path.join(target, 'library')), false);
  assert.equal(fs.existsSync(path.join(target, '.git')), false);
  assert.deepEqual(result.skippedDirectories, ['.git', 'library']);
});

test('project clone refuses unsafe and existing destinations and never overwrites them', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const occupied = path.join(state.root, 'occupied');
  fs.mkdirSync(occupied);
  fs.writeFileSync(path.join(occupied, 'keep.txt'), 'keep');
  assert.throws(() => cloneCreatorProject({ projectRoot: state.source, targetPath: occupied }), { code: 'PROJECT_TARGET_ALREADY_EXISTS' });
  assert.equal(fs.readFileSync(path.join(occupied, 'keep.txt'), 'utf8'), 'keep');
  assert.throws(() => cloneCreatorProject({ projectRoot: state.source, targetPath: path.join(state.source, 'nested') }), { code: 'PROJECT_CLONE_PATH_OVERLAP' });
  assert.throws(() => cloneCreatorProject({ projectRoot: state.source, targetPath: path.join(state.root, 'new'), name: 'bad\nname' }), { code: 'PROJECT_NAME_INVALID' });
  assert.equal(fs.readdirSync(state.root).some((entry) => entry.includes('cocos-clone-')), false);
});

test('project clone refuses source symlinks and removes its incomplete staging tree', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const outside = path.join(state.root, 'outside.txt');
  fs.writeFileSync(outside, 'outside');
  try { fs.symlinkSync(outside, path.join(state.source, 'assets', 'linked.txt')); }
  catch (_) { return; }
  const target = path.join(state.root, 'symlink-clone');
  assert.throws(() => cloneCreatorProject({ projectRoot: state.source, targetPath: target }), { code: 'PROJECT_CLONE_SYMLINK_UNSUPPORTED' });
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'outside');
  assert.equal(fs.readdirSync(state.root).some((entry) => entry.includes('cocos-clone-')), false);
});

test('project templates list reports local Creator 2.x templates and marks incompatible entries', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const templates = templateFixture(state.root, 'hello-world');
  templateFixture(state.root, 'old-engine', '3.8.7');
  const result = listCreatorTemplates({ templateRoot: templates.templateRoot });
  assert.deepEqual(result.templates.map((item) => item.id), ['hello-world']);
  assert.equal(result.templates[0].templateCreatorVersion, '2.4.0');
  assert.equal(result.templates[0].nameKey, 'TEMPLATES.hello-world.name');
  assert.ok(result.issues.some((issue) => issue.id === 'old-engine' && issue.code === 'PROJECT_TEMPLATE_CREATOR_VERSION_UNSUPPORTED'));
});

test('project create stamps the selected local template for Creator 2.4.15 and preserves metadata', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const templates = templateFixture(state.root, 'hello-world');
  const target = path.join(state.root, 'created');
  const result = createCreatorProject({ templateId: 'hello-world', templateRoot: templates.templateRoot,
    targetPath: target, name: 'Created Project' });
  const project = JSON.parse(fs.readFileSync(path.join(target, 'project.json'), 'utf8'));
  assert.equal(result.sourceTemplateId, 'hello-world');
  assert.equal(project.version, '2.4.15');
  assert.equal(project.name, 'Created Project');
  assert.ok(project.id);
  assert.equal(fs.readFileSync(path.join(target, 'assets', 'scene.fire.meta'), 'utf8'), '{"uuid":"template-scene-uuid"}');
  assert.equal(result.opened, false);
  assert.throws(() => createCreatorProject({ templateId: '../hello-world', templateRoot: templates.templateRoot,
    targetPath: path.join(state.root, 'bad') }), { code: 'PROJECT_TEMPLATE_ID_INVALID' });
});

test('project CLI exposes filesystem discovery and local cloning as JSON commands', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs');
  const listed = spawnSync(process.execPath, [cli, 'project', 'list', '--search-root', state.root, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).projects[0].projectRoot, fs.realpathSync(state.source));
  const target = path.join(state.root, 'cli-clone');
  const cloned = spawnSync(process.execPath, [cli, 'project', 'clone', '--project-root', state.source, '--target', target, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(cloned.status, 0, cloned.stderr);
  assert.equal(JSON.parse(cloned.stdout).projectRoot, path.join(fs.realpathSync(state.root), 'cli-clone'));
  const templates = templateFixture(state.root, 'cli-template');
  const listedTemplates = spawnSync(process.execPath, [cli, 'project', 'templates', 'list', '--template-root', templates.templateRoot, '--format', 'json'], { encoding: 'utf8' });
  assert.equal(listedTemplates.status, 0, listedTemplates.stderr);
  assert.equal(JSON.parse(listedTemplates.stdout).templates[0].id, 'cli-template');
  const created = spawnSync(process.execPath, [cli, 'project', 'create', '--template', 'cli-template', '--template-root', templates.templateRoot,
    '--target', path.join(state.root, 'cli-created'), '--format', 'json'], { encoding: 'utf8' });
  assert.equal(created.status, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).creatorVersion, '2.4.15');
});
