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

export function mergePreviewCoverageReports(reports) {
  if (!Array.isArray(reports) || reports.some((report) => !report
    || report.kind !== 'v8-precise-function-and-range' || !Array.isArray(report.scripts)))
    fail('PREVIEW_COVERAGE_INVALID');
  const scripts = new Map();
  let totalFunctions = 0;
  let totalRanges = 0;
  for (const report of reports) {
    for (const script of report.scripts) {
      if (!script || typeof script.url !== 'string' || !Array.isArray(script.functions)) fail('PREVIEW_COVERAGE_INVALID');
      let merged = scripts.get(script.url);
      if (!merged) {
        merged = new Map();
        scripts.set(script.url, merged);
      }
      for (const fn of script.functions) {
        if (!fn || typeof fn.name !== 'string' || typeof fn.blockCoverage !== 'boolean' || !Array.isArray(fn.ranges))
          fail('PREVIEW_COVERAGE_INVALID');
        const shape = JSON.stringify([fn.name, fn.blockCoverage,
          fn.ranges.map((range) => [range.startOffset, range.endOffset])]);
        let current = merged.get(shape);
        if (!current) {
          current = { name: fn.name, blockCoverage: fn.blockCoverage,
            ranges: fn.ranges.map((range) => ({ ...range, count: 0 })) };
          merged.set(shape, current);
          totalFunctions += 1;
          totalRanges += current.ranges.length;
          if (totalFunctions > MAX_FUNCTIONS || totalRanges > MAX_RANGES) fail('PREVIEW_COVERAGE_LIMIT');
        }
        if (current.ranges.length !== fn.ranges.length) fail('PREVIEW_COVERAGE_INVALID');
        fn.ranges.forEach((range, index) => {
          if (!Number.isInteger(range.startOffset) || !Number.isInteger(range.endOffset)
            || !Number.isFinite(range.count) || range.count < 0
            || current.ranges[index].startOffset !== range.startOffset
            || current.ranges[index].endOffset !== range.endOffset) fail('PREVIEW_COVERAGE_INVALID');
          current.ranges[index].count = Math.min(0x7fffffff,
            current.ranges[index].count + Math.floor(range.count));
        });
      }
    }
  }
  const mergedScripts = [...scripts.entries()].map(([url, functions]) => ({ url, functions: [...functions.values()] }));
  let coveredFunctions = 0;
  let coveredRanges = 0;
  for (const script of mergedScripts) {
    for (const fn of script.functions) {
      if ((fn.ranges[0]?.count || 0) > 0) coveredFunctions += 1;
      for (const range of fn.ranges) if (range.count > 0) coveredRanges += 1;
    }
  }
  const report = { kind: 'v8-precise-function-and-range', scripts: mergedScripts,
    totals: { totalFunctions, coveredFunctions, totalRanges, coveredRanges,
      functionPercent: totalFunctions ? coveredFunctions / totalFunctions * 100 : 0,
      rangePercent: totalRanges ? coveredRanges / totalRanges * 100 : 0 } };
  if (Buffer.byteLength(JSON.stringify(report), 'utf8') > MAX_REPORT_BYTES) fail('PREVIEW_COVERAGE_REPORT_TOO_LARGE');
  return report;
}
