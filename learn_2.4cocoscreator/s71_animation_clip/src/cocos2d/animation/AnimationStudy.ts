export function runLesson (): string[] {
    const clip = { name: "move", duration: 1, keys: [{ time: 0, x: 0 }, { time: 1, x: 10 }] };
    return [`clip = ${clip.name}`, `duration = ${clip.duration}s`, `key count = ${clip.keys.length}`];
}
