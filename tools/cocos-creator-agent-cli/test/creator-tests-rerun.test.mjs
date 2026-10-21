import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadFailedSuiteIds, loadTestPlan } from '../creator-tests.mjs';

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-test-rerun-'));
  const projectRoot = path.join(directory, 'project');
  fs.mkdirSync(path.join(projectRoot, '.cocos-agent'), { recursive: true });
  fs.mkdirSync(path.join(projectRoot, 'test'));
  fs.writeFileSync(path.join(projectRoot, 'project.json'), JSON.stringify({ name: 'rerun-fixture', version: '2.4.15' }));
  fs.writeFileSync(path.join(projectRoot, '.cocos-agent', 'tests.json'), JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'unit-one', adapter: 'node', files: ['test/one.test.js'] },
    { id: 'unit-two', adapter: 'node', files: ['test/two.test.js'] },
  ] }));
  fs.writeFileSync(path.join(projectRoot, 'test', 'one.test.js'), '');
  fs.writeFileSync(path.join(projectRoot, 'test', 'two.test.js'), '');
  return { directory, projectRoot, reportPath: path.join(directory, 'previous-results.json') };
}

test('rerun-failed selects only failed suites from a matching project and manifest', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const plan = loadTestPlan(state.projectRoot);
  fs.writeFileSync(state.reportPath, JSON.stringify({ schemaVersion: 1, projectRoot: plan.projectRoot,
    manifestHash: plan.manifestHash, suites: [
      { id: 'unit-one', counts: { failed: 0 }, tests: [{ status: 'passed' }] },
      { id: 'unit-two', counts: { failed: 1 }, tests: [{ status: 'failed' }] },
    ] }));
  assert.deepEqual(loadFailedSuiteIds(state.projectRoot, state.reportPath), ['unit-two']);
});

test('rerun-failed rejects an older result after the test manifest changes', (t) => {
  const state = fixture();
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  const plan = loadTestPlan(state.projectRoot);
  fs.writeFileSync(state.reportPath, JSON.stringify({ schemaVersion: 1, projectRoot: plan.projectRoot,
    manifestHash: plan.manifestHash, suites: [{ id: 'unit-one', counts: { failed: 1 }, tests: [] }] }));
  fs.writeFileSync(path.join(state.projectRoot, '.cocos-agent', 'tests.json'), JSON.stringify({ schemaVersion: 1, suites: [
    { id: 'unit-one', adapter: 'node', files: ['test/one.test.js'] },
    { id: 'unit-two', adapter: 'node', files: ['test/two.test.js'], dependsOn: ['assets/changed'] },
  ] }));
  assert.throws(() => loadFailedSuiteIds(state.projectRoot, state.reportPath), (error) => error.code === 'TEST_REPORT_STALE_OR_MISMATCHED');
});

test('rerun-failed refuses a symlinked results file', (t) => {
  const state = fixture();
  const actual = path.join(state.directory, 'actual.json');
  fs.writeFileSync(actual, '{}');
  fs.symlinkSync(actual, state.reportPath);
  t.after(() => fs.rmSync(state.directory, { recursive: true, force: true }));
  assert.throws(() => loadFailedSuiteIds(state.projectRoot, state.reportPath), (error) => error.code === 'TEST_REPORT_FILE_INVALID');
});
