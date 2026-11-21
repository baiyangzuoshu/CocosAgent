type Particle = { position: [number, number, number]; direction: [number, number, number] };
class BoxEmitter {
    constructor(readonly halfExtents: [number, number, number]) {}
    sample(index: number): Particle {
        const x = ((index * 37) % 100) / 100 * 2 - 1;
        return {
            position: [x * this.halfExtents[0], 0, 0],
            direction: [0, 1, 0],
        };
    }
}
class ParticleSystem3D {
    private emissionRemainder = 0;
    private nextId = 0;
    readonly particles: Array<Particle & { id: number }> = [];
    constructor(readonly rateOverTime: number, readonly capacity: number, readonly emitter: BoxEmitter) {}
    get remainingQuota(): number { return this.emissionRemainder; }
    update(dt: number): number {
        this.emissionRemainder += this.rateOverTime * dt;
        const requested = Math.floor(this.emissionRemainder);
        const count = Math.min(requested, this.capacity - this.particles.length);
        for (let i = 0; i < count; i++) this.particles.push({ id: ++this.nextId, ...this.emitter.sample(this.nextId) });
        this.emissionRemainder -= count;
        return count;
    }
}
export function runLesson(): string[] {
    const system = new ParticleSystem3D(5, 4, new BoxEmitter([2, 1, 1]));
    const first = system.update(0.1);
    const second = system.update(0.3);
    return [
        `emitted by steps = ${first}, ${second}; alive=${system.particles.length}`,
        `fractional remainder = ${system.remainingQuota}`,
        `first particle origin = ${system.particles[0]?.position.join(', ')}`,
    ];
}
