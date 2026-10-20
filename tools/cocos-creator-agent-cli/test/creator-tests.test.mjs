import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTestPlan, runTestPlan, selectTestSuites, watchTestPlan } from '../creator-tests.mjs';
import harness from '../testing/creator-test-harness.cjs';

function fixture(t, suites) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-test-runner-')));
  const projectRoot = path.join(root, 'project');
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'tests'));
  fs.mkdirSync(path.join(projectRoot, 'assets'));
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'runner-fixture', version: '2.4.15' }));
  const manifest = { schemaVersion: 1, suites: suites || [{ id: 'logic', adapter: 'node', files: ['tests/logic.test.cjs'], dependsOn: ['assets/'] }] };
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent/tests.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(projectRoot, 'tests/logic.test.cjs'), "const test = require('node:test'); const assert = require('node:assert/strict'); test('movement', () => assert.equal(2 + 2, 4));\n");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, projectRoot, manifest, reportDir: path.join(root, 'report') };
}

test('project runner executes real Node tests and writes JSON/JUnit for passing, failing and skipped cases', async (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.projectRoot, 'tests/logic.test.cjs'), [
    "const test = require('node:test'); const assert = require('node:assert/strict');",
    "test('movement', () => assert.equal(2 + 2, 4));",
    "test('collision <target>', () => assert.equal(1, 2));",
    "test.skip('not configured', () => {});",
  ].join('\n'));
  const report = await runTestPlan(state);
  assert.equal(report.passed, false);
  assert.deepEqual(report.counts, { total: 3, passed: 1, failed: 1, skipped: 1 }, JSON.stringify(report.suites));
  assert.equal(JSON.parse(fs.readFileSync(report.artifacts.json)).manifestHash, loadTestPlan(state.projectRoot).manifestHash);
  const xml = fs.readFileSync(report.artifacts.junit, 'utf8');
  assert.match(xml, /collision &lt;target&gt;/);
  assert.match(xml, /failures="1"/);
  assert.ok(report.suites[0].sourceHashes['tests/logic.test.cjs']);
});

test('real child process timeout is a failed report and existing report directories are preserved', async (t) => {
  const state = fixture(t, [{ id: 'hang', adapter: 'node', files: ['tests/logic.test.cjs'], timeoutMs: 300 }]);
  fs.writeFileSync(path.join(state.projectRoot, 'tests/logic.test.cjs'), "require('node:test')('hang', async () => { await new Promise(r => setTimeout(r, 10000)); });");
  const report = await runTestPlan(state);
  assert.equal(report.passed, false);
  assert.ok(report.suites[0].tests.some((item) => item.name === 'TEST_TIMEOUT'));
  const before = fs.readFileSync(report.artifacts.json);
  await assert.rejects(runTestPlan(state), { code: 'EEXIST' });
  assert.deepEqual(fs.readFileSync(report.artifacts.json), before);
});

test('manifest rejects executable escape paths and unknown suite selection before invoking project code', async (t) => {
  const state = fixture(t);
  const file = path.join(state.projectRoot, 'tests/logic.test.cjs');
  fs.rmSync(file);
  fs.symlinkSync(path.join(state.root, 'outside.cjs'), file);
  fs.writeFileSync(path.join(state.root, 'outside.cjs'), 'throw new Error("should not execute");');
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_PATH_SYMLINK' });
  fs.rmSync(file);
  fs.writeFileSync(file, "require('node:test')('pass',()=>{});");
  assert.throws(() => selectTestSuites(loadTestPlan(state.projectRoot), { suiteIds: ['missing'] }), { code: 'TEST_SUITE_NOT_FOUND' });
  assert.deepEqual(selectTestSuites(loadTestPlan(state.projectRoot), { changedPaths: ['README.md'] }), []);
  assert.equal(selectTestSuites(loadTestPlan(state.projectRoot), { changedPaths: ['assets/Player.ts'] }).length, 1);
});

test('Creator adapter requires the exact live project and an approved control command, then validates the actual receipt', async (t) => {
  const state = fixture(t, [{ id: 'editor', adapter: 'creator', providerId: 'project-tests', commandId: 'run-tests' }]);
  const instanceId = 'instance';
  const dependencies = {
    listInstances: async () => ({ instances: [{ instanceId, projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
    getExtensionCommands: async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available',
      access: 'control', approval: true, providerFingerprint: 'expected' }] }),
    callExtensionCommand: async (_id, _provider, _command, _input, options) => {
      assert.equal(options.expectedFingerprint, 'expected');
      return { result: { result: await harness.runTests([{ id: 'editor-context', run: () => assert.equal(4, 4) }]) } };
    },
  };
  const report = await runTestPlan({ ...state, instanceId }, dependencies);
  assert.equal(report.passed, true);
  dependencies.listInstances = async () => ({ instances: [{ instanceId, projectRoot: state.root, creatorVersion: '2.4.15' }] });
  await assert.rejects(runTestPlan({ ...state, instanceId, reportDir: path.join(state.root, 'wrong') }, dependencies), { code: 'TEST_CREATOR_IDENTITY_MISMATCH' });
  dependencies.listInstances = async () => ({ instances: [{ instanceId, projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] });
  dependencies.getExtensionCommands = async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available', access: 'read' }] });
  dependencies.callExtensionCommand = async () => { throw new Error('must not invoke unapproved runner'); };
  const refused = await runTestPlan({ ...state, instanceId, reportDir: path.join(state.root, 'refused') }, dependencies);
  assert.equal(refused.suites[0].error, 'TEST_PROVIDER_APPROVAL_REQUIRED');
});

test('empty Creator reports fail and timed-out Creator cases do not start later project code', async (t) => {
  const state = fixture(t, [{ id: 'editor', adapter: 'creator', providerId: 'project-tests', commandId: 'run-tests' }]);
  let laterRan = false;
  const timedOut = await harness.runTests([
    { id: 'hang', run: () => new Promise(() => {}) },
    { id: 'later', run: () => { laterRan = true; } },
  ], { timeoutMs: 10 });
  assert.equal(laterRan, false);
  assert.equal(timedOut.requiresManualReview, true);
  assert.equal(timedOut.tests[1].status, 'skipped');
  const report = await runTestPlan({ ...state, instanceId: 'instance' }, {
    listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
    getExtensionCommands: async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available', access: 'control', approval: true }] }),
    callExtensionCommand: async () => ({ result: { result: { schemaVersion: 1, tests: [] } } }),
  });
  assert.equal(report.passed, false);
  assert.equal(report.suites[0].error, 'TEST_NO_EXECUTED_CASES');
});

test('preview adapter refreshes and tests the same session using real pass field from bridge contract', async (t) => {
  const state = fixture(t, [{ id: 'runtime', adapter: 'preview', input: { assertions: [{ type: 'no-errors' }] } }]);
  const calls = [];
  const report = await runTestPlan({ ...state, instanceId: 'instance', previewSessionId: 'same-session', refreshPreview: true }, {
    listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
    callCommand: async (_id, command, input) => {
      calls.push(command);
      assert.equal(input.previewSessionId, 'same-session');
      return { result: { assertions: [{ type: 'no-errors', pass: true }], passed: true } };
    },
  });
  assert.equal(report.passed, true);
  assert.deepEqual(calls, ['creator.preview.refresh', 'creator.preview.interact']);
});

test('watch observes new directory files and reruns only affected suites, with a report for each run', async (t) => {
  const state = fixture(t);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  t.after(() => clearTimeout(timer));
  const reports = [];
  const changes = [];
  await watchTestPlan({ projectRoot: state.projectRoot, paths: ['assets'], affected: true, intervalMs: 250,
    reportDir: path.join(state.root, 'watch-reports') }, { signal: controller.signal, onEvent(event) {
    if (event.type === 'test-run-finished') {
      reports.push(event.report);
      if (event.trigger === 'initial') fs.writeFileSync(path.join(state.projectRoot, 'assets/Player.js'), 'module.exports = 1;');
      else {
        changes.push(event.changedPaths);
        if (changes.length === 1) fs.renameSync(path.join(state.projectRoot, 'assets/Player.js'), path.join(state.projectRoot, 'assets/Tank.js'));
        else if (changes.length === 2) fs.rmSync(path.join(state.projectRoot, 'assets/Tank.js'));
        else controller.abort();
      }
    }
  } });
  assert.equal(reports.length, 4);
  assert.deepEqual(changes, [['assets/Player.js'], ['assets/Player.js', 'assets/Tank.js'], ['assets/Tank.js']]);
  assert.ok(reports.every((report) => report.passed));
  assert.notEqual(reports[0].artifacts.json, reports[1].artifacts.json);
  assert.ok(reports.every((report) => fs.existsSync(report.artifacts.junit)));
});

test('interrupted Creator provider execution stops watch without automatically replaying it', async (t) => {
  const state = fixture(t, [{ id: 'editor', adapter: 'creator', providerId: 'project-tests', commandId: 'run-tests' }]);
  let invocations = 0;
  const result = await watchTestPlan({ projectRoot: state.projectRoot, paths: ['assets'], instanceId: 'instance',
    reportDir: path.join(state.root, 'watch-reports') }, {
    listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
    getExtensionCommands: async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available', access: 'control', approval: true }] }),
    callExtensionCommand: async () => { invocations += 1; throw new Error('BRIDGE_REQUEST_TIMEOUT'); },
  });
  assert.equal(invocations, 1);
  assert.equal(result.requiresManualReview, true);
  assert.equal(result.lastTestPassed, false);
});

test('cancellation kills a running Node suite and records a failed cancelled run', async (t) => {
  const state = fixture(t);
  fs.writeFileSync(path.join(state.projectRoot, 'tests/logic.test.cjs'), "require('node:test')('hang', async () => new Promise(r => setTimeout(r, 10000)));");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150);
  t.after(() => clearTimeout(timer));
  const result = await runTestPlan({ ...state, signal: controller.signal });
  assert.equal(result.cancelled, true);
  assert.equal(result.passed, false);
  assert.ok(result.suites[0].tests.some((item) => item.name === 'TEST_CANCELLED'));
  fs.writeFileSync(path.join(state.projectRoot, 'tests/logic.test.cjs'), "require('node:test')('pass',()=>{});");
  const atBoundary = new AbortController();
  const cancelled = await runTestPlan({ ...state, reportDir: path.join(state.root, 'boundary-report'), signal: atBoundary.signal,
    onEvent(event) { if (event.type === 'test-suite-finished') atBoundary.abort(); } });
  assert.equal(cancelled.passed, false);
  assert.equal(cancelled.counts.failed, 1);
  assert.match(fs.readFileSync(cancelled.artifacts.junit, 'utf8'), /TEST_CANCELLED/);
});
