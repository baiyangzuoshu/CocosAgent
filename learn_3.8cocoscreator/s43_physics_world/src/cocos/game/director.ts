import { PhysicsSystem2D } from "../physics-2d/framework/physics-system.ts";

type DirectorSystem = {
  id: string;
  update(dt: number): void;
  postUpdate(dt: number): void;
};

export class Director {
  private systems: DirectorSystem[] = [];

  constructor(private readonly log: (message: string) => void) {}

  registerSystem(system: DirectorSystem): void {
    this.systems.push(system);
    this.log("Director.registerSystem(" + system.id + ", SystemPriority.LOW)");
  }

  mainLoop(dt: number): void {
    this.log("Director：component update");
    for (const system of this.systems) system.update(dt);
    this.log("Director：component lateUpdate");
    this.log("Director：AFTER_UPDATE");
    for (const system of this.systems) system.postUpdate(dt);
    this.log("Director：render");
  }
}
