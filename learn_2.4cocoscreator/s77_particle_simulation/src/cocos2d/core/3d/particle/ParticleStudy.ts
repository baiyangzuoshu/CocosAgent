type Particle = { id: number; age: number; lifetime: number; position: [number, number, number]; velocity: [number, number, number] };
class ParticleSystem3D {
    private readonly alive: Particle[] = [];
    private readonly recycled: Particle[] = [];
    constructor(initial: Particle[]) { this.alive.push(...initial); }
    update(dt: number): { alive: number; recycled: number } {
        let recycledNow = 0;
        for (let i = this.alive.length - 1; i >= 0; i--) {
            const p = this.alive[i];
            p.age += dt;
            p.position[0] += p.velocity[0] * dt;
            p.position[1] += p.velocity[1] * dt;
            p.position[2] += p.velocity[2] * dt;
            if (p.age >= p.lifetime) {
                this.alive.splice(i, 1);
                this.recycled.push(p);
                recycledNow++;
            }
        }
        return { alive: this.alive.length, recycled: recycledNow };
    }
    get particles(): readonly Particle[] { return this.alive; }
    get poolSize(): number { return this.recycled.length; }
}
export function runLesson(): string[] {
    const system = new ParticleSystem3D([
        { id: 1, age: 0.4, lifetime: 1, position: [0, 0, 0], velocity: [2, 0, 0] },
        { id: 2, age: 0.9, lifetime: 1, position: [1, 0, 0], velocity: [1, 0, 0] },
    ]);
    const before = system.particles.length;
    const result = system.update(0.2);
    return [
        `alive before/after = ${before}/${result.alive}`,
        `positions = ${system.particles.map((p) => p.position[0]).join(', ') || 'none'}`,
        `recycled this step / pool size = ${result.recycled}/${system.poolSize}`,
    ];
}
