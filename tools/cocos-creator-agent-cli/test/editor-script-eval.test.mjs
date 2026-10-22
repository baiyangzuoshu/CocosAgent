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
