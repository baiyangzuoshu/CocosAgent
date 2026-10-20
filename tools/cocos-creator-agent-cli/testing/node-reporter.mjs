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
    }
  }
}
