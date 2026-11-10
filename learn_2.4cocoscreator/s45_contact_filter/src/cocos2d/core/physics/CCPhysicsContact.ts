import type { PhysicsCollider } from "./collider/CCPhysicsCollider.ts";

export class PhysicsContact {
  disabledOnce = false;

  constructor(
    readonly colliderA: PhysicsCollider,
    readonly colliderB: PhysicsCollider,
  ) {}
}
