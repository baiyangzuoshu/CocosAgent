import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTestPlan, runTestPlan, testShardForCase, watchTestPlan } from '../creator-tests.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function fixture(t, scriptPath = 'packages/sample/editor-scripts/suite.js') {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-editor-tests-')));
  const projectRoot = path.join(directory, 'project');
  const scriptFile = path.join(projectRoot, scriptPath);
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'editor-test-fixture', version: '2.4.15' }));
  fs.writeFileSync(scriptFile, "return { schemaVersion: 1, tests: [{ id: 'project-path', name: 'Editor project path', status: Editor.Project.path ? 'passed' : 'failed' }] };\n");
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent', 'tests.json'), JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'editor-suite', adapter: 'editor', scriptPath, input: { sample: true } },
  ] }));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { directory, projectRoot, scriptPath, scriptFile };
}

function editorDependencies(state, { commit } = {}) {
  const instanceId = 'creator-instance';
  const sourceSha256 = sha256(fs.readFileSync(state.scriptFile));
  const operationId = '123e4567-e89b-42d3-a456-426614174000';
  const planHash = 'a'.repeat(64);
  const calls = [];
  let plannedInput = {};
  return {
    calls,
    instanceId,
    dependencies: {
      listInstances: async () => ({ instances: [{ instanceId, projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
      callCommand: async (_instanceId, command, input) => {
        calls.push({ command, input });
        assert.equal(_instanceId, instanceId);
        if (command === 'creator.editor.eval-file.plan') {
          plannedInput = input.input || {};
          return { result: {
          status: 'planned', mode: 'file', projectRoot: state.projectRoot, creatorVersion: '2.4.15',
          creatorInstanceId: instanceId, scriptPath: state.scriptPath, operationId, planHash, sourceSha256,
          input: plannedInput, inputSha256: sha256(Buffer.from(JSON.stringify(plannedInput))),
        } };
        }
        assert.equal(command, 'creator.editor.eval-file.commit');
        if (commit) return commit(plannedInput);
        return { result: { status: 'completed', mode: 'file', projectRoot: state.projectRoot,
          creatorVersion: '2.4.15', creatorInstanceId: instanceId, scriptPath: state.scriptPath,
          operationId, sourceSha256, inputSha256: sha256(Buffer.from(JSON.stringify(plannedInput))),
          startedAt: '2026-10-22T00:00:00.000Z',
          completedAt: '2026-10-22T00:00:01.000Z', manualReviewRequired: false,
          result: { schemaVersion: 1, tests: [{ id: 'project-path', name: 'Editor project path', status: 'passed' }] },
        } };
      },
    },
  };
}

test('Editor suite executes the hash-bound script only after an exact native-approved commit request', async (t) => {
  const state = fixture(t);
  const mock = editorDependencies(state);
  const report = await runTestPlan({ projectRoot: state.projectRoot, instanceId: mock.instanceId,
    reportDir: path.join(state.directory, 'report') }, mock.dependencies);

  assert.equal(report.passed, true);
  assert.deepEqual(mock.calls.map(({ command }) => command), [
    'creator.editor.eval-file.plan', 'creator.editor.eval-file.commit',
  ]);
  assert.deepEqual(mock.calls[0].input, { scriptPath: state.scriptPath, input: { sample: true } });
  assert.deepEqual(mock.calls[1].input, {
    operationId: '123e4567-e89b-42d3-a456-426614174000', planHash: 'a'.repeat(64),
  });
  assert.equal(report.suites[0].sourceHashes[state.scriptPath], sha256(fs.readFileSync(state.scriptFile)));
  assert.equal(report.suites[0].receipt.startedAt, '2026-10-22T00:00:00.000Z');
});

test('Editor suites reject paths outside editor-scripts, symlinks and coverage requests', async (t) => {
  const state = fixture(t);
  const manifestPath = path.join(state.projectRoot, '.cocos-agent', 'tests.json');
  const writeManifest = (scriptPath) => fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'editor-suite', adapter: 'editor', scriptPath },
  ] }));

  writeManifest('packages/sample/scripts/suite.js');
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_EDITOR_SCRIPT_PATH_INVALID' });
  const linkedPath = 'packages/sample/editor-scripts/linked.js';
  fs.symlinkSync(state.scriptFile, path.join(state.projectRoot, linkedPath));
  writeManifest(linkedPath);
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_PATH_SYMLINK' });

  writeManifest(state.scriptPath);
  await assert.rejects(runTestPlan({ projectRoot: state.projectRoot, suiteIds: ['editor-suite'], coverage: true,
    instanceId: 'creator-instance', reportDir: path.join(state.directory, 'coverage-report') }),
  { code: 'TEST_COVERAGE_EDITOR_SCRIPT_UNSUPPORTED' });

  fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'editor-suite', adapter: 'editor', scriptPath: state.scriptPath, testIds: ['same', 'same'] },
  ] }));
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_EDITOR_CASE_IDS_INVALID' });
  fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'editor-suite', adapter: 'editor', scriptPath: state.scriptPath, input: { __cocosAgentTest: {} } },
  ] }));
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_EDITOR_RUNNER_INPUT_RESERVED' });
});

test('Editor case manifests shard deterministically and require every assigned case in the approved result', async (t) => {
  const state = fixture(t);
  const caseIds = ['scene-open', 'asset-query', 'selection-check', 'project-version'];
  const manifestPath = path.join(state.projectRoot, '.cocos-agent', 'tests.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'editor-suite', adapter: 'editor', scriptPath: state.scriptPath, testIds: caseIds },
  ] }));
  const assignments = [];

  for (let index = 1; index <= 3; index += 1) {
    const assigned = caseIds.filter((id) => testShardForCase('editor-suite', id, 3) === index);
    const mock = editorDependencies(state, { commit(input) {
      assert.deepEqual(input.__cocosAgentTest, { selectedCaseIds: assigned,
        shard: { index, total: 3 } });
      return { result: { status: 'completed', mode: 'file', projectRoot: state.projectRoot,
        creatorVersion: '2.4.15', creatorInstanceId: 'creator-instance', scriptPath: state.scriptPath,
        operationId: '123e4567-e89b-42d3-a456-426614174000', sourceSha256: sha256(fs.readFileSync(state.scriptFile)),
        inputSha256: sha256(Buffer.from(JSON.stringify(input))), startedAt: '2026-10-22T00:00:00.000Z',
        completedAt: '2026-10-22T00:00:01.000Z', manualReviewRequired: false,
        result: { schemaVersion: 1, tests: assigned.map((id) => ({ id, name: id, status: 'passed' })) } } };
    } });
    const report = await runTestPlan({ projectRoot: state.projectRoot, instanceId: mock.instanceId,
      shard: { index, total: 3 }, reportDir: path.join(state.directory, `shard-${index}`) }, mock.dependencies);
    assert.equal(report.passed, true);
    assert.deepEqual(report.selectedCaseIdsBySuite['editor-suite'], assigned);
    assignments.push(...assigned);
  }
  assert.deepEqual(assignments.sort(), [...caseIds].sort());

  const mock = editorDependencies(state, { commit(input) {
    const assigned = input.__cocosAgentTest.selectedCaseIds;
    return { result: { status: 'completed', mode: 'file', projectRoot: state.projectRoot,
      creatorVersion: '2.4.15', creatorInstanceId: 'creator-instance', scriptPath: state.scriptPath,
      operationId: '123e4567-e89b-42d3-a456-426614174000', sourceSha256: sha256(fs.readFileSync(state.scriptFile)),
      inputSha256: sha256(Buffer.from(JSON.stringify(input))), startedAt: '2026-10-22T00:00:00.000Z',
      completedAt: '2026-10-22T00:00:01.000Z', manualReviewRequired: false,
      result: { schemaVersion: 1, tests: assigned.slice(1).map((id) => ({ id, name: id, status: 'passed' })) } } };
  } });
  const mismatched = await runTestPlan({ projectRoot: state.projectRoot, instanceId: mock.instanceId,
    shard: { index: 1, total: 2 }, reportDir: path.join(state.directory, 'mismatched') }, mock.dependencies);
  assert.equal(mismatched.passed, false);
  assert.equal(mismatched.suites[0].error, 'TEST_EDITOR_CASE_RESULTS_MISMATCH');
});

test('an uncertain Editor script call requires manual review and watch never replays it', async (t) => {
  const state = fixture(t);
  let commits = 0;
  const mock = editorDependencies(state, { commit() {
    commits += 1;
    throw Object.assign(new Error('bridge timeout after dispatch'), { code: 'BRIDGE_REQUEST_TIMEOUT' });
  } });
  const result = await watchTestPlan({ projectRoot: state.projectRoot, paths: ['packages'], instanceId: mock.instanceId,
    intervalMs: 250, reportDir: path.join(state.directory, 'watch-reports') }, mock.dependencies);

  assert.equal(commits, 1);
  assert.equal(mock.calls.filter(({ command }) => command === 'creator.editor.eval-file.plan').length, 1);
  assert.equal(result.requiresManualReview, true);
  assert.equal(result.lastTestPassed, false);
});
