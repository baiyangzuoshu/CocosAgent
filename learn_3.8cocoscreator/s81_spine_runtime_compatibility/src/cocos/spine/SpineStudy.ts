export function runLesson(): string[] {
  const lines: string[] = [];
  const compatible = (version: string, runtime: string) => version.startsWith(runtime + '.') && version !== '3.8.75';
  for (const version of ['3.8.75', '3.8.99', '4.2.0']) {
    lines.push(version + ': 3.8=' + compatible(version, '3.8') + ' 4.2=' + compatible(version, '4.2'));
  }
  lines.push('This models editor-only JSON / Binary compatibility checks.');
  return lines;
}
