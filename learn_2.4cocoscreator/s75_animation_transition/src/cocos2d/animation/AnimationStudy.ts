export function runLesson (): string[] {
    const states = new Map<string, number>();
    states.set("base:run", 1); states.set("additive:breath", 0.5);
    return [`playAdditive states = ${states.size}`, ...[...states].map(([name, weight]) => `${name} weight=${weight}`)];
}
