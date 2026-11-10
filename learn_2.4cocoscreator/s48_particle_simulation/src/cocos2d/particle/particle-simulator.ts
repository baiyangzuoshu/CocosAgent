export interface ParticleData {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  timeToLive: number;
}

export interface ParticleSettings {
  totalParticles: number;
  life: number;
  emissionRate: number;
  speed: number;
  gravityY: number;
}

class ParticlePool {
  private readonly free: ParticleData[] = [];

  get(): ParticleData {
    return this.free.pop() ?? { x: 0, y: 0, dirX: 0, dirY: 0, timeToLive: 0 };
  }

  put(particle: ParticleData): void {
    particle.x = particle.y = particle.dirX = particle.dirY = particle.timeToLive = 0;
    if (this.free.length < 1024) this.free.push(particle);
  }
}

const pool = new ParticlePool();

export class ParticleSimulator {
  readonly particles: ParticleData[] = [];
  active = false;
  finished = false;
  private emitCounter = 0;

  constructor(readonly system: ParticleSettings) {}

  reset(): void {
    for (const particle of this.particles) pool.put(particle);
    this.particles.length = 0;
    this.emitCounter = 0;
    this.active = true;
    this.finished = false;
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
    this.finished = !this.active && this.particles.length === 0;
  }

  private emitParticle(): void {
    const particle = pool.get();
    particle.timeToLive = Math.max(0, this.system.life);
    particle.dirX = this.system.speed;
    this.particles.push(particle);
  }
}
