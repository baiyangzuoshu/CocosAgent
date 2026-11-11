import { constructDefaultWorld } from "./physics-selector.ts";
import type { IPhysicsWorld } from "../spec/i-physics-world.ts";

export class PhysicsSystem {
  readonly physicsWorld: IPhysicsWorld;
  enable = true;
  autoSimulation = true;
  fixedTimeStep = 1 / 60;
  maxSubSteps = 2;
  private accumulator = 0;

  constructor(private readonly write: (message: string) => void) {
    this.physicsWorld = constructDefaultWorld();
  }

  postUpdate(deltaTime: number): void {
    if (!this.enable) {
      this.physicsWorld.syncSceneToPhysics();
      return;
    }
    if (!this.autoSimulation) return;

    let subStepCount = 0;
    this.accumulator += deltaTime;
    this.write("BEFORE_PHYSICS");
    while (subStepCount < this.maxSubSteps) {
      if (this.accumulator >= this.fixedTimeStep) {
        this.physicsWorld.syncSceneToPhysics();
        this.physicsWorld.step(this.fixedTimeStep);
        this.physicsWorld.emitEvents();
        this.physicsWorld.syncAfterEvents();
        this.accumulator -= this.fixedTimeStep;
        subStepCount++;
      } else {
        this.physicsWorld.syncSceneToPhysics();
        break;
      }
    }
    this.write("AFTER_PHYSICS; substeps=" + subStepCount + ", remaining=" + this.accumulator.toFixed(4));
  }
}
