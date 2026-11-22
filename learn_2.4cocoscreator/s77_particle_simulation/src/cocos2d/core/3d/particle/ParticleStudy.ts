type Vec3 = [number, number, number];
type Particle = { id: number; age: number; lifetime: number; position: Vec3; velocity: Vec3; rotation: number; alive: boolean };
class ParticlePool {
  private readonly free: Particle[] = [];
  acquire(id: number): Particle { return this.free.pop() ?? { id, age: 0, lifetime: 1, position: [0, 0, 0], velocity: [0, 0, 0], rotation: 0, alive: false }; }
  release(particle: Particle): void { particle.alive = false; this.free.push(particle); }
  get size(): number { return this.free.length; }
}
class ParticleSystem3D {
  private readonly alive: Particle[] = [];
  private readonly pool = new ParticlePool();
  private nextId = 0;
  constructor(readonly gravity: Vec3, readonly drag: number, initial: Array<Omit<Particle, "alive">>) {
    this.nextId = Math.max(0, ...initial.map((particle) => particle.id));
    for (const particle of initial) this.alive.push({ ...particle, position: [...particle.position], velocity: [...particle.velocity], alive: true });
  }
  private updateOne(particle: Particle, dt: number): boolean {
    particle.age += dt;
    // Semi-implicit Euler: forces alter velocity before position integration.
    for (let axis = 0; axis < 3; axis++) {
      particle.velocity[axis] += this.gravity[axis] * dt;
      particle.velocity[axis] *= Math.max(0, 1 - this.drag * dt);
      particle.position[axis] += particle.velocity[axis] * dt;
    }
    particle.rotation += dt * 90;
    return particle.age < particle.lifetime;
  }
  update(dt: number): { alive: number; expired: number; pool: number } {
    if (dt <= 0) return { alive: this.alive.length, expired: 0, pool: this.pool.size };
    let expired = 0;
    for (let i = this.alive.length - 1; i >= 0; i--) {
      const particle = this.alive[i];
      if (this.updateOne(particle, dt)) continue;
      this.alive.splice(i, 1); this.pool.release(particle); expired++;
    }
    return { alive: this.alive.length, expired, pool: this.pool.size };
  }
  spawn(position: Vec3, velocity: Vec3, lifetime: number): Particle {
    const particle = this.pool.acquire(++this.nextId);
    particle.age = 0; particle.lifetime = lifetime; particle.position = [...position]; particle.velocity = [...velocity]; particle.rotation = 0; particle.alive = true;
    this.alive.push(particle); return particle;
  }
  get particles(): readonly Particle[] { return this.alive; }
}
export function runLesson(): string[] {
  const system = new ParticleSystem3D([0, -9.8, 0], 0.1, [
    { id: 1, age: 0.4, lifetime: 1, position: [0, 0, 0], velocity: [2, 0, 0], rotation: 0 },
    { id: 2, age: 0.9, lifetime: 1, position: [1, 0, 0], velocity: [1, 0, 0], rotation: 0 },
  ]);
  const result = system.update(0.2);
  const survivor = system.particles[0];
  const recycled = system.spawn([5, 0, 0], [0, 1, 0], 2);
  return [
    `step: alive=${result.alive}, expired=${result.expired}, recycled pool=${result.pool}`,
    `survivor id=${survivor.id}; age=${survivor.age.toFixed(2)}; p=(${survivor.position.map((v) => v.toFixed(2)).join(",")}); v=(${survivor.velocity.map((v) => v.toFixed(2)).join(",")})`,
    `spawn after expiry reuses particle record id=${recycled.id}; alive count=${system.particles.length}`,
    "source boundary: real ParticleSystem3D dispatches animator modules and maintains alive particle storage; this example shows ordering, gravity/drag integration and recycling only",
  ];
}
