export function runLesson (): string[] {
    class ParticleSystem {
        private remainder = 0; count = 0;
        constructor (readonly rateOverTime: number, readonly capacity: number) {}
        update (dt: number): number { this.remainder += this.rateOverTime * dt; const quota = Math.min(this.capacity - this.count, Math.floor(this.remainder)); this.remainder -= quota; this.count += quota; return quota; }
    }
    const system = new ParticleSystem(10, 8); const emitted = system.update(0.5);
    return [`rate = ${system.rateOverTime}/s`, `emitted = ${emitted}`, `alive = ${system.count}`];
}
