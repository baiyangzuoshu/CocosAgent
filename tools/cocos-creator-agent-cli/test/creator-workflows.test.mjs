import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { closeCreatorProject, openCreatorProject, requestCreatorProjectClose, resolveCreatorExecutable,
  runCreatorWorkflow } from '../creator-workflows.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-creator-workflow-'));
  const projectRoot = path.join(root, 'project');
  const appRoot = path.join(root, 'CocosCreator.app');
  const contents = path.join(appRoot, 'Contents');
  const executable = path.join(contents, 'MacOS/CocosCreator');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'build-fixture', version: '2.4.15' }));
  fs.writeFileSync(path.join(contents, 'Info.plist'), [
    '<plist><dict><key>CFBundleShortVersionString</key><string>2.4.15</string></dict></plist>',
  ].join(''));
  fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n');
  fs.chmodSync(executable, 0o755);
  return { root, projectRoot, appRoot, executable };
}

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.killed = false;
  }
  kill() { this.killed = true; return true; }
}

test('Creator build workflow verifies project and editor versions, then returns a machine result', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  assert.equal(resolveCreatorExecutable(state.appRoot).creatorVersion, '2.4.15');
  const outputPath = path.join(state.root, 'build-output');
  let observedArgs;
  const result = await runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: outputPath, debug: true,
    excludedModules: ['physics-2d', 'physics-3d'] }, {
    spawnImpl(executable, args, options) {
      assert.equal(executable, state.executable);
      assert.equal(options.cwd, fs.realpathSync(state.projectRoot));
      observedArgs = args;
      const child = new FakeChild();
      queueMicrotask(() => {
        fs.mkdirSync(outputPath, { recursive: true });
        child.stdout.end('build finished');
        child.stderr.end();
        child.emit('close', 0, null);
      });
      return child;
    },
  });
  assert.equal(result.success, true);
  assert.equal(result.outputExists, true);
  assert.equal(result.failureCode, null);
  assert.equal(result.failureReason, null);
  assert.equal(result.creatorVersion, '2.4.15');
  assert.equal(result.platform, 'web-mobile');
  assert.ok(observedArgs.includes('--build'));
  assert.ok(observedArgs.at(-1).includes(`buildPath=${fs.realpathSync(path.dirname(outputPath))}/${path.basename(outputPath)}`));
  assert.ok(observedArgs.at(-1).includes('debug=true'));
  assert.ok(observedArgs.at(-1).includes("excludedModules=['physics-2d','physics-3d']"));
  assert.deepEqual(result.excludedModules, ['physics-2d', 'physics-3d']);
  await assert.rejects(runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: path.join(state.projectRoot, 'build') }),
  (error) => error.code === 'BUILD_PATH_MUST_BE_OUTSIDE_PROJECT');
});

test('project open validates both Creator versions and launches the editor with --path', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  let observed;
  let unrefCalled = false;
  const child = new EventEmitter();
  child.pid = 4321;
  child.unref = () => { unrefCalled = true; };
  const receipt = openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot }, {
    spawnImpl(executable, args, options) {
      observed = { executable, args, options };
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  });

  const result = await receipt;
  assert.deepEqual(observed.args, ['--path', fs.realpathSync(state.projectRoot)]);
  assert.equal(observed.executable, state.executable);
  assert.equal(observed.options.cwd, fs.realpathSync(state.projectRoot));
  assert.equal(observed.options.detached, true);
  assert.equal(observed.options.stdio, 'ignore');
  assert.equal(unrefCalled, true);
  assert.equal(result.operation, 'open');
  assert.equal(result.success, true);
  assert.equal(result.launched, true);
  assert.equal(result.editorReady, false);
  assert.equal(result.projectName, 'build-fixture');
  assert.equal(result.processId, 4321);
  assert.deepEqual(result.command, [state.executable, '--path', fs.realpathSync(state.projectRoot)]);
});

test('project open reports process launch errors and rejects a mismatched project before spawning', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  let spawnCalled = false;
  const failedChild = new EventEmitter();
  const failed = openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot }, {
    spawnImpl() {
      queueMicrotask(() => failedChild.emit('error', new Error('permission denied')));
      return failedChild;
    },
  });
  await assert.rejects(failed, (error) => error.code === 'CREATOR_OPEN_START_FAILED'
    && error.detail === 'permission denied');

  fs.writeFileSync(path.join(state.projectRoot, 'project.json'), JSON.stringify({ name: 'wrong-version', version: '3.8.7' }));
  await assert.rejects(openCreatorProject({ projectRoot: state.projectRoot, creatorPath: state.appRoot }, {
    spawnImpl() { spawnCalled = true; },
  }), (error) => error.code === 'PROJECT_CREATOR_VERSION_MISMATCH');
  assert.equal(spawnCalled, false);
});

test('Creator build-finished marker closes the spawned editor and returns success', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const outputPath = path.join(state.root, 'build-finished-output');
  let child;
  const result = await runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: outputPath, timeoutMs: 1000 }, {
    spawnImpl() {
      child = new FakeChild();
      child.kill = (signal) => {
        child.killed = true;
        queueMicrotask(() => child.emit('close', null, signal));
        return true;
      };
      queueMicrotask(() => {
        fs.mkdirSync(outputPath, { recursive: true });
        child.stdout.write('Builder: do custom process [build-');
        child.stdout.write('finished]\n');
      });
      return child;
    },
  });
  assert.equal(child.killed, true);
  assert.equal(result.builderFinished, true);
  assert.equal(result.timedOut, false);
  assert.equal(result.signal, 'SIGTERM');
  assert.equal(result.outputExists, true);
  assert.equal(result.success, true);
  assert.equal(result.failureCode, null);
});

test('Creator build failure survives bounded output truncation and takes precedence over finish', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const outputPath = path.join(state.root, 'failed-finished-output');
  const result = await runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: outputPath }, {
    spawnImpl() {
      const child = new FakeChild();
      queueMicrotask(() => {
        fs.mkdirSync(outputPath, { recursive: true });
        child.stderr.write(`Error: Build Failed: asset import failed\n${'x'.repeat(140 * 1024)}`);
        child.stdout.write('Builder: do custom process [build-finished]\n');
        child.emit('close', 0, null);
      });
      return child;
    },
  });
  assert.equal(result.builderFinished, false);
  assert.equal(result.success, false);
  assert.equal(result.failureCode, 'CREATOR_BUILD_REPORTED_FAILURE');
  assert.equal(result.failureReason, 'asset import failed');
});

test('Creator Builder reported failure overrides zero exit and partial output', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const outputPath = path.join(state.root, 'partial-build-output');
  const result = await runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: outputPath }, {
    spawnImpl() {
      const child = new FakeChild();
      queueMicrotask(() => {
        fs.mkdirSync(outputPath, { recursive: true });
        child.stdout.end('Start to build platform [web-mobile]');
        child.stderr.end('Error: Build Failed: Failed to find start scene in scene list.');
        child.emit('close', 0, null);
      });
      return child;
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.outputExists, true);
  assert.equal(result.success, false);
  assert.equal(result.failureCode, 'CREATOR_BUILD_REPORTED_FAILURE');
  assert.equal(result.failureReason, 'Failed to find start scene in scene list.');
});

test('Creator Builder reason stays primary when the process later times out', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const keepAlive = setInterval(() => {}, 1000);
  t.after(() => clearInterval(keepAlive));
  const result = await runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: path.join(state.root, 'timed-out-output'),
    timeoutMs: 1000 }, {
    spawnImpl() {
      const child = new FakeChild();
      child.kill = (signal) => {
        child.killed = true;
        queueMicrotask(() => child.emit('close', null, signal));
        return true;
      };
      queueMicrotask(() => child.stderr.write('Error: Build Failed: Failed to find start scene in scene list.'));
      return child;
    },
  });
  assert.equal(result.timedOut, true);
  assert.equal(result.success, false);
  assert.equal(result.failureCode, 'CREATOR_BUILD_REPORTED_FAILURE');
  assert.equal(result.failureReason, 'Failed to find start scene in scene list.');
});

test('Creator workflow refuses a Creator bundle with the wrong patch version', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(state.appRoot, 'Contents/Info.plist'),
    '<plist><dict><key>CFBundleShortVersionString</key><string>3.8.7</string></dict></plist>');
  assert.throws(() => resolveCreatorExecutable(state.appRoot), (error) => error.code === 'CREATOR_VERSION_MISMATCH');
});

test('native compile requires an existing output directory and native build auto-compile', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.root, { recursive: true, force: true }));
  const missingOutput = path.join(state.root, 'missing-build');
  const androidSdk = path.join(state.root, 'android-sdk');
  const javaHome = path.join(state.root, 'java-home');
  fs.mkdirSync(androidSdk);
  fs.mkdirSync(javaHome);
  const previousAndroidSdk = process.env.ANDROID_SDK_ROOT;
  const previousAndroidHome = process.env.ANDROID_HOME;
  const previousJavaHome = process.env.JAVA_HOME;
  process.env.ANDROID_SDK_ROOT = androidSdk;
  delete process.env.ANDROID_HOME;
  process.env.JAVA_HOME = javaHome;
  t.after(() => {
    if (previousAndroidSdk === undefined) delete process.env.ANDROID_SDK_ROOT;
    else process.env.ANDROID_SDK_ROOT = previousAndroidSdk;
    if (previousAndroidHome === undefined) delete process.env.ANDROID_HOME;
    else process.env.ANDROID_HOME = previousAndroidHome;
    if (previousJavaHome === undefined) delete process.env.JAVA_HOME;
    else process.env.JAVA_HOME = previousJavaHome;
  });
  await assert.rejects(runCreatorWorkflow({ operation: 'compile', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'android', buildPath: missingOutput }),
  (error) => error.code === 'NATIVE_BUILD_OUTPUT_INVALID');

  await assert.rejects(runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', autoCompile: true }),
  (error) => error.code === 'AUTO_COMPILE_NATIVE_BUILD_ONLY');
  await assert.rejects(runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', excludedModules: ['valid', 'valid'] }),
  (error) => error.code === 'BUILD_EXCLUDED_MODULES_INVALID');
  await assert.rejects(runCreatorWorkflow({ operation: 'compile', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'android', buildPath: missingOutput, excludedModules: ['physics-2d'] }),
  (error) => error.code === 'BUILD_MODULES_EXCLUDED_BUILD_ONLY');
});

test('project close invokes the exact live instance menu action and confirms its disconnect', async () => {
  const instanceId = '12345678-1234-4234-8234-123456789012';
  let inventoryReads = 0;
  let requestedProcessId = null;
  let now = 0;
  const result = await closeCreatorProject({ instanceId, timeoutMs: 1000 }, {
    platform: 'darwin',
    listInstancesImpl: async ({ start }) => {
      assert.equal(start, false);
      inventoryReads += 1;
      return { instances: [{ instanceId, projectName: 'TestProject', projectRoot: '/projects/TestProject',
        creatorVersion: '2.4.15', processId: 4321, connected: inventoryReads === 1 }] };
    },
    requestCloseImpl(processId) { requestedProcessId = processId; return { requested: true }; },
    nowImpl: () => now,
    sleepImpl: async (duration) => { now += duration; },
  });
  assert.equal(requestedProcessId, 4321);
  assert.equal(result.success, true);
  assert.equal(result.closed, true);
  assert.equal(result.projectRoot, '/projects/TestProject');
  assert.equal(result.closeRoute, 'file.open-project');
});

test('project close invokes the exact Windows Creator menu command for one PID and confirms disconnect', async () => {
  const instanceId = '12345678-1234-4234-8234-123456789012';
  let inventoryReads = 0;
  let requestedProcessId = null;
  let now = 0;
  const result = await closeCreatorProject({ instanceId, timeoutMs: 1000 }, {
    platform: 'win32',
    listInstancesImpl: async () => ({ instances: [{ instanceId, projectName: 'TestProject', projectRoot: 'C:\\projects\\TestProject',
      creatorVersion: '2.4.15', processId: 4321, connected: inventoryReads++ === 0 }] }),
    requestCloseImpl(processId) { requestedProcessId = processId; return { requested: true }; },
    nowImpl: () => now,
    sleepImpl: async (duration) => { now += duration; },
  });
  assert.equal(requestedProcessId, 4321);
  assert.equal(result.success, true);
  assert.equal(result.closed, true);
  assert.equal(result.closeRoute, 'file.open-project');
});

test('project close timeout reports the modal prompt and never force-kills Creator', async () => {
  const instanceId = '12345678-1234-4234-8234-123456789012';
  let now = 0;
  let closeRequests = 0;
  const result = await closeCreatorProject({ instanceId, timeoutMs: 1000 }, {
    platform: 'darwin',
    listInstancesImpl: async () => ({ instances: [{ instanceId, projectName: 'TestProject',
      projectRoot: '/projects/TestProject', creatorVersion: '2.4.15', processId: 4321, connected: true }] }),
    requestCloseImpl() { closeRequests += 1; return { requested: true }; },
    diagnoseModalImpl: (processId) => ({ status: 'detected', dialogCount: processId === 4321 ? 1 : 0 }),
    nowImpl: () => now,
    sleepImpl: async (duration) => { now += duration; },
  });
  assert.equal(closeRequests, 1);
  assert.equal(result.success, false);
  assert.equal(result.closed, false);
  assert.deepEqual(result.modalDiagnosis, { status: 'detected', dialogCount: 1 });
  assert.match(result.possibleBlocker, /save or close prompt/);
});

test('project close refuses unsupported platforms and disconnected instances before menu dispatch', async () => {
  let closeRequests = 0;
  await assert.rejects(closeCreatorProject({ instanceId: '12345678-1234-4234-8234-123456789012' }, {
    platform: 'linux', listInstancesImpl: async () => ({ instances: [] }),
    requestCloseImpl() { closeRequests += 1; },
  }), { code: 'CREATOR_CLOSE_PLATFORM_UNSUPPORTED' });
  await assert.rejects(closeCreatorProject({ instanceId: '12345678-1234-4234-8234-123456789012' }, {
    platform: 'darwin', listInstancesImpl: async () => ({ instances: [] }),
    requestCloseImpl() { closeRequests += 1; },
  }), { code: 'CREATOR_CLOSE_INSTANCE_NOT_CONNECTED' });
  assert.equal(closeRequests, 0);
});

test('project close requests only Creator’s normal Open Project menu item for the selected PID', () => {
  let invocation;
  const result = requestCreatorProjectClose(4321, { platform: 'darwin', spawnSyncImpl(command, args, options) {
    invocation = { command, args, options };
    return { status: 0, stdout: 'requested\n', stderr: '' };
  } });
  assert.deepEqual(result, { requested: true });
  assert.equal(invocation.command, '/usr/bin/osascript');
  assert.deepEqual(invocation.args.slice(0, 1), ['-e']);
  assert.equal(invocation.args.at(-1), '4321');
  assert.match(invocation.args[1], /whose unix id is targetPid/);
  assert.match(invocation.args[1], /Open Project\.\.\./);
  assert.match(invocation.args[1], /打开项目/);
  assert.match(invocation.args[1], /click menuItem/);
  assert.equal(invocation.options.timeout, 5000);
});

test('project close surfaces missing Accessibility permission without retrying another route', () => {
  let invocationCount = 0;
  assert.throws(() => requestCreatorProjectClose(4321, { platform: 'darwin', spawnSyncImpl() {
    invocationCount += 1;
    return { status: 1, stdout: '', stderr: 'Not authorized to send Apple events to System Events.' };
  } }), { code: 'CREATOR_CLOSE_ACCESSIBILITY_PERMISSION_REQUIRED' });
  assert.equal(invocationCount, 1);
});

test('Windows project close sends WM_COMMAND only for the exact Open Project menu item', () => {
  let invocation;
  const result = requestCreatorProjectClose(4321, { platform: 'win32', spawnSyncImpl(command, args, options) {
    invocation = { command, args, options };
    return { status: 0, stdout: 'requested\n', stderr: '' };
  } });
  assert.deepEqual(result, { requested: true });
  assert.equal(invocation.command, 'powershell.exe');
  assert.deepEqual(invocation.args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-EncodedCommand']);
  const script = Buffer.from(invocation.args[3], 'base64').toString('utf16le');
  assert.match(script, /RequestOpenProject\(4321u\)/);
  assert.match(script, /windowProcessId != targetProcessId/);
  assert.match(script, /IsFileMenu/);
  assert.match(script, /Open Project/);
  assert.match(script, /Regex\.Replace/);
  assert.match(script, /PostMessage\(window, WM_COMMAND/);
  assert.equal(invocation.options.timeout, 5000);
});
