import { b2PhysicsWorld } from "../box2d/physics-world.ts";

export class PhysicsSystem2D {
  readonly physicsWorld = new b2PhysicsWorld();
  constructor(readonly log: (message: string) => void) {}
}
