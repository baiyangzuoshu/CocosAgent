export function runLesson(): string[] {
  const lines: string[] = [];
  const version = 'exported version field';
  lines.push('SkeletonData.version <- ' + version);
  lines.push('JSON / Binary reader stores export metadata.');
  lines.push('Compare this field with the bundled Runtime before shipping.');
  return lines;
}
