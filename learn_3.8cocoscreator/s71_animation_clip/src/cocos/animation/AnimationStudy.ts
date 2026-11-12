export function runLesson (): string[] {
    const clip = { name: "move", duration: 1, trackCount: 1 };
    return [`AnimationClip = ${clip.name}`, `duration = ${clip.duration}s`, `tracks = ${clip.trackCount}`];
}
