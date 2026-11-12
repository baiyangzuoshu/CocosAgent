export function runLesson(): string[] {
  const lines: string[] = [];
  const mesh = { vertices: 4, triangles: 2 };
  lines.push('MeshAttachment: ' + mesh.vertices + ' vertices / ' + mesh.triangles + ' triangles');
  lines.push('Deform changes vertices; SkeletonClipping clips before buffer upload.');
  return lines;
}
