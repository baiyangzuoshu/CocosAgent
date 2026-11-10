import { PhysicsManager } from "./physics/CCPhysicsManager.ts";

export class Scheduler {
  constructor(private readonly physicsManager: PhysicsManager) {}

  update(dt: number, log: (message: string) => void): void {
    log("CCScheduler.update(dt=" + dt.toFixed(3) + ")");
    this.physicsManager.update(dt);
  }
}
