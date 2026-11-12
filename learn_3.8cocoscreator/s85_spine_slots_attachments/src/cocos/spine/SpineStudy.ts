export function runLesson(): string[] {
  const lines: string[] = [];
  const skin = { slot: 'hand-slot', attachment: 'sword-mesh' };
  const drawList = ['body', 'hand', 'weapon', 'head'];
  lines.push(skin.slot + ' -> ' + skin.attachment);
  lines.push('drawList: ' + drawList.join(' -> '));
  return lines;
}
