import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { previewTestExpression } from '../bridge/runtime-preview.mjs';
import { createPreviewTestHarness, readPreviewTestSource } from '../bridge/preview-test-script.mjs';

test('preview test harness runs only selected cases and authenticates immutable reports', async () => {
  const harness = createPreviewTestHarness(['loads-scene', 'fails-check'], 1000, 64 * 1024);
  const report = await harness.run([
    { id: 'loads-scene', name: 'Loads scene', run: () => harness.assert(true) },
    { id: 'fails-check', run: () => harness.assert(false, 'expected failure') },
    { id: 'not-selected', run: () => assert.fail('unselected case must not run') },
  ]);
  assert.equal(harness.isReport(report), true);
  assert.equal(Object.isFrozen(report), true);
  assert.deepEqual(report.tests.map((item) => [item.id, item.status]), [
    ['loads-scene', 'passed'], ['fails-check', 'failed'],
  ]);
  assert.equal(harness.isReport({ ...report }), false);
  await assert.rejects(harness.run([{ id: 'loads-scene', run: () => {} }]), /PREVIEW_TEST_RUNNER_ALREADY_USED/);
});

test('preview test timeouts stop later cases and require manual review', async () => {
  let laterRan = false;
  const harness = createPreviewTestHarness(['hangs', 'later'], 1000, 64 * 1024);
  const report = await harness.run([
    { id: 'hangs', run: () => new Promise(() => {}) },
    { id: 'later', run: () => { laterRan = true; } },
  ], { timeoutMs: 10 });
  assert.equal(report.requiresManualReview, true);
  assert.equal(report.tests[0].status, 'failed');
  assert.equal(report.tests[1].status, 'skipped');
  assert.equal(laterRan, false);
});

test('preview test source reader is limited to regular files in the project test directory', (t) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-preview-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, '.cocos-agent', 'preview-tests');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'runtime.js'), 'return CreatorTest.run([]);');
  assert.equal(readPreviewTestSource(root, '.cocos-agent/preview-tests/runtime.js').source,
    'return CreatorTest.run([]);');
  assert.throws(() => readPreviewTestSource(root, '../runtime.js'), { code: 'PREVIEW_TEST_SCRIPT_PATH_INVALID' });
  fs.symlinkSync(path.join(directory, 'runtime.js'), path.join(directory, 'linked.js'));
  assert.throws(() => readPreviewTestSource(root, '.cocos-agent/preview-tests/linked.js'), { code: 'PREVIEW_TEST_SCRIPT_SYMLINK' });
});

test('preview runtime expression passes cc and JSON input into the authenticated CreatorTest harness', async () => {
  const expression = previewTestExpression(`return CreatorTest.run([{
    id: 'scene-loaded',
    run: ({ cc, input }) => CreatorTest.assert(cc.scene === input.expectedScene),
  }]);`, { expectedScene: 'Main' }, ['scene-loaded'], 1000);
  const result = await runInNewContext(expression, { window: { cc: { scene: 'Main' } }, TextEncoder,
    setTimeout, clearTimeout, Date });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.tests[0].status, 'passed');
});
