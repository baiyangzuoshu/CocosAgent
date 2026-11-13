export function parseImport(file: { json: string }, trace: string[]): Record<string, unknown> {
  trace.push("parser.parse(import)");
  return JSON.parse(file.json) as Record<string, unknown>;
}
