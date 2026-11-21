type Particle = { age: number; lifetime: number };
class ParticleSystem3D {
    private emitting = true;
    private released = false;
    private particles: Particle[];
    constructor(particles: Particle[]) { this.particles = particles; }
    stopEmitting(): void { this.emitting = false; }
    update(dt: number): void {
        if (this.released) return;
        if (this.emitting) this.particles.push({ age: 0, lifetime: 1 });
        for (const p of this.particles) p.age += dt;
        this.particles = this.particles.filter((p) => p.age < p.lifetime);
        if (!this.emitting && this.particles.length === 0) this.released = true;
    }
    snapshot(): { emitting: boolean; alive: number; released: boolean } {
        return { emitting: this.emitting, alive: this.particles.length, released: this.released };
    }
}
export function runLesson(): string[] {
    const system = new ParticleSystem3D([{ age: 0.4, lifetime: 1 }, { age: 0.9, lifetime: 1 }]);
    system.stopEmitting();
    const log: string[] = [];
    for (let i = 0; i < 4; i++) {
        system.update(0.2);
        const s = system.snapshot();
        log.push(`step ${i + 1}: emitting=${s.emitting}, alive=${s.alive}, released=${s.released}`);
    }
    return log;
}
