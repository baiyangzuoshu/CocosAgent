import type { Collider2D } from "../../framework/collider-2d.ts";
import type { RigidBody2D } from "../../framework/rigid-body-2d.ts";
import type { PhysicsSystem2D } from "../../framework/physics-system.ts";

export interface B2Filter {
  categoryBits: number;
  maskBits: number;
}

export class B2Shape2D {
  readonly filter: B2Filter;

  constructor(readonly collider: Collider2D, body: RigidBody2D, system: PhysicsSystem2D) {
    const group = collider.group === 1 ? body.group : collider.group;
    this.filter = {
      categoryBits: group,
      maskBits: system.collisionMatrix[group] ?? 0,
    };
  }
}
