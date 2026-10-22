import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCommand } from '../bridge/contracts.mjs';
import { normalizePreviewCoverage } from '../bridge/preview-coverage.mjs';

test('preview coverage keeps only scripts served by the selected Creator preview origin', () => {
  const report = normalizePreviewCoverage([
    { scriptId: '1', url: 'http://127.0.0.1:7456/src/project.js?cache=1', functions: [
      { functionName: 'move', isBlockCoverage: true, ranges: [
        { startOffset: 0, endOffset: 100, count: 4 }, { startOffset: 20, endOffset: 40, count: 0 },
      ] },
    ] },
    { scriptId: '2', url: 'https://cdn.example.com/vendor.js', functions: [
      { functionName: 'external', isBlockCoverage: false, ranges: [{ startOffset: 0, endOffset: 10, count: 1 }] },
    ] },
  ], 'http://127.0.0.1:7456');
  assert.deepEqual(report.scripts.map((script) => script.url), ['http://127.0.0.1:7456/src/project.js']);
  assert.deepEqual(report.totals, { totalFunctions: 1, coveredFunctions: 1, totalRanges: 2,
    coveredRanges: 1, functionPercent: 100, rangePercent: 50 });
});

test('preview coverage rejects invalid and over-budget V8 records', () => {
  assert.throws(() => normalizePreviewCoverage([{ url: 'http://127.0.0.1:7456/a.js', functions: [
    { functionName: 'bad', ranges: [{ startOffset: 4, endOffset: 2, count: 1 }] },
  ] }], 'http://127.0.0.1:7456'), { code: 'PREVIEW_COVERAGE_INVALID' });
});

test('preview interaction contract accepts only a boolean coverage option', () => {
  const base = { previewSessionId: '12345678-1234-4234-8234-123456789012',
    actions: [{ type: 'key', key: 'Space' }], assertions: [{ type: 'no-errors' }] };
  assert.equal(validateCommand('creator.preview.interact', { ...base, coverage: true }).ok, true);
  assert.equal(validateCommand('creator.preview.interact', { ...base, coverage: 'yes' }).ok, false);
});
