import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { resolveCreatorExecutable, runCreatorWorkflow } from '../creator-workflows.mjs';

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
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: outputPath, debug: true }, {
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
  assert.equal(result.creatorVersion, '2.4.15');
  assert.equal(result.platform, 'web-mobile');
  assert.ok(observedArgs.includes('--build'));
  assert.ok(observedArgs.at(-1).includes(`buildPath=${fs.realpathSync(path.dirname(outputPath))}/${path.basename(outputPath)}`));
  assert.ok(observedArgs.at(-1).includes('debug=true'));
  await assert.rejects(runCreatorWorkflow({ operation: 'build', projectRoot: state.projectRoot,
    creatorPath: state.appRoot, platform: 'web-mobile', buildPath: path.join(state.projectRoot, 'build') }),
  (error) => error.code === 'BUILD_PATH_MUST_BE_OUTSIDE_PROJECT');
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
});
