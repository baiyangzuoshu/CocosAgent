export function runLesson (): string[] {
    const particle = { age: 0.5, lifetime: 1, vx: 2, size: 1, red: 1 };
    const t = particle.age / particle.lifetime; const dt = 0.25; const force = -4;
    particle.vx += force * dt; particle.size = 1 + t; particle.red = 1 - t;
    return [`normalized age = ${t}`, `velocity.x after force = ${particle.vx}`, `size = ${particle.size}`, `red = ${particle.red}`];
}
