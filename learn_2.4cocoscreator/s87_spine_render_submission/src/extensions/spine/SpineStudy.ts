export function runLesson(): string[] {
  const lines: string[] = [];
  const path = ['spine-assembler.updateRenderData', 'MeshBuffer', 'WebGL draw'];
  lines.push(path.join(' -> '));
  lines.push('Material or texture boundary flushes the current renderer buffer.');
  return lines;
}
