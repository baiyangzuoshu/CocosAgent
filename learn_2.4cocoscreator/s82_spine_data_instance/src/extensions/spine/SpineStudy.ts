class SkeletonInstance<T> {
  constructor(public data: T, public pose: string) {}
}

export function runLesson(): string[] {
  const lines: string[] = [];
  const data = { bones: ['root', 'arm'], atlasPages: 1 };
  const first = new SkeletonInstance(data, 'idle pose');
  const second = new SkeletonInstance(data, 'attack pose');
  lines.push('SkeletonData shared: ' + (first.data === second.data));
  lines.push('instance poses separate: ' + (first.pose !== second.pose));
  return lines;
}
