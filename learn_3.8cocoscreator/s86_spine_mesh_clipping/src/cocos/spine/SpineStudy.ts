export function runLesson(): string[] {
  const lines: string[] = [];
  const mesh = { vertices: 4, indices: 6, deformValues: 2 };
  lines.push('MeshAttachment: ' + mesh.vertices + ' vertices, ' + mesh.indices + ' indices');
  lines.push('Deform values: ' + mesh.deformValues + '; clipping runs before RenderData is filled.');
  return lines;
}
