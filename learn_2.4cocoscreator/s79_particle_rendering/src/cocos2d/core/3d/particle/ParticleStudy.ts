export function runLesson (): string[] {
    const particles = [{ x: 1, y: 2, size: 1 }, { x: 3, y: 2, size: 0.5 }];
    const vertices = particles.flatMap((p) => [p.x-p.size,p.y-p.size,p.x+p.size,p.y-p.size,p.x+p.size,p.y+p.size,p.x-p.size,p.y+p.size]);
    return [`ParticleSystem3DRenderer writes active particles to ParticleBatchModel`, `particles = ${particles.length}`, `billboard vertices = ${vertices.length / 2}`];
}
