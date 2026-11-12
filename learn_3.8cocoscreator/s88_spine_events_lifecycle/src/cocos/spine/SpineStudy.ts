export function runLesson(): string[] {
  const lines: string[] = [];
  const events = ['start', 'interrupt', 'event', 'complete', 'end', 'dispose'];
  lines.push('TrackEntry listeners: ' + events.join(', '));
  lines.push('onDisable removes the system entry; onDestroy releases render data and cache info.');
  return lines;
}
