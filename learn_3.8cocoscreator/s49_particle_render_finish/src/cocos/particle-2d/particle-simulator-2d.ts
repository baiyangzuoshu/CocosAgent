import { MeshRenderData } from "./particle-renderer.ts";

export interface Particle2D {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  timeToLive: number;
}

export interface ParticleSettings2D {
  totalParticles: number;
  life: number;
  emissionRate: number;
  speed: number;
  gravityY: number;
  _finishedSimulation(): void;
}

class ParticlePool2D {
  private readonly free: Particle2D[] = [];

  get(): Particle2D {
    return this.free.pop() ?? { x: 0, y: 0, dirX: 0, dirY: 0, timeToLive: 0 };
  }

  put(particle: Particle2D): void {
    particle.x = particle.y = particle.dirX = particle.dirY = particle.timeToLive = 0;
    if (this.free.length < 1024) this.free.push(particle);
  }
}

const pool = new ParticlePool2D();

export class ParticleSimulator2D {
  readonly particles: Particle2D[] = [];
  active = false;
  finished = false;
  renderData: MeshRenderData | null = null;
  private emitCounter = 0;

  constructor(readonly system: ParticleSettings2D) {}

  setRenderData(data: MeshRenderData): void {
    this.renderData = data;
  }

  reset(): void {
    for (const particle of this.particles) pool.put(particle);
    this.particles.length = 0;
    this.emitCounter = 0;
    this.active = true;
    this.finished = false;
    this.renderData?.clear();
  }

  stop(): void {
    this.active = false;
    this.emitCounter = 0;
  }

  step(dt: number): void {
    const { totalParticles, emissionRate } = this.system;
    if (this.active && emissionRate > 0) {
      const rate = 1 / emissionRate;
      if (this.particles.length < totalParticles) this.emitCounter += dt;
      while (this.particles.length < totalParticles && this.emitCounter > rate) {
        this.emitParticle();
        this.emitCounter -= rate;
      }
    }

    let index = 0;
    while (index < this.particles.length) {
      const particle = this.particles[index];
      particle.timeToLive -= dt;
      if (particle.timeToLive > 0) {
        particle.dirY += this.system.gravityY * dt;
        particle.x += particle.dirX * dt;
        particle.y += particle.dirY * dt;
        index += 1;
      } else {
        this.particles[index] = this.particles[this.particles.length - 1];
        this.particles.pop();
        pool.put(particle);
      }
    }

    const renderData = this.renderData;
    if (renderData) {
      renderData.reset();
      renderData.request(this.particles.length * 4, this.particles.length * 6);
      this.particles.forEach((particle, particleIndex) => renderData.writeQuad(particleIndex, particle.x, particle.y));
      renderData.setRenderDrawInfoAttributes();
    }

    this.finished = !this.active && this.particles.length === 0;
    if (this.finished) this.system._finishedSimulation();
  }

  private emitParticle(): void {
    const particle = pool.get();
    particle.timeToLive = Math.max(0, this.system.life);
    particle.dirX = this.system.speed;
    this.particles.push(particle);
  }
}
