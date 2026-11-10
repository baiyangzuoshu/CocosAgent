export interface DirectorSystem {
  update(dt: number): void;
}

export default class Director {
  private readonly systems: DirectorSystem[] = [];

  registerSystem(system: DirectorSystem): void {
    this.systems.push(system);
  }

  tick(dt: number): void {
    for (const system of this.systems) system.update(dt);
  }
}
