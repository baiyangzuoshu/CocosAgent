import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { discoverCreatorInstallations, openCreatorProject } from '../creator-workflows.mjs';

function appBundle(root, name, version) {
  const bundlePath = path.join(root, name);
  const contentsPath = path.join(bundlePath, 'Contents');
  const executablePath = path.join(contentsPath, 'MacOS', 'CocosCreator');
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(path.join(contentsPath, 'Info.plist'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<plist><dict><key>CFBundleShortVersionString</key>',
    `<string>${version}</string></dict></plist>`,
  ].join(''));
  fs.writeFileSync(executablePath, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return { bundlePath, executablePath };
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-creator-discovery-'));
  const installs = path.join(root, 'installs');
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(installs);
  fs.mkdirSync(projectRoot);
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'fixture', version: '2.4.15' }));
  return { root, installs, projectRoot };
}

test('Creator installation discovery reports versions and filters symlinked bundles', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const supported = appBundle(state.installs, 'Creator-2.4.15.app', '2.4.15');
  appBundle(state.installs, 'Creator-3.8.7.app', '3.8.7');
  const linkedBundle = path.join(state.installs, 'Linked-Creator.app');
  try { fs.symlinkSync(supported.bundlePath, linkedBundle, 'dir'); }
  catch (_) {}

  const inventory = discoverCreatorInstallations({ searchRoots: [state.installs] });
  assert.equal(inventory.supported, true);
  assert.equal(inventory.installations.length, 2);
  assert.equal(inventory.matches, 1);
  assert.equal(inventory.installations.find((item) => item.creatorVersion === '2.4.15').supported, true);
  assert.equal(inventory.installations.find((item) => item.creatorVersion === '3.8.7').status, 'unsupported-version');
  assert.equal(inventory.installations.some((item) => item.bundlePath === linkedBundle), false);
});

test('project open auto-selects the unique Creator version match', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const creator = appBundle(state.installs, 'CocosCreator.app', '2.4.15');
  const child = new EventEmitter();
  child.pid = 1234;
  let observed;
  const resultPromise = openCreatorProject({ projectRoot: state.projectRoot, waitReady: false }, {
    installationSearchRoots: [state.installs],
    spawnImpl(executable, args, options) {
      observed = { executable, args, options };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });
  const result = await resultPromise;
  assert.equal(observed.executable, creator.executablePath);
  assert.deepEqual(observed.args, ['--path', fs.realpathSync(state.projectRoot)]);
  assert.equal(result.creatorVersion, '2.4.15');
  assert.equal(result.launched, true);
});

test('project open refuses ambiguous automatic version matches', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  appBundle(path.join(state.installs, 'first'), 'CocosCreator.app', '2.4.15');
  appBundle(path.join(state.installs, 'second'), 'CocosCreator.app', '2.4.15');
  let spawnCalled = false;
  await assert.rejects(openCreatorProject({ projectRoot: state.projectRoot, waitReady: false }, {
    installationSearchRoots: [state.installs],
    spawnImpl() { spawnCalled = true; },
  }), (error) => error.code === 'CREATOR_INSTALLATION_AMBIGUOUS');
  assert.equal(spawnCalled, false);
});
