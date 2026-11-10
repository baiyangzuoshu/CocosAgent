import type { PhysicsContact } from "./CCPhysicsContact.ts";
import type { PhysicsCollider } from "./collider/CCPhysicsCollider.ts";

export type ContactCallback = (
  contact: PhysicsContact,
  self: PhysicsCollider,
  other: PhysicsCollider,
) => void;

export class RigidBody {
  readonly components: Array<{
    onBeginContact?: ContactCallback;
    onPreSolve?: ContactCallback;
    onPostSolve?: ContactCallback;
    onEndContact?: ContactCallback;
  }> = [];

  constructor(
    readonly nodeName: string,
    readonly groupIndex: number,
    readonly enabledContactListener = false,
  ) {}
}
