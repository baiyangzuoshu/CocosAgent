// Node's test runner owns the child process and failure exit code. Emit only
// bounded, JSON-safe test events; test stdout never becomes protocol input.
export default async function* report(source) {
  for await (const event of source) {
    const data = event.data || {};
    if (event.type === 'test:pass' || event.type === 'test:fail') {
      if (data.details?.type === 'suite') continue;
      const error = data.details?.error;
      yield JSON.stringify({ type: 'case', test: {
        name: String(data.name || 'unnamed').slice(0, 512),
        file: data.file, line: data.line, column: data.column, nesting: data.nesting,
        status: data.skip || data.todo ? 'skipped' : event.type === 'test:pass' ? 'passed' : 'failed',
        durationMs: Math.max(0, Number(data.details?.duration_ms) || 0),
        message: String(data.skip || data.todo || error?.cause?.stack || error?.stack || '').slice(0, 8192),
      } }) + '\n';
    } else if (event.type === 'test:stdout' || event.type === 'test:stderr') {
      yield JSON.stringify({ type: 'log', message: String(data.message || '').slice(0, 8192) }) + '\n';
    } else if (event.type === 'test:coverage' && data.summary && typeof data.summary === 'object') {
      const summary = data.summary;
      const totals = summary.totals && typeof summary.totals === 'object' ? summary.totals : {};
      const files = Array.isArray(summary.files) ? summary.files.slice(0, 256).map((file) => ({
        path: String(file.path || '').slice(0, 1024),
        totalLineCount: Number(file.totalLineCount) || 0,
        coveredLineCount: Number(file.coveredLineCount) || 0,
        coveredLinePercent: Number(file.coveredLinePercent) || 0,
        totalBranchCount: Number(file.totalBranchCount) || 0,
        coveredBranchCount: Number(file.coveredBranchCount) || 0,
        coveredBranchPercent: Number(file.coveredBranchPercent) || 0,
        totalFunctionCount: Number(file.totalFunctionCount) || 0,
        coveredFunctionCount: Number(file.coveredFunctionCount) || 0,
        coveredFunctionPercent: Number(file.coveredFunctionPercent) || 0,
      })) : [];
      yield JSON.stringify({ type: 'coverage', summary: {
        totals: {
          totalLineCount: Number(totals.totalLineCount) || 0,
          coveredLineCount: Number(totals.coveredLineCount) || 0,
          coveredLinePercent: Number(totals.coveredLinePercent) || 0,
          totalBranchCount: Number(totals.totalBranchCount) || 0,
          coveredBranchCount: Number(totals.coveredBranchCount) || 0,
          coveredBranchPercent: Number(totals.coveredBranchPercent) || 0,
          totalFunctionCount: Number(totals.totalFunctionCount) || 0,
          coveredFunctionCount: Number(totals.coveredFunctionCount) || 0,
          coveredFunctionPercent: Number(totals.coveredFunctionPercent) || 0,
        },
        files, truncated: Array.isArray(summary.files) && summary.files.length > files.length,
      } }) + '\n';
    }
  }
}
