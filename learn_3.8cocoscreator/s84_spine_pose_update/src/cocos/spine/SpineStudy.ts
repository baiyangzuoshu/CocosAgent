export function runLesson(): string[] {
  const lines: string[] = [];
  const steps = ['SkeletonSystem.postUpdate(dt)', 'Skeleton.updateAnimation(dt)', 'AnimationState.apply', 'updateWorldTransform'];
  lines.push(steps.join(' -> '));
  const rootWorldX = 2;
  const armLocalX = 3;
  lines.push('arm world x = ' + (rootWorldX + armLocalX));
  lines.push('Then mark render data dirty for the UI assembler.');
  return lines;
}
