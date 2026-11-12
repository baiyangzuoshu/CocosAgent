export function runLesson(): string[] {
  const lines: string[] = [];
  const callbacks = ['start', 'event', 'complete'];
  lines.push('TrackEntry listener: ' + callbacks.join(', '));
  lines.push('On destroy, detach runtime state and release cache association.');
  return lines;
}
