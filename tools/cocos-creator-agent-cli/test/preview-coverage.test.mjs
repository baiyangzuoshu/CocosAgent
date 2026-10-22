import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCommand } from '../bridge/contracts.mjs';
import { mergePreviewCoverageReports, normalizePreviewCoverage } from '../bridge/preview-coverage.mjs';

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

test('preview coverage merges repeated script ranges across independent test cases', () => {
  const reports = [
    { kind: 'v8-precise-function-and-range', scripts: [{ url: 'http://127.0.0.1:7456/src/game.js', functions: [
      { name: 'move', blockCoverage: true, ranges: [
        { startOffset: 0, endOffset: 100, count: 1 }, { startOffset: 20, endOffset: 40, count: 0 },
      ] },
    ] }] },
    { kind: 'v8-precise-function-and-range', scripts: [{ url: 'http://127.0.0.1:7456/src/game.js', functions: [
      { name: 'move', blockCoverage: true, ranges: [
        { startOffset: 0, endOffset: 100, count: 1 }, { startOffset: 20, endOffset: 40, count: 1 },
      ] },
    ] }] },
  ];
  const merged = mergePreviewCoverageReports(reports);
  assert.equal(merged.scripts.length, 1);
  assert.deepEqual(merged.totals, { totalFunctions: 1, coveredFunctions: 1, totalRanges: 2,
    coveredRanges: 2, functionPercent: 100, rangePercent: 100 });
  assert.deepEqual(merged.scripts[0].functions[0].ranges.map((range) => range.count), [2, 1]);
});

test('preview interaction contract accepts only a boolean coverage option', () => {
  const base = { previewSessionId: '12345678-1234-4234-8234-123456789012',
    actions: [{ type: 'key', key: 'Space' }], assertions: [{ type: 'no-errors' }] };
  assert.equal(validateCommand('creator.preview.interact', { ...base, coverage: true }).ok, true);
  assert.equal(validateCommand('creator.preview.interact', { ...base, coverage: 'yes' }).ok, false);
});

test('preview interaction accepts explicit UI refresh actions and geometry assertions', () => {
  const base = { previewSessionId: '12345678-1234-4234-8234-123456789012',
    actions: [{ type: 'ui-refresh', path: 'Scene/Canvas/List', componentType: 'cc.Layout' }],
    assertions: [{ type: 'node-property', path: 'Scene/Canvas/List/Item', property: 'y', expected: 24 }] };
  assert.equal(validateCommand('creator.preview.interact', base).ok, true);
  assert.equal(validateCommand('creator.preview.interact', { ...base, actions: [
    { type: 'ui-refresh', path: '../List', componentType: 'cc.Layout' },
  ] }).ok, false);
  assert.equal(validateCommand('creator.preview.interact', { ...base, assertions: [
    { type: 'node-property', path: 'Scene/Canvas/List/Item', property: 'height', expected: 30 },
  ] }).ok, true);
});

test('preview interaction contract accepts bounded drag and text actions with control-state assertions', () => {
  const previewSessionId = '12345678-1234-4234-8234-123456789012';
  assert.equal(validateCommand('creator.preview.interact', { previewSessionId,
    actions: [
      { type: 'drag', startX: 0.2, startY: 0.8, endX: 0.8, endY: 0.2, durationMs: 400 },
      { type: 'text', text: 'hello' },
    ],
    assertions: [
      { type: 'component-property', path: 'Scene/Canvas/Slider', componentType: 'cc.Slider',
        componentProperty: 'progress', expected: 0.8 },
    ],
  }).ok, true);
  assert.equal(validateCommand('creator.preview.interact', { previewSessionId,
    actions: [{ type: 'drag', startX: 0.2, startY: 0.2, endX: 1.1, endY: 0.8 }],
  }).ok, false);
  assert.equal(validateCommand('creator.preview.interact', { previewSessionId,
    actions: [{ type: 'text', text: 'x'.repeat(513) }],
  }).ok, false);
});
