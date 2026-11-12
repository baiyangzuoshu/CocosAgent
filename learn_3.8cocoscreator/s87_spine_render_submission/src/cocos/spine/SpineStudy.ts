export function runLesson(): string[] {
  const lines: string[] = [];
  const path = ['SkeletonSystem.prepareRenderData', 'simple assembler', 'RenderData / drawList', 'Batcher2D.commitMiddleware'];
  lines.push(path.join(' -> '));
  lines.push('Texture and material boundaries determine what can be batched.');
  return lines;
}
