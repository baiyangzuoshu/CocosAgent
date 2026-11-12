export function runLesson(): string[] {
  const lines: string[] = [];
  const state = new Map<number, string[]>();
  state.set(0, ['idle (loop)', 'attack @ 0.1s']);
  const mix = { from: 'idle', to: 'attack', duration: 0.15 };
  lines.push('track 0 queue: ' + state.get(0)!.join(' -> '));
  lines.push('mix ' + mix.from + ' -> ' + mix.to + ': ' + mix.duration + 's');
  return lines;
}
