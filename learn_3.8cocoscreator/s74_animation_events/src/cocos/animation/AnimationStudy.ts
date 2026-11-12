export function runLesson (): string[] {
    const events = [{ time: 0.25, name: "footstep" }, { time: 0.75, name: "land" }];
    let previous = 0.2; const current = 0.8;
    const fired = events.filter((event) => previous < event.time && event.time <= current).map((event) => event.name);
    previous = current;
    return [`crossed events = ${fired.join(", ")}`, `last sampled time = ${previous}`];
}
