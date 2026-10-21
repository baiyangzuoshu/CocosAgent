import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseTestShard, runTestPlan } from '../creator-tests.mjs';

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-test-options-'));
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
    suites: [{ id: 'node-suite', adapter: 'node', files }] }));
  return { directory, projectRoot };
}

test('test shard syntax and bounds are validated', () => {
  assert.deepEqual(parseTestShard('2/4'), { index: 2, total: 4 });
  for (const value of ['0/2', '3/2', '1/0', '1/65', '1 / 2', 'abc'])
    assert.throws(() => parseTestShard(value), (error) => error.code === 'TEST_SHARD_INVALID');
  assert.equal(parseTestShard(undefined), undefined);
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
