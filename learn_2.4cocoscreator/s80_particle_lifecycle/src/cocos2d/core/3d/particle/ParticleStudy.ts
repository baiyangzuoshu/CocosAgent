type Particle = { id: number; age: number; lifetime: number };
type SystemState = "playing" | "paused" | "stopped" | "released";
class ParticleSystem3D {
  private state: SystemState = "playing";
  private particles: Particle[];
  private nextId = 1;
  private emitted = 0;
  private rendererResources = true;
  constructor(particles: Particle[], readonly duration: number, readonly rate: number) { this.particles = particles.map((p) => ({ ...p })); }
  pause(): void { if (this.state === "playing") this.state = "paused"; }
  resume(): void { if (this.state === "paused") this.state = "playing"; }
  stopEmitting(): void { if (this.state === "playing" || this.state === "paused") this.state = "stopped"; }
  stopAndClear(): void { this.particles.length = 0; this.state = "stopped"; }
  update(dt: number): void {
    if (this.state === "paused" || this.state === "released") return;
    if (this.state === "playing" && this.emitted < this.duration * this.rate) {
      this.particles.push({ id: this.nextId++, age: 0, lifetime: 1 }); this.emitted++;
    }
    for (const particle of this.particles) particle.age += dt;
    this.particles = this.particles.filter((particle) => particle.age < particle.lifetime);
    if (this.state !== "playing" && this.particles.length === 0) this.state = "stopped";
  }
  /** Called only when the node/component is destroyed, after any drain period. */
  onDestroy(): void { this.stopAndClear(); this.rendererResources = false; this.state = "released"; }
  snapshot(): { state: SystemState; alive: number; emitted: number; rendererResources: boolean } {
    return { state: this.state, alive: this.particles.length, emitted: this.emitted, rendererResources: this.rendererResources };
  }
}
export function runLesson(): string[] {
  const system = new ParticleSystem3D([{ id: 10, age: 0.4, lifetime: 1 }, { id: 11, age: 0.9, lifetime: 1 }], 0, 10);
  const log: string[] = [];
  system.pause(); system.update(0.4);
  log.push(`pause: ${JSON.stringify(system.snapshot())}`);
  system.resume(); system.stopEmitting();
  for (let i = 0; i < 4; i++) { system.update(0.2); log.push(`drain ${i + 1}: ${JSON.stringify(system.snapshot())}`); }
  system.onDestroy(); log.push(`destroy: ${JSON.stringify(system.snapshot())}`);
  log.push("stop-emitting drains survivors; stop-and-clear is immediate; onDestroy releases renderer-side resources after the component lifetime ends");
  return log;
}
