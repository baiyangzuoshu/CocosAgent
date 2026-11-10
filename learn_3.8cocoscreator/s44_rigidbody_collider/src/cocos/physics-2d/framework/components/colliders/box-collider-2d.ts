import { Collider2D } from "./collider-2d.ts";

export class BoxCollider2D extends Collider2D {
  override readonly TYPE = "BOX";
  readonly size = { width: 40, height: 24 };
}
