export function runLesson(): string[] {
  const lines: string[] = [];
  const track0 = ['idle', 'run'];
  const track1 = ['upper-body'];
  lines.push('track 0: ' + track0.join(' -> ') + ' (queued)');
  lines.push('track 1: ' + track1.join(' -> '));
  lines.push('Mix duration is stored in AnimationStateData.');
  return lines;
}
