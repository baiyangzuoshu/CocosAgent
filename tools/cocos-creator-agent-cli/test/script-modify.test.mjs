import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateCommand } from '../bridge/contracts.mjs';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../creator-extension');
const contract = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'command-contract.json'), 'utf8'));

function makeHarness(t, { approved = true, onApproval = () => {} } = {}) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-script-modify-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const home = path.join(tempRoot, 'home');
  const projectRoot = path.join(tempRoot, 'project');
  const assets = path.join(projectRoot, 'assets', 'Scripts');
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'fixture' }));
  const scriptPath = 'Scripts/Player.ts';
  const scriptFile = path.join(projectRoot, 'assets', scriptPath);
  const metaFile = `${scriptFile}.meta`;
  const beforeSource = 'const value = 1;\n';
  const meta = { importer: 'typescript', uuid: 'c8f27f4c-3728-4ce7-8db6-8fdc99e9a70a' };
  fs.writeFileSync(scriptFile, beforeSource);
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

  const fakeHttp = {
    request(_options, onResponse) {
      const request = new EventEmitter();
      request.setTimeout = () => {};
      request.write = () => {};
      request.end = () => {
        const response = new EventEmitter();
        response.statusCode = 200;
        process.nextTick(() => {
          onResponse(response);
          response.emit('data', Buffer.from('{}'));
          response.emit('end');
          request.emit('close');
        });
      };
      request.destroy = (error) => {
        if (error) request.emit('error', error);
        request.emit('close');
      };
      return request;
    },
  };

  let saveCount = 0;
  const Editor = {
    Project: { path: projectRoot },
    App: { version: '2.4.15' },
    assetdb: {
      queryAssets(url, _types, callback) {
        callback(null, [{ url, uuid: meta.uuid, importer: meta.importer, type: 'typescript' }]);
      },
      saveExists(url, source, callback) {
        saveCount += 1;
        assert.equal(url, 'db://assets/Scripts/Player.ts');
        fs.writeFileSync(scriptFile, source);
        callback(null, { uuid: meta.uuid });
      },
    },
    Dialog: { messageBox: () => approved ? 1 : 0 },
  };
  const baseRequire = createRequire(path.join(extensionRoot, 'main.js'));
  const module = { exports: {} };
  const localRequire = (id) => {
    if (id === 'http') return fakeHttp;
    if (id === 'os') return { ...os, homedir: () => home };
    if (id === './approval.cjs') return async () => { onApproval(); return approved; };
    return baseRequire(id);
  };
  const source = fs.readFileSync(path.join(extensionRoot, 'main.js'), 'utf8') + `\nmodule.exports.__test = {
    createScriptModifyPlan, commitScriptModify, reconcileScriptModify,
    setBridgeSession(value) { bridgeSession = value; },
  };`;
  vm.runInNewContext(source, {
    module, exports: module.exports, require: localRequire, __dirname: extensionRoot,
    Buffer, console, process, setTimeout, clearTimeout, Editor,
  }, { filename: 'creator-extension/main.js' });
  const api = module.exports.__test;
  const stateDirectory = path.join(home, '.cocos-creator-agent');
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(path.join(stateDirectory, 'third-party-bridge.json'), JSON.stringify({
    protocolVersion: '0.1', host: '127.0.0.1', port: 43210, token: 't'.repeat(48), bridgeId: 'bridge-fixture',
  }));
  api.setBridgeSession({ bridgeId: 'bridge-fixture', sessionId: 'session-fixture', projectRoot });
  return { api, scriptFile, metaFile, beforeSource, projectRoot, scriptPath, meta, getSaveCount: () => saveCount };
}

const sourceHash = (value) => import('node:crypto').then(({ createHash }) =>
  createHash('sha256').update(Buffer.from(value)).digest('hex'));

function command(id) { return contract.commands.find((entry) => entry.id === id); }

test('script modification commands declare approved write and bounded inputs', () => {
  const plan = command('creator.script.modify.plan');
  const commit = command('creator.script.modify.commit');
  const reconcile = command('creator.script.modify.reconcile');
  assert.equal(plan.access, 'plan');
  assert.deepEqual(plan.input.required, ['scriptPath', 'expectedSourceSha256', 'source']);
  assert.equal(commit.access, 'write');
  assert.equal(commit.approval, true);
  assert.equal(reconcile.access, 'plan');
  assert.equal(validateCommand(plan.id, { scriptPath: 'Scripts/Player.ts', expectedSourceSha256: 'a'.repeat(64),
    source: 'const value = 1;' }).ok, true);
  assert.equal(validateCommand(plan.id, { scriptPath: '../outside.ts', expectedSourceSha256: 'a'.repeat(64),
    source: 'const value = 1;' }).ok, false);
});

test('Creator AssetDB script modification preserves metadata and reconciles without replay', async (t) => {
  const harness = makeHarness(t);
  const replacement = 'const value = 2;\n';
  const plan = await harness.api.createScriptModifyPlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource), source: replacement });
  assert.equal(plan.status, 'planned');
  assert.equal(plan.scriptUuid, harness.meta.uuid);
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), harness.beforeSource);

  const receipt = await harness.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' });
  assert.equal(receipt.status, 'completed');
  assert.equal(receipt.sourceSha256, await sourceHash(replacement));
  assert.equal(receipt.metaSha256, plan.expectedBefore.metaSha256);
  assert.equal(receipt.compile.status, 'pending');
  assert.match(receipt.compile.attribution, /not attributed/);
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), replacement);

  const reconciled = await harness.api.reconcileScriptModify({ operationId: plan.operationId });
  assert.equal(reconciled.status, 'completed');
  assert.equal(reconciled.observed.scriptUuid, harness.meta.uuid);
  assert.equal(fs.readFileSync(harness.metaFile, 'utf8'), JSON.stringify(harness.meta, null, 2));
});

test('script modification rejects stale preconditions and never writes after approval cancellation', async (t) => {
  const stale = makeHarness(t);
  await assert.rejects(stale.api.createScriptModifyPlan({ scriptPath: stale.scriptPath,
    expectedSourceSha256: '0'.repeat(64), source: 'const value = 3;\n' }),
  (error) => error.code === 'SCRIPT_SOURCE_PRECONDITION_FAILED');

  const cancelled = makeHarness(t, { approved: false });
  const plan = await cancelled.api.createScriptModifyPlan({ scriptPath: cancelled.scriptPath,
    expectedSourceSha256: await sourceHash(cancelled.beforeSource), source: 'const value = 4;\n' });
  await assert.rejects(cancelled.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'OPERATION_NOT_APPROVED');
  assert.equal(fs.readFileSync(cancelled.scriptFile, 'utf8'), cancelled.beforeSource);
});

test('a source change between planning and commit turns the operation into conflict', async (t) => {
  const harness = makeHarness(t);
  const plan = await harness.api.createScriptModifyPlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource), source: 'const value = 5;\n' });
  fs.writeFileSync(harness.scriptFile, 'const value = 99;\n');
  await assert.rejects(harness.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'SCRIPT_MODIFY_PRECONDITION_FAILED');
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), 'const value = 99;\n');
});

test('a source change while the native approval dialog is open is rechecked before AssetDB write', async (t) => {
  let harness;
  harness = makeHarness(t, { onApproval() { fs.writeFileSync(harness.scriptFile, 'const value = 88;\n'); } });
  const plan = await harness.api.createScriptModifyPlan({ scriptPath: harness.scriptPath,
    expectedSourceSha256: await sourceHash(harness.beforeSource), source: 'const value = 6;\n' });
  await assert.rejects(harness.api.commitScriptModify({ operationId: plan.operationId, planHash: plan.planHash },
    { requestId: 'request-fixture' }), (error) => error.code === 'SCRIPT_MODIFY_PRECONDITION_FAILED');
  assert.equal(fs.readFileSync(harness.scriptFile, 'utf8'), 'const value = 88;\n');
  assert.equal(harness.getSaveCount(), 0);
});
