import { DemoPhysicsWorld } from "../box2d/physics-world.ts";

export class PhysicsSelector {
  constructor(private readonly log: (message: string) => void) {}

  createPhysicsWorld(): DemoPhysicsWorld {
    this.log("PhysicsSelector.createPhysicsWorld -> selected 2D backend");
    return new DemoPhysicsWorld();
  }
}
