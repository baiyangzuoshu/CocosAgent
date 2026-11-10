import { DemoPhysicsWorld } from "../box2d/physics-world.ts";
import { PhysicsSelector } from "./physics-selector.ts";

export class PhysicsSystem2D {
  readonly id = "PHYSICS_2D";
  enable = true;
  autoSimulation = true;
  maxSubSteps = 1;
  fixedTimeStep = 1 / 60;
  velocityIterations = 10;
  positionIterations = 10;
  private accumulator = 0;
  private readonly physicsWorld: DemoPhysicsWorld;

  constructor(private readonly log: (message: string) => void) {
    this.physicsWorld = new PhysicsSelector(log).createPhysicsWorld();
  }

  update(_dt: number): void {}

  postUpdate(dt: number): void {
    if (!this.enable || !this.autoSimulation) return;

    this.log("PhysicsSystem2D.postUpdate");
    this.physicsWorld.syncSceneToPhysics(this.log);
    this.accumulator += dt;

    let substepIndex = 0;
    while (
      substepIndex++ < this.maxSubSteps &&
      this.accumulator > this.fixedTimeStep
    ) {
      this.physicsWorld.step(
        this.fixedTimeStep,
        this.velocityIterations,
        this.positionIterations,
        this.log,
      );
      this.accumulator -= this.fixedTimeStep;
    }

    this.physicsWorld.syncPhysicsToScene(this.log);
    this.log("accumulator=" + this.accumulator.toFixed(4));
  }
}
