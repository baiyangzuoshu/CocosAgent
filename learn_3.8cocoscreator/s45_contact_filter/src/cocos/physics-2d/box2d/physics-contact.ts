import type { Collider2D } from "../framework/collider-2d.ts";

export class Contact2D {
  disabledOnce = false;

  constructor(
    readonly colliderA: Collider2D,
    readonly colliderB: Collider2D,
  ) {}
}
