export function runLesson (): string[] {
    const keys = [{ time: 0, value: 0 }, { time: 0.5, value: 10 }, { time: 1, value: 20 }];
    const time = 0.75;
    const left = keys[1]; const right = keys[2];
    const t = (time - left.time) / (right.time - left.time);
    const value = left.value + (right.value - left.value) * t;
    return [`sample time = ${time}`, `interpolation t = ${t}`, `target.position.x = ${value}`];
}
