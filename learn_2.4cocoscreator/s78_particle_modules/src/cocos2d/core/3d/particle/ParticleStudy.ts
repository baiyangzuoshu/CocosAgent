type Particle = { age: number; lifetime: number; velocityX: number; size: number; red: number };
type Key = { time: number; value: number };
class PiecewiseCurve {
    constructor(readonly keys: readonly Key[]) {
        if (keys.length < 2 || keys.some((key, i) => i > 0 && key.time <= keys[i - 1].time)) {
            throw new Error('curve keys must have strictly increasing times');
        }
    }
    sample(t: number): number {
        if (t <= this.keys[0].time) return this.keys[0].value;
        const last = this.keys[this.keys.length - 1];
        if (t >= last.time) return last.value;
        const rightIndex = this.keys.findIndex((key) => key.time >= t);
        const left = this.keys[rightIndex - 1];
        const right = this.keys[rightIndex];
        const u = (t - left.time) / (right.time - left.time);
        return left.value + (right.value - left.value) * u;
    }
}
class ForceOvertime {
    constructor(private readonly x: PiecewiseCurve) {}
    apply(p: Particle, dt: number): void { p.velocityX += this.x.sample(p.age / p.lifetime) * dt; }
}
class ColorSizeOvertime {
    constructor(private readonly size: PiecewiseCurve, private readonly red: PiecewiseCurve) {}
    apply(p: Particle): void {
        const t = p.age / p.lifetime;
        p.size = this.size.sample(t);
        p.red = this.red.sample(t);
    }
}
export function runLesson(): string[] {
    const particle: Particle = { age: 0.5, lifetime: 1, velocityX: 2, size: 1, red: 1 };
    const force = new ForceOvertime(new PiecewiseCurve([{ time: 0, value: -4 }, { time: 1, value: 0 }]));
    const appearance = new ColorSizeOvertime(
        new PiecewiseCurve([{ time: 0, value: 0.5 }, { time: 1, value: 1.5 }]),
        new PiecewiseCurve([{ time: 0, value: 1 }, { time: 1, value: 0 }]),
    );
    force.apply(particle, 0.25);
    appearance.apply(particle);
    return [
        `normalized age = ${particle.age / particle.lifetime}`,
        `velocity.x after ForceOvertime = ${particle.velocityX}`,
        `size = ${particle.size}; red = ${particle.red}`,
    ];
}
