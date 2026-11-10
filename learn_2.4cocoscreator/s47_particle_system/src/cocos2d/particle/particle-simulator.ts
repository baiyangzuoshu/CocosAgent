export interface ParticleData {
  timeToLive: number;
}

export class ParticleSimulator {
  readonly particles: ParticleData[] = [];

  constructor(readonly system: { totalParticles: number }) {}
}
