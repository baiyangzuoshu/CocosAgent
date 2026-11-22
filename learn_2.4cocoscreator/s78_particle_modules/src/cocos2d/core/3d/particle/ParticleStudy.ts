type Vec3 = [number, number, number];
type Color = [number, number, number, number];
type Particle = { age: number; lifetime: number; velocity: Vec3; size: number; color: Color };
type Key = { time: number; value: number };
class OptimizedCurve {
  constructor(readonly keys: readonly Key[]) {
    if (keys.length < 2 || keys.some((key, i) => i > 0 && key.time <= keys[i - 1].time)) throw new Error("curve keys must have increasing times");
  }
  sample(t: number): number {
    const time = Math.max(this.keys[0].time, Math.min(this.keys[this.keys.length - 1].time, t));
    let low = 0, high = this.keys.length - 1;
    while (low + 1 < high) { const mid = (low + high) >> 1; if (this.keys[mid].time <= time) low = mid; else high = mid; }
    const left = this.keys[low], right = this.keys[high];
    const ratio = (time - left.time) / (right.time - left.time);
    return left.value + (right.value - left.value) * ratio;
  }
}
class CurveRange {
  constructor(readonly min: OptimizedCurve, readonly max: OptimizedCurve, readonly randomRatio: number) {}
  sample(normalizedAge: number): number {
    return this.min.sample(normalizedAge) * (1 - this.randomRatio) + this.max.sample(normalizedAge) * this.randomRatio;
  }
}
class GradientRange {
  constructor(readonly keys: readonly { time: number; color: Color }[]) {
    if (keys.length < 2 || keys.some((key, i) => i > 0 && key.time <= keys[i - 1].time)) throw new Error("gradient stops must have increasing times");
  }
  sample(t: number): Color {
    const index = this.keys.findIndex((key) => key.time >= t);
    const left = this.keys[Math.max(0, index < 0 ? this.keys.length - 2 : index - 1)];
    const right = this.keys[index < 0 ? this.keys.length - 1 : index];
    const ratio = Math.max(0, Math.min(1, (t - left.time) / (right.time - left.time)));
    return left.color.map((value, channel) => value + (right.color[channel] - value) * ratio) as Color;
  }
}
interface ParticleAnimator { update(particle: Particle, normalizedAge: number, dt: number): void }
class ForceOvertime implements ParticleAnimator {
  constructor(private readonly force: [CurveRange, CurveRange, CurveRange]) {}
  update(particle: Particle, age: number, dt: number): void {
    for (let axis = 0; axis < 3; axis++) particle.velocity[axis] += this.force[axis].sample(age) * dt;
  }
}
class VelocityOvertime implements ParticleAnimator {
  constructor(private readonly velocity: [CurveRange, CurveRange, CurveRange], private readonly enabledAxes: [boolean, boolean, boolean] = [true, true, true]) {}
  update(particle: Particle, age: number): void {
    for (let axis = 0; axis < 3; axis++) if (this.enabledAxes[axis]) particle.velocity[axis] = this.velocity[axis].sample(age);
  }
}
class SizeOvertime implements ParticleAnimator {
  constructor(private readonly size: CurveRange) {}
  update(particle: Particle, age: number): void { particle.size = Math.max(0, this.size.sample(age)); }
}
class ColorOvertime implements ParticleAnimator {
  constructor(private readonly gradient: GradientRange) {}
  update(particle: Particle, age: number): void { particle.color = this.gradient.sample(age); }
}
class ParticleSystem3D {
  constructor(private readonly animators: readonly ParticleAnimator[]) {}
  updateParticle(particle: Particle, dt: number): void {
    particle.age = Math.min(particle.lifetime, particle.age + dt);
    const normalizedAge = particle.lifetime > 0 ? particle.age / particle.lifetime : 1;
    for (const animator of this.animators) animator.update(particle, normalizedAge, dt);
  }
}
const curve = (a: number, b: number): CurveRange => new CurveRange(
  new OptimizedCurve([{ time: 0, value: a }, { time: 1, value: b }]),
  new OptimizedCurve([{ time: 0, value: a }, { time: 1, value: b }]), 0,
);
export function runLesson(): string[] {
  const particle: Particle = { age: 0.25, lifetime: 1, velocity: [2, 0, 0], size: 1, color: [1, 1, 1, 1] };
  const system = new ParticleSystem3D([
    new ForceOvertime([curve(-4, 0), curve(0, 0), curve(0, 0)]),
    new VelocityOvertime([curve(1, 3), curve(0, 2), curve(0, 0)], [false, true, true]),
    new SizeOvertime(curve(0.5, 1.5)),
    new ColorOvertime(new GradientRange([
      { time: 0, color: [1, 1, 1, 1] }, { time: 0.5, color: [1, 0.3, 0, 0.8] }, { time: 1, color: [0.2, 0.1, 0.05, 0] },
    ])),
  ]);
  system.updateParticle(particle, 0.25);
  return [
    `normalized age = ${(particle.age / particle.lifetime).toFixed(2)}`,
    `velocity after force(X) + velocity-over-time(YZ) = (${particle.velocity.map((v) => v.toFixed(2)).join(",")})`,
    `size over lifetime = ${particle.size.toFixed(2)}`,
    `gradient color RGBA = (${particle.color.map((v) => v.toFixed(2)).join(",")})`,
    "module order matters: ForceOvertime integrates acceleration into velocity, then VelocityOvertime can replace velocity; later modules update size/color for renderer consumption",
    "source boundary: mirrors the specialized modules in particle/animator/; range randomness and packed optimized-curve internals are reduced to deterministic scalar samples",
  ];
}
