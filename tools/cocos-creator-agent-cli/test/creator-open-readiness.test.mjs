import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { diagnoseCreatorModal, openCreatorProject } from '../creator-workflows.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-creator-open-ready-'));
  const projectRoot = path.join(root, 'project');
  const appRoot = path.join(root, 'CocosCreator.app');
  const appContents = path.join(appRoot, 'Contents');
  const executable = path.join(appContents, 'MacOS', 'CocosCreator');
  fs.mkdirSync(projectRoot);
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'ready-fixture', version: '2.4.15' }));
  fs.writeFileSync(path.join(appContents, 'Info.plist'), '<plist><dict><key>CFBundleShortVersionString</key><string>2.4.15</string></dict></plist>');
  fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return { root, projectRoot, appRoot };
}

function liveInstance(projectRoot, instanceId = '11111111-1111-4111-8111-111111111111') {
  return { instanceId, projectRoot, projectName: 'ready-fixture', creatorVersion: '2.4.15',
    extensionVersion: '0.8.8', connected: true, processId: 5400 };
}

function projectInfoReceipt(projectRoot, instanceId = '11111111-1111-4111-8111-111111111111') {
  return { instanceId, projectRoot, creatorVersion: '2.4.15', extensionVersion: '0.8.8',
    result: { projectRoot, projectName: 'ready-fixture', creatorVersion: '2.4.15', extensionVersion: '0.8.8' } };
}

function runningCreator() {
  return { running: true, creator: true, creatorVersion: '2.4.15' };
}

test('project open reuses an already connected matching instance after a live identity probe', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const instance = liveInstance(state.projectRoot);
  let probeCalled = false;
  const result = await openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot,
    waitReady: true, timeoutMs: 1000 }, {
    listInstancesImpl: async () => ({ instances: [instance], rejectedInstances: [] }),
    inspectProcessImpl: (processId) => {
      assert.equal(processId, instance.processId);
      return runningCreator();
    },
    probeProjectImpl: async (instanceId, command, input, options) => {
      probeCalled = true;
      assert.equal(instanceId, instance.instanceId);
      assert.equal(command, 'creator.project.info');
      assert.deepEqual(input, {});
      assert.ok(options.timeoutMs <= 1000);
      return projectInfoReceipt(state.projectRoot, instanceId);
    },
    spawnImpl() { throw new Error('must not launch a duplicate editor'); },
  });
  assert.equal(probeCalled, true);
  assert.equal(result.alreadyOpen, true);
  assert.equal(result.launched, false);
  assert.equal(result.editorReady, true);
  assert.equal(result.readiness.status, 'ready');
});

test('project open waits for the launched project to connect and answer', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const child = new EventEmitter();
  child.pid = 1234;
  child.unref = () => {};
  let listCalls = 0;
  const result = await openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot,
    waitReady: true, timeoutMs: 1000 }, {
    listInstancesImpl: async () => {
      listCalls += 1;
      return { instances: listCalls === 1 ? [] : [liveInstance(state.projectRoot)], rejectedInstances: [] };
    },
    inspectProcessImpl: () => runningCreator(),
    probeProjectImpl: async (instanceId, command) => {
      assert.equal(command, 'creator.project.info');
      return projectInfoReceipt(state.projectRoot, instanceId);
    },
    sleepImpl: async () => {},
    spawnImpl() { queueMicrotask(() => child.emit('spawn')); return child; },
  });
  assert.equal(result.launched, true);
  assert.equal(result.processId, 1234);
  assert.equal(result.editorReady, true);
  assert.equal(result.readiness.status, 'ready');
});

test('project open returns a timeout diagnosis instead of claiming editor readiness', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const child = new EventEmitter();
  child.pid = 1235;
  child.unref = () => {};
  let logicalNow = 0;
  const result = await openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot,
    waitReady: true, timeoutMs: 1000 }, {
    listInstancesImpl: async () => ({ instances: [], rejectedInstances: [] }),
    sleepImpl: async () => {},
    nowImpl: () => { logicalNow += 500; return logicalNow; },
    spawnImpl() { queueMicrotask(() => child.emit('spawn')); return child; },
    diagnoseModalImpl: (processId) => {
      assert.equal(processId, 1235);
      return { status: 'detected', dialogCount: 1 };
    },
  });
  assert.equal(result.success, false);
  assert.equal(result.editorReady, false);
  assert.equal(result.readiness.status, 'timeout');
  assert.equal(result.readiness.reason, 'CREATOR_EXTENSION_NOT_CONNECTED');
  assert.deepEqual(result.readiness.modalDiagnosis, { status: 'detected', dialogCount: 1 });
  assert.match(result.readiness.possibleBlocker, /detected 1 Creator modal dialog/);
});

test('macOS modal diagnosis reads only dialog counts and reports accessibility permission failures', () => {
  let captured;
  const result = diagnoseCreatorModal(1234, { platform: 'darwin', spawnSyncImpl(...args) {
    captured = args;
    return { status: 0, stdout: '2\n', stderr: '' };
  } });
  assert.deepEqual(result, { status: 'detected', dialogCount: 2 });
  assert.equal(captured[0], '/usr/bin/osascript');
  assert.equal(captured[1].at(-1), '1234');
  assert.equal(captured[2].timeout, 2000);
  assert.match(captured[1][1], /AXDialog/);
  assert.match(captured[1][1], /AXSheet/);

  const denied = diagnoseCreatorModal(1234, { platform: 'darwin', spawnSyncImpl: () => ({
    status: 1, stdout: '', stderr: 'Not authorized to send Apple events to System Events',
  }) });
  assert.deepEqual(denied, { status: 'unavailable', reason: 'ACCESSIBILITY_PERMISSION_REQUIRED' });
  assert.equal(diagnoseCreatorModal(1234, { platform: 'win32' }).reason, 'MODAL_DIAGNOSTIC_PLATFORM_UNSUPPORTED');
});

test('project open rejects a live but wrong-project probe instead of reporting ready', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const wrongProject = path.join(state.root, 'other-project');
  const instance = liveInstance(state.projectRoot);
  await assert.rejects(openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot,
    waitReady: true, timeoutMs: 1000 }, {
    listInstancesImpl: async () => ({ instances: [instance], rejectedInstances: [] }),
    inspectProcessImpl: () => runningCreator(),
    probeProjectImpl: async () => projectInfoReceipt(wrongProject),
    spawnImpl() { throw new Error('must not launch a duplicate editor'); },
  }), (error) => error.code === 'CREATOR_OPEN_TARGET_IDENTITY_MISMATCH');
});

test('project open ignores stale instance records whose Creator process has exited', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const stale = [
    liveInstance(state.projectRoot, '11111111-1111-4111-8111-111111111111'),
    liveInstance(state.projectRoot, '22222222-2222-4222-8222-222222222222'),
  ].map((instance, index) => ({ ...instance, processId: 5400 + index }));
  const child = new EventEmitter();
  child.pid = 1236;
  child.unref = () => {};
  let listCalls = 0;
  let launched = false;
  const result = await openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot,
    waitReady: true, timeoutMs: 1000 }, {
    listInstancesImpl: async () => {
      listCalls += 1;
      return { instances: listCalls === 1 ? stale : [{ ...liveInstance(state.projectRoot), processId: 1236 }],
        rejectedInstances: [] };
    },
    inspectProcessImpl: (processId) => processId === 1236
      ? runningCreator() : { running: false, creator: false, executable: null },
    probeProjectImpl: async (instanceId) => projectInfoReceipt(state.projectRoot, instanceId),
    spawnImpl() { launched = true; queueMicrotask(() => child.emit('spawn')); return child; },
  });
  assert.equal(launched, true);
  assert.equal(result.launched, true);
  assert.equal(result.editorReady, true);
  assert.equal(result.readiness.status, 'ready');
});

test('project open ignores rejected extension records after their Creator process has exited', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const rejected = { instanceId: '11111111-1111-4111-8111-111111111111',
    reportedProjectRoot: state.projectRoot, creatorVersion: '2.4.15', extensionVersion: '0.8.73',
    connected: false, processId: 5400, reasons: ['EXTENSION_VERSION_MISMATCH'] };
  const child = new EventEmitter();
  child.pid = 1237;
  child.unref = () => {};
  let listCalls = 0;
  let launched = false;
  const result = await openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot,
    waitReady: true, timeoutMs: 1000 }, {
    listInstancesImpl: async () => {
      listCalls += 1;
      return listCalls === 1 ? { instances: [], rejectedInstances: [rejected] }
        : { instances: [{ ...liveInstance(state.projectRoot), processId: 1237 }], rejectedInstances: [] };
    },
    inspectProcessImpl: (processId) => processId === 1237
      ? runningCreator() : { running: false, creator: false, executable: null },
    probeProjectImpl: async (instanceId) => projectInfoReceipt(state.projectRoot, instanceId),
    spawnImpl() { launched = true; queueMicrotask(() => child.emit('spawn')); return child; },
  });
  assert.equal(launched, true);
  assert.equal(result.launched, true);
  assert.equal(result.editorReady, true);
  assert.equal(result.readiness.status, 'ready');
});
