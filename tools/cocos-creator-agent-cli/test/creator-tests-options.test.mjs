import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadTestPlan, parseTestShard, runTestPlan, testShardForCase, testShardForSuite } from '../creator-tests.mjs';
import creatorTestHarness from '../testing/creator-test-harness.cjs';

function fixture(suites) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-test-options-')));
  const projectRoot = path.join(directory, 'project');
  const testsRoot = path.join(projectRoot, 'test');
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.mkdirSync(testsRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'test-options-fixture', version: '2.4.15' }));
  const files = [];
  for (let index = 0; index < 4; index += 1) {
    const relative = `test/case-${index}.test.js`;
    files.push(relative);
    fs.writeFileSync(path.join(projectRoot, relative), `import test from 'node:test';\ntest('case-${index}', () => {});\n`);
  }
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent', 'tests.json'), JSON.stringify({ schemaVersion: 1,
    suites: suites || [{ id: 'node-suite', adapter: 'node', files }] }));
  return { directory, projectRoot };
}

test('test shard syntax and bounds are validated', () => {
  assert.deepEqual(parseTestShard('2/4'), { index: 2, total: 4 });
  for (const value of ['0/2', '3/2', '1/0', '1/65', '1 / 2', 'abc'])
    assert.throws(() => parseTestShard(value), (error) => error.code === 'TEST_SHARD_INVALID');
  assert.equal(parseTestShard(undefined), undefined);
});

test('preview suites must declare actions and assertions without runner-owned fields', (t) => {
  const state = fixture([{ id: 'runtime', adapter: 'preview', input: { assertions: [{ type: 'no-errors' }] } }]);
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_PREVIEW_ACTIONS_REQUIRED' });
  fs.writeFileSync(path.join(state.projectRoot, '.cocos-agent', 'tests.json'), JSON.stringify({ schemaVersion: 1,
    suites: [{ id: 'runtime', adapter: 'preview', input: {
      actions: [{ type: 'key', key: 'Space' }], assertions: [{ type: 'no-errors' }], coverage: true } }] }));
  assert.throws(() => loadTestPlan(state.projectRoot), { code: 'TEST_PREVIEW_RUNNER_FIELD_RESERVED' });
});

test('Node test sharding splits project test files into disjoint reports', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const reports = [];
  for (const index of [1, 2]) {
    reports.push(await runTestPlan({ projectRoot: state.projectRoot, shard: { index, total: 2 },
      reportDir: path.join(state.directory, `reports-${index}`) }));
  }
  assert.deepEqual(reports.map((report) => report.shard.index), [1, 2]);
  const shardFiles = reports.map((report) => report.suites[0].tests.map((item) => item.file));
  assert.equal(shardFiles[0].length, 2);
  assert.equal(shardFiles[1].length, 2);
  assert.equal(new Set([...shardFiles[0], ...shardFiles[1]]).size, 4);
  assert.equal(shardFiles[0].some((file) => shardFiles[1].includes(file)), false);
  assert.ok(reports.every((report) => report.passed));
});

test('Node coverage is included as structured per-suite evidence', async (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const report = await runTestPlan({ projectRoot: state.projectRoot, suiteIds: ['node-suite'], coverage: true,
    reportDir: path.join(state.directory, 'coverage-report') });
  const coverage = report.suites[0].coverage;
  assert.ok(coverage);
  assert.ok(coverage.totals.totalLineCount > 0);
  assert.ok(coverage.files.some((file) => file.path.endsWith('case-0.test.js')));
});

test('Creator provider and preview suites are assigned to deterministic engine shards', async (t) => {
  const editorId = 'editor-suite';
  let previewId = 'preview-suite';
  while (testShardForSuite(editorId, 2) === testShardForSuite(previewId, 2)) previewId += '-next';
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(state.projectRoot, '.cocos-agent', 'tests.json'), JSON.stringify({ schemaVersion: 1, suites: [
    { id: editorId, adapter: 'creator', providerId: 'project-tests', commandId: 'run-tests' },
    { id: previewId, adapter: 'preview', input: { actions: [{ type: 'key', key: 'Space' }], assertions: [{ type: 'no-errors' }] } },
  ] }));
  const shardReports = [];
  for (const index of [1, 2]) {
    shardReports.push(await runTestPlan({ projectRoot: state.projectRoot, instanceId: 'instance',
      previewSessionId: 'same-session', shard: { index, total: 2 }, reportDir: path.join(state.directory, `engine-${index}`) }, {
      listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
      getExtensionCommands: async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available',
        access: 'control', approval: true, providerFingerprint: 'fingerprint' }] }),
      callExtensionCommand: async () => ({ result: { result: { schemaVersion: 1,
        tests: [{ id: 'editor-case', name: 'editor case', status: 'passed' }] } } }),
      callCommand: async () => ({ result: { assertions: [{ type: 'no-errors', pass: true }], passed: true } }),
    }));
  }
  const selectedByShard = shardReports.map((report) => report.shardSelectedSuiteIds);
  assert.deepEqual(selectedByShard, [[editorId], [previewId]].sort((left, right) => testShardForSuite(left[0], 2) - testShardForSuite(right[0], 2)));
  assert.equal(new Set(selectedByShard.flat()).size, 2);
  assert.ok(shardReports.every((report) => report.passed));
  assert.ok(shardReports.every((report) => report.shard.strategies.creator === 'test-case-when-manifested-otherwise-suite'
    && report.shard.strategies.preview === 'suite'));
});

test('Creator Provider test IDs shard into disjoint approved engine test batches', async (t) => {
  const suiteId = 'editor-cases';
  const caseIds = [];
  const shardIndexes = new Set();
  for (let index = 0; shardIndexes.size < 2 && index < 64; index += 1) {
    const id = `case-${index}`;
    caseIds.push(id);
    shardIndexes.add(testShardForCase(suiteId, id, 2));
  }
  const state = fixture([{ id: suiteId, adapter: 'creator', providerId: 'project-tests', commandId: 'run-tests', testIds: caseIds }]);
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const selectedPerShard = [];
  const reports = [];
  for (const index of [1, 2]) {
    reports.push(await runTestPlan({ projectRoot: state.projectRoot, instanceId: 'instance', shard: { index, total: 2 },
      reportDir: path.join(state.directory, `provider-shard-${index}`) }, {
      listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
      getExtensionCommands: async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available',
        access: 'control', approval: true, providerFingerprint: 'fingerprint', input: {
          type: 'object', required: ['testIds'], properties: { testIds: {
            type: 'array', minItems: 1, maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 128 },
          } }, additionalProperties: false,
        } }] }),
      callExtensionCommand: async (_instance, _provider, _command, input) => {
        selectedPerShard.push(input.testIds);
        const cases = caseIds.map((id) => ({ id, run: () => assert.ok(input.testIds.includes(id)) }));
        return { result: { result: await creatorTestHarness.runTests(cases, { ids: input.testIds }) } };
      },
    }));
  }
  const assigned = selectedPerShard.flat();
  assert.deepEqual(assigned.slice().sort(), caseIds.slice().sort());
  assert.equal(new Set(assigned).size, caseIds.length);
  assert.ok(reports.every((report) => report.passed), JSON.stringify(reports.map((report) => report.suites)));
  assert.ok(reports.every((report) => report.shard.strategies.creator === 'test-case-when-manifested-otherwise-suite'));
  assert.deepEqual(reports.map((report) => report.selectedCaseIdsBySuite[suiteId]), selectedPerShard);
});

test('Creator Provider shard fails when its approved receipt omits or invents selected case IDs', async (t) => {
  const state = fixture([{ id: 'editor-cases', adapter: 'creator', providerId: 'project-tests', commandId: 'run-tests',
    testIds: ['case-a', 'case-b'] }]);
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const report = await runTestPlan({ projectRoot: state.projectRoot, instanceId: 'instance',
    reportDir: path.join(state.directory, 'invalid-provider-report') }, {
    listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
    getExtensionCommands: async () => ({ commands: [{ providerId: 'project-tests', id: 'run-tests', status: 'available',
      access: 'control', approval: true, providerFingerprint: 'fingerprint', input: {
        type: 'object', required: ['testIds'], properties: { testIds: {
          type: 'array', minItems: 1, maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 128 },
        } }, additionalProperties: false,
      } }] }),
    callExtensionCommand: async () => ({ result: { result: { schemaVersion: 1,
      tests: [{ id: 'not-selected', name: 'wrong case', status: 'passed' }] } } }),
  });
  assert.equal(report.passed, false);
  assert.equal(report.suites[0].error, 'TEST_PROVIDER_CASE_RESULTS_MISMATCH');
});

test('preview coverage is requested through the same runtime test invocation', async (t) => {
  const state = fixture([{ id: 'runtime', adapter: 'preview', input: {
    actions: [{ type: 'key', key: 'Space' }], assertions: [{ type: 'no-errors' }] } }]);
  let observedCoverageRequest = false;
  const expectedCoverage = { kind: 'v8-precise-function-and-range', scripts: [], totals: {
    totalFunctions: 0, coveredFunctions: 0, totalRanges: 0, coveredRanges: 0, functionPercent: 0, rangePercent: 0 } };
  const report = await runTestPlan({ ...state, instanceId: 'instance', previewSessionId: 'same-session', coverage: true,
    reportDir: path.join(state.directory, 'preview-coverage-report') }, {
    listInstances: async () => ({ instances: [{ instanceId: 'instance', projectRoot: state.projectRoot, creatorVersion: '2.4.15' }] }),
    callCommand: async (_id, _command, input) => {
      observedCoverageRequest = input.coverage === true;
      return { result: { assertions: [{ type: 'no-errors', pass: true }], passed: true, coverage: expectedCoverage } };
    },
  });
  assert.equal(observedCoverageRequest, true);
  assert.deepEqual(report.suites[0].coverage, expectedCoverage);
  assert.equal(report.passed, true);
});
