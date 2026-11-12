export function runLesson(): string[] {
  const lines: string[] = [];
  const skin = { name: 'default', arm: 'arm-region' };
  const drawOrder = ['body-slot', 'arm-slot', 'head-slot'];
  lines.push('skin ' + skin.name + ' selects ' + skin.arm + ' for arm-slot');
  lines.push('Skeleton.drawOrder: ' + drawOrder.join(' -> '));
  return lines;
}
