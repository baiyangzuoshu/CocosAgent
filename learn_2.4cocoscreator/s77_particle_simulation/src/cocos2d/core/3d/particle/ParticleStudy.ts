export function runLesson (): string[] {
    type Particle = { age: number; lifetime: number; x: number; vx: number };
    const particles: Particle[] = [{ age: 0.4, lifetime: 1, x: 0, vx: 2 }, { age: 0.9, lifetime: 1, x: 1, vx: 1 }];
    const dt = 0.2; for (const p of particles) { p.age += dt; p.x += p.vx * dt; }
    const alive = particles.filter((p) => p.age < p.lifetime);
    return [`alive before = ${particles.length}`, `alive after = ${alive.length}`, `positions = ${alive.map((p) => p.x).join(', ')}`];
}
