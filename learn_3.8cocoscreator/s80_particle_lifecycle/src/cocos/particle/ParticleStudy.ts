export function runLesson (): string[] {
    const particles = [{ age: 0.4, life: 1 }, { age: 0.9, life: 1 }]; let emitting = true;
    const stop = (): void => { emitting = false; }; stop();
    const dt = 0.2; for (const p of particles) p.age += dt;
    const alive = particles.filter((p) => p.age < p.life);
    const released = !emitting && alive.length === 0;
    return [`emitting = ${emitting}`, `alive after drain = ${alive.length}`, `resources released = ${released}`];
}
