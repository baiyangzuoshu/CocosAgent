export function runLesson(): string[] {
  const lines: string[] = [];
  const steps = ['update(dt)', 'AnimationState.update', 'apply', 'updateWorldTransform'];
  lines.push(steps.join(' -> '));
  const rootWorldX = 2;
  const armLocalX = 3;
  lines.push('arm world x = ' + (rootWorldX + armLocalX));
  lines.push('Updated bones provide world-space pose for the assembler.');
  return lines;
}
