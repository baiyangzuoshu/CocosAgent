import { PhysicsManager } from "./physics/CCPhysicsManager.ts";
import { Scheduler } from "./CCScheduler.ts";

export class Director {
  private readonly scheduler: Scheduler;

  constructor(
    physicsManager: PhysicsManager,
    private readonly log: (message: string) => void,
  ) {
    this.scheduler = new Scheduler(physicsManager);
  }

  mainLoop(dt: number): void {
    this.log("Director：component update");
    this.scheduler.update(dt, this.log);
    this.log("Director：component lateUpdate");
    this.log("Director：render");
  }
}
