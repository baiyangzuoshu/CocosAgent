import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const MAX_PREVIEW_TEST_SOURCE_BYTES = 16 * 1024;
export const MAX_PREVIEW_TEST_INPUT_BYTES = 16 * 1024;
export const MAX_PREVIEW_TEST_CASES_PER_RUN = 64;
export const MAX_PREVIEW_TEST_RESULT_BYTES = 64 * 1024;
export const MAX_PREVIEW_TEST_TIMEOUT_MS = 25000;

function coded(code) { const error = new Error(code); error.code = code; return error; }

export function readPreviewTestSource(projectRoot, relative) {
  const parts = typeof relative === 'string' ? relative.split('/') : [];
  if (typeof relative !== 'string' || relative.length > 512 || parts.length !== 3 || parts[0] !== '.cocos-agent' || parts[1] !== 'preview-tests'
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.js$/.test(parts[2])) throw coded('PREVIEW_TEST_SCRIPT_PATH_INVALID');
  const root = fs.realpathSync(projectRoot);
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (_) { throw coded('PREVIEW_TEST_SCRIPT_NOT_FOUND'); }
    if (stat.isSymbolicLink()) throw coded('PREVIEW_TEST_SCRIPT_SYMLINK');
  }
  const stat = fs.statSync(current);
  if (!stat.isFile() || stat.size > MAX_PREVIEW_TEST_SOURCE_BYTES) throw coded('PREVIEW_TEST_SCRIPT_INVALID');
  const bytes = fs.readFileSync(current);
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (_) { throw coded('PREVIEW_TEST_SCRIPT_INVALID_UTF8'); }
  return { path: current, projectPath: parts.join('/'), bytes, source,
    sha256: createHash('sha256').update(bytes).digest('hex') };
}

// This function is serialized into the attached Chromium page. Keep it self-contained.
export function createPreviewTestHarness(selectedIds, timeoutMs, maxResultBytes, context = {}) {
  const casePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const reports = new WeakSet();
  let hasRun = false;
  const bounded = (value, maxBytes) => {
    let text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ');
    while (new TextEncoder().encode(text).length > maxBytes) text = text.slice(0, -1);
    return text;
  };
  const harness = {
    assert(condition, message) {
      if (!condition) throw new Error(message || 'Creator Preview test assertion failed.');
    },
    isReport(value) { return reports.has(value); },
    async run(cases, options) {
      if (hasRun) throw new Error('PREVIEW_TEST_RUNNER_ALREADY_USED');
      hasRun = true;
      options = options || {};
      if (!Array.isArray(cases) || !cases.length || cases.length > 1000) throw new Error('PREVIEW_TEST_CASES_INVALID');
      const byId = new Map();
      for (const entry of cases) {
        if (!entry || typeof entry.id !== 'string' || !casePattern.test(entry.id) || byId.has(entry.id)
          || typeof entry.run !== 'function') throw new Error('PREVIEW_TEST_CASE_INVALID');
        byId.set(entry.id, entry);
      }
      if (!Array.isArray(selectedIds) || !selectedIds.length || selectedIds.length > 64
        || selectedIds.some((id) => !byId.has(id)) || new Set(selectedIds).size !== selectedIds.length)
        throw new Error('PREVIEW_TEST_SELECTION_INVALID');
      const caseTimeoutMs = options.timeoutMs === undefined ? Math.min(5000, timeoutMs) : options.timeoutMs;
      if (!Number.isInteger(caseTimeoutMs) || caseTimeoutMs < 1 || caseTimeoutMs > timeoutMs)
        throw new Error('PREVIEW_TEST_TIMEOUT_INVALID');
      const deadline = Date.now() + timeoutMs;
      const tests = [];
      let interrupted = false;
      for (const id of selectedIds) {
        const entry = byId.get(id);
        const name = bounded(entry.name || entry.id, 128);
        if (interrupted) {
          tests.push({ id: entry.id, name, status: 'skipped', durationMs: 0,
            message: 'Earlier test timed out; remaining cases need review.' });
          continue;
        }
        const started = Date.now();
        let timer;
        try {
          const remaining = Math.max(1, deadline - Date.now());
          await Promise.race([Promise.resolve().then(() => entry.run(context)), new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(Object.assign(new Error('CREATOR_PREVIEW_TEST_TIMEOUT'), { timedOut: true })),
              Math.min(caseTimeoutMs, remaining));
          })]);
          tests.push({ id: entry.id, name, status: 'passed', durationMs: Date.now() - started, message: '' });
        } catch (error) {
          interrupted = Boolean(error && error.timedOut);
          tests.push({ id: entry.id, name, status: 'failed', durationMs: Date.now() - started,
            message: bounded(error && (error.stack || error.message) || error, 512) });
        } finally { clearTimeout(timer); }
      }
      const report = { schemaVersion: 1, tests, requiresManualReview: interrupted };
      const encoded = JSON.stringify(report);
      if (new TextEncoder().encode(encoded).length > maxResultBytes) throw new Error('PREVIEW_TEST_RESULT_TOO_LARGE');
      for (const test of tests) Object.freeze(test);
      Object.freeze(tests);
      Object.freeze(report);
      reports.add(report);
      return report;
    },
  };
  return Object.freeze(harness);
}
