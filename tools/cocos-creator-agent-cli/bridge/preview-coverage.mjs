const MAX_SCRIPTS = 512;
const MAX_FUNCTIONS = 12000;
const MAX_RANGES = 50000;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;

function fail(code) { const error = new Error(code); error.code = code; throw error; }

export function normalizePreviewCoverage(raw, previewOrigin) {
  if (!Array.isArray(raw) || raw.length > MAX_SCRIPTS || typeof previewOrigin !== 'string')
    fail('PREVIEW_COVERAGE_INVALID');
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalRanges = 0;
  let coveredRanges = 0;
  const scripts = [];
  for (const script of raw) {
    if (!script || typeof script.url !== 'string' || !Array.isArray(script.functions))
      fail('PREVIEW_COVERAGE_INVALID');
    let url;
    try { url = new URL(script.url); } catch (_) { continue; }
    if (url.origin !== previewOrigin || !['http:', 'https:'].includes(url.protocol)) continue;
    const functions = [];
    for (const fn of script.functions) {
      if (!fn || typeof fn.functionName !== 'string' || !Array.isArray(fn.ranges)) fail('PREVIEW_COVERAGE_INVALID');
      totalFunctions += 1;
      if (totalFunctions > MAX_FUNCTIONS) fail('PREVIEW_COVERAGE_LIMIT');
      const ranges = fn.ranges.map((range) => {
        if (!range || !Number.isInteger(range.startOffset) || !Number.isInteger(range.endOffset)
          || range.startOffset < 0 || range.endOffset < range.startOffset
          || !Number.isFinite(range.count) || range.count < 0) fail('PREVIEW_COVERAGE_INVALID');
        totalRanges += 1;
        if (totalRanges > MAX_RANGES) fail('PREVIEW_COVERAGE_LIMIT');
        const count = Math.min(Math.floor(range.count), 0x7fffffff);
        if (count > 0) coveredRanges += 1;
        return { startOffset: range.startOffset, endOffset: range.endOffset, count };
      });
      if ((ranges[0]?.count || 0) > 0) coveredFunctions += 1;
      functions.push({ name: fn.functionName.slice(0, 240), blockCoverage: fn.isBlockCoverage === true, ranges });
    }
    scripts.push({ url: `${url.origin}${url.pathname}`, functions });
  }
  const report = { kind: 'v8-precise-function-and-range', scripts,
    totals: { totalFunctions, coveredFunctions, totalRanges, coveredRanges,
      functionPercent: totalFunctions ? coveredFunctions / totalFunctions * 100 : 0,
      rangePercent: totalRanges ? coveredRanges / totalRanges * 100 : 0 } };
  if (Buffer.byteLength(JSON.stringify(report), 'utf8') > MAX_REPORT_BYTES) fail('PREVIEW_COVERAGE_REPORT_TOO_LARGE');
  return report;
}
