import { RigidBody2D } from "./rigid-body-2d.ts";
import { Collider2D } from "./collider-2d.ts";
import { Box2DPhysicsWorld } from "../box2d/physics-world.ts";

export class PhysicsSystem2D {
  readonly collisionMatrix: Record<number, number>;
  readonly physicsWorld: Box2DPhysicsWorld;

  constructor(collisionMatrix: Record<number, number>) {
    this.collisionMatrix = collisionMatrix;
    this.physicsWorld = new Box2DPhysicsWorld(this);
  }

  createCollider(name: string, group: number, body: RigidBody2D): Collider2D {
    return this.physicsWorld.createCollider(name, group, body);
  }
}
