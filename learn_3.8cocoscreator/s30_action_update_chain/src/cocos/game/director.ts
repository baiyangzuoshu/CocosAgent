export interface DirectorSystem {
  update(dt: number): void;
}

export default class Director {
  private readonly systems: DirectorSystem[] = [];

  constructor(private readonly report: (message: string) => void) {}

  registerSystem(system: DirectorSystem): void {
    this.systems.push(system);
  }

  tick(dt: number): void {
    this.report("Director.tick");
    for (const system of this.systems) system.update(dt);
  }
}
