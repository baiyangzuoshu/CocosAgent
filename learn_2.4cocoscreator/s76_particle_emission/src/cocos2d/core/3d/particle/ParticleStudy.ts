type Vec3 = [number, number, number];
type Particle = { id: number; position: Vec3; direction: Vec3; speed: number; lifetime: number; age: number };
type Random = () => number;
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed >>> 0; }
  next: Random = () => { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 0x100000000; };
}
interface ShapeModule { sample(random: Random): { position: Vec3; direction: Vec3 } }
class BoxShape implements ShapeModule {
  constructor(readonly halfExtents: Vec3) {}
  sample(random: Random): { position: Vec3; direction: Vec3 } {
    const position = this.halfExtents.map((extent) => (random() * 2 - 1) * extent) as Vec3;
    const axis = Math.floor(random() * 3);
    const direction: Vec3 = [0, 0, 0]; direction[axis] = random() < 0.5 ? -1 : 1;
    return { position, direction };
  }
}
class SphereShape implements ShapeModule {
  constructor(readonly radius: number) {}
  sample(random: Random): { position: Vec3; direction: Vec3 } {
    const z = random() * 2 - 1, angle = random() * Math.PI * 2;
    const radial = Math.sqrt(1 - z * z);
    const direction: Vec3 = [radial * Math.cos(angle), z, radial * Math.sin(angle)];
    const radius = this.radius * Math.cbrt(random());
    return { position: direction.map((value) => value * radius) as Vec3, direction };
  }
}
class ParticleSystem3D {
  readonly particles: Particle[] = [];
  private emissionRemainder = 0;
  private nextId = 0;
  private readonly random: Random;
  constructor(readonly rateOverTime: number, readonly capacity: number, readonly shape: ShapeModule,
    seed = 1, readonly lifetimeRange: [number, number] = [1, 2], readonly speedRange: [number, number] = [1, 3]) {
    if (capacity <= 0 || rateOverTime < 0) throw new Error("invalid emission settings");
    this.random = new SeededRandom(seed).next;
  }
  emitBurst(count: number): number { return this.emit(Math.min(count, this.capacity - this.particles.length)); }
  update(dt: number): number {
    this.emissionRemainder += this.rateOverTime * dt;
    const requested = Math.floor(this.emissionRemainder);
    const emitted = this.emit(Math.min(requested, this.capacity - this.particles.length));
    this.emissionRemainder -= requested; // capacity overflow is dropped, not queued for a later frame
    return emitted;
  }
  get pendingEmission(): number { return this.emissionRemainder; }
  private emit(count: number): number {
    for (let i = 0; i < count; i++) {
      const sample = this.shape.sample(this.random);
      const lifetime = this.lifetimeRange[0] + this.random() * (this.lifetimeRange[1] - this.lifetimeRange[0]);
      const speed = this.speedRange[0] + this.random() * (this.speedRange[1] - this.speedRange[0]);
      this.particles.push({ id: ++this.nextId, ...sample, speed, lifetime, age: 0 });
    }
    return count;
  }
}
export function runLesson(): string[] {
  const system = new ParticleSystem3D(8, 6, new SphereShape(2), 123, [0.5, 1.5], [2, 4]);
  const burst = system.emitBurst(2);
  const first = system.update(0.1), second = system.update(0.3);
  return [
    `burst=${burst}; rate emissions=${first},${second}; alive=${system.particles.length}/${system.capacity}`,
    `rate fractional remainder=${system.pendingEmission.toFixed(2)}`,
    `particle[0]: pos=${system.particles[0].position.map((v) => v.toFixed(2)).join(",")}; dir=${system.particles[0].direction.map((v) => v.toFixed(2)).join(",")}; life=${system.particles[0].lifetime.toFixed(2)}; speed=${system.particles[0].speed.toFixed(2)}`,
    "source boundary: shape module supplies position/direction; ParticleSystem3D applies rate/burst and random ranges; deterministic PRNG and simplified shapes make this reproducible",
  ];
}
