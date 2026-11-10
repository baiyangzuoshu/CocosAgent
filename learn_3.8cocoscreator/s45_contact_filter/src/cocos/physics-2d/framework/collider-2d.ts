import type { ContactCallback, RigidBody2D } from "./rigid-body-2d.ts";
import type { PhysicsSystem2D } from "./physics-system.ts";

export class Collider2D {
  readonly listeners: ContactCallback[] = [];

  constructor(
    readonly name: string,
    readonly group: number,
    readonly body: RigidBody2D,
    readonly system: PhysicsSystem2D,
  ) {}

  emit(type: Parameters<ContactCallback>[0], self: this, other: Collider2D, contact: Parameters<ContactCallback>[3]): void {
    for (const listener of this.listeners) listener(type, self, other, contact);
  }
}
