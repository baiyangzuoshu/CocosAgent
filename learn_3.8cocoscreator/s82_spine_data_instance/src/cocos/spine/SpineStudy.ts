class SkeletonInstance<T> {
  constructor(public data: T, public pose: string) {}
}

export function runLesson(): string[] {
  const lines: string[] = [];
  const asset = { name: 'hero', refs: 2 };
  const first = new SkeletonInstance(asset, 'idle');
  const second = new SkeletonInstance(asset, 'run');
  lines.push('shared SkeletonData asset: ' + (first.data === second.data));
  lines.push('separate component poses: ' + (first.pose !== second.pose));
  lines.push('cache info and render data have their own release paths.');
  return lines;
}
