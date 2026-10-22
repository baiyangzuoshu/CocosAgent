import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateEditorScript, runEditorScript } = require('../creator-extension/editor-script-eval.cjs');

test('Creator Editor script evaluator returns bounded JSON results with explicit Editor and input', async () => {
  const result = await runEditorScript({ source: 'return { version: Editor.version, value: input.value + 1 };',
    input: { value: 4 }, editor: { version: '2.4.15' } });
  assert.deepEqual(result, { result: { version: '2.4.15', value: 5 }, resultBytes: 30 });
});

test('Creator Editor script evaluator supports awaited editor callbacks within its execution timeout', async () => {
  const result = await runEditorScript({ source: 'await Editor.wait(); return input.ok;',
    input: { ok: true }, editor: { wait: () => Promise.resolve() }, timeoutMs: 200 });
  assert.equal(result.result, true);
});

test('Creator Editor test harness runs only manifest-selected cases and returns a structured report', async () => {
  let firstRan = false;
  const result = await runEditorScript({ source: `return CreatorTest.run([
    { id: 'first', run: () => Editor.mark() },
    { id: 'second', name: 'Second case', run: () => CreatorTest.assert(Editor.version === '2.4.15') },
  ]);`, input: { __cocosAgentTest: { selectedCaseIds: ['second'] } },
  editor: { version: '2.4.15', mark: () => { firstRan = true; } } });
  assert.equal(firstRan, false);
  assert.equal(result.result.schemaVersion, 1);
  assert.equal(result.result.requiresManualReview, false);
  assert.equal(result.result.tests.length, 1);
  assert.equal(result.result.tests[0].id, 'second');
  assert.equal(result.result.tests[0].name, 'Second case');
  assert.equal(result.result.tests[0].status, 'passed');
});

test('Creator Editor test harness records failures and skips later tests after a timeout', async () => {
  let laterRan = false;
  const result = await runEditorScript({ source: `return CreatorTest.run([
    { id: 'hang', run: () => new Promise(() => {}) },
    { id: 'later', run: () => { laterRan = true; } },
  ], { timeoutMs: 5 });`,
  input: { __cocosAgentTest: { selectedCaseIds: ['hang', 'later'] } }, editor: {} });
  assert.equal(laterRan, false);
  assert.equal(result.result.tests[0].status, 'failed');
  assert.equal(result.result.tests[1].status, 'skipped');
  assert.equal(result.result.requiresManualReview, true);
});

test('Creator Editor script evaluator caps synchronous execution and never accepts non-JSON input', async () => {
  await assert.rejects(runEditorScript({ source: 'while (true) {}', editor: {}, syncTimeoutMs: 25 }),
    { code: 'EDITOR_SCRIPT_SYNC_TIMEOUT' });
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => validateEditorScript('return null;', cyclic), { code: 'EDITOR_SCRIPT_INPUT_INVALID' });
});

test('Creator Editor script evaluator refuses non-JSON and oversized results', async () => {
  await assert.rejects(runEditorScript({ source: 'return () => 1;', editor: {} }),
    { code: 'EDITOR_SCRIPT_RESULT_INVALID' });
  await assert.rejects(runEditorScript({ source: 'return "x".repeat(65537);', editor: {} }),
    { code: 'EDITOR_SCRIPT_RESULT_INVALID' });
});

test('Creator Editor script evaluator marks async work that exceeds its deadline without retry behavior', async () => {
  await assert.rejects(runEditorScript({ source: 'await new Promise(() => {}); return true;',
    editor: {}, timeoutMs: 5 }), { code: 'EDITOR_SCRIPT_ASYNC_TIMEOUT' });
});
