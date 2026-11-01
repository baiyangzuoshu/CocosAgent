import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension');

test('Prefab capability and save events use Creator IpcListener when Editor.Ipc has no event emitter', async () => {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const nativeRequire = createRequire(path.join(root, 'main.js'));
  const ipcMain = new EventEmitter();
  const creatorEvents = new EventEmitter();
  class IpcListener {
    constructor() { this.listeners = []; }
    on(name, callback) { creatorEvents.on(name, callback); this.listeners.push([name, callback]); }
    clear() { for (const [name, callback] of this.listeners) creatorEvents.removeListener(name, callback); }
  }
  let sceneQueries = 0;
  let emitSaved = false;
  vm.runInNewContext(source + '\nmodule.exports.refresh = refreshPrefabEditModeCapability; module.exports.capabilities = capabilityList; module.exports.save = savePrefabSourceMode; module.exports.probe = fn => { currentPrefabEditMode = fn; }; module.exports.disk = fn => { waitForPrefabSourcePatchDisk = fn; };', {
    module, exports: module.exports,
    require: (id) => id === 'electron' ? { ipcMain } : nativeRequire(id), __dirname: root,
    Buffer, console, process, setTimeout, clearTimeout,
    Editor: { IpcListener, Project: { path: root }, assetdb: { queryAssets() {} }, Ipc: { sendToAll() {} }, Scene: {
      callSceneScript(packageName, method, input, callback) {
        if (method === 'savePrefabSource') {
          if (emitSaved) creatorEvents.emit('scene:saved', {});
          callback(null, { available: true, prefabUuid: input.prefabUuid, saved: true });
          return;
        }
        assert.equal(method, 'prefabEditModeState');
        sceneQueries += 1;
        callback(null, { available: true, modeName: 'scene', saveAvailable: true, popAvailable: true });
      },
    } },
  });
  assert.equal(await module.exports.refresh(), true);
  assert.equal(sceneQueries, 1);
  for (const id of ['creator.prefab.source.patch.plan', 'creator.prefab.source.patch.commit']) {
    assert.equal(module.exports.capabilities().find((item) => item.id === id).status, 'available');
  }
  module.exports.probe(async () => ({ modeName: 'prefab', prefabUuid: 'asset' }));
  module.exports.disk(async () => ({ verified: true }));
  const operation = { plan: { prefabUuid: 'asset' } };
  const saved = await module.exports.save(operation);
  assert.equal(saved.eventConfirmed, false);
  assert.equal(saved.disk.verified, true);
  assert.equal(creatorEvents.listenerCount('scene:saved'), 0);
  assert.equal(ipcMain.listenerCount('scene:saved'), 0);
  emitSaved = true;
  assert.equal((await module.exports.save(operation)).eventConfirmed, true);
  module.exports.disk(async () => { throw new Error('disk mismatch'); });
  await assert.rejects(module.exports.save(operation), /disk mismatch/);
  assert.equal(creatorEvents.listenerCount('scene:saved'), 0);
});

test('component write receipts work in Creator runtimes without Object.hasOwn', () => {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  vm.runInNewContext('Object.hasOwn = undefined;\n' + source + '\nmodule.exports.receipt = sceneComponentPropertyReceipt;', {
    module, exports: module.exports, require: createRequire(path.join(root, 'main.js')), __dirname: root,
    Buffer, console, process, setTimeout, clearTimeout,
  });
  const operation = { operationId: 'test', status: 'completed', plan: { property: 'counter',
    expectedBefore: { value: 0 }, expectedAfter: { value: 7 } } };
  assert.equal(module.exports.receipt(operation, { value: 7 }).value, 7);
  assert.equal(module.exports.receipt(operation, { value: 0 }).value, 0);
  assert.equal(module.exports.receipt(operation, Object.create({ value: 7 })).value, null);
});

test('Prefab mode transitions use exact mode readback without requiring scene:ready', async () => {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const dispatched = [];
  vm.runInNewContext(source + '\nmodule.exports.enter = enterPrefabSourceMode; module.exports.wait = waitForPrefabEditMode; module.exports.probe = fn => { currentPrefabEditMode = fn; };', {
    module, exports: module.exports, require: createRequire(path.join(root, 'main.js')), __dirname: root,
    Buffer, console, process, setTimeout, clearTimeout,
    Editor: { Ipc: { sendToAll: (...args) => dispatched.push(args) } },
  });
  let probes = 0;
  module.exports.probe(async () => ++probes < 3 ? { modeName: 'scene', sceneUuid: 'original' }
    : { modeName: 'prefab', prefabUuid: 'target' });
  assert.equal((await module.exports.enter('target', 'original')).prefabUuid, 'target');
  assert.deepEqual(dispatched, [['scene:enter-prefab-edit-mode', 'target']]);
  module.exports.probe(async () => ({ modeName: 'prefab', prefabUuid: 'other' }));
  await assert.rejects(module.exports.wait({ modeName: 'prefab', prefabUuid: 'target' }, 10), /PREFAB_MODE_TARGET_MISMATCH/);
  module.exports.probe(async () => ({ modeName: 'scene', sceneUuid: 'original' }));
  await assert.rejects(module.exports.wait({ modeName: 'prefab', prefabUuid: 'target' }, 1), /PREFAB_MODE_TRANSITION_TIMEOUT/);
});

test('Provider schema discovery and input validation work without Object.hasOwn', () => {
  const module = { exports: {} };
  vm.runInNewContext('Object.hasOwn = undefined;\n' + fs.readFileSync(path.join(root, 'provider-contract.cjs'), 'utf8'), {
    module, exports: module.exports, require: createRequire(path.join(root, 'provider-contract.cjs')), Buffer,
  });
  const metadata = { creatorVersion: '2.4.15', protocolVersion: '1', commands: [{ id: 'run-tests', access: 'control',
    approval: true, title: 'Tests', description: 'Project tests', input: { type: 'object', required: ['query'],
      properties: { query: { type: 'string', maxLength: 10 } }, additionalProperties: false } }] };
  const provider = module.exports.normalizeProvider('project-tests', metadata);
  assert.equal(provider.commands[0].approval, true);
  assert.equal(module.exports.validateArguments(provider.commands[0].input, { query: 'test' }).query, 'test');
  assert.throws(() => module.exports.validateArguments(provider.commands[0].input, {}), /EXTENSION_COMMAND_INPUT_REQUIRED/);
});
