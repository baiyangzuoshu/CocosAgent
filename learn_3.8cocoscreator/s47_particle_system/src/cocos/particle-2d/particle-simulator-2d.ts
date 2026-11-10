export interface Particle2D {
  timeToLive: number;
}

export class ParticleSimulator2D {
  readonly particles: Particle2D[] = [];

  constructor(readonly system: { totalParticles: number }) {}
}
