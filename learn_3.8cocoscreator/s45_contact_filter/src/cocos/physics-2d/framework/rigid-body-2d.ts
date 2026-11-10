import type { Collider2D } from "./collider-2d.ts";
import type { Contact2D } from "../box2d/physics-contact.ts";

export type ContactType = "begin-contact" | "pre-solve" | "post-solve" | "end-contact";
export type ContactCallback = (
  type: ContactType,
  self: Collider2D,
  other: Collider2D,
  contact: Contact2D,
) => void;

export class RigidBody2D {
  constructor(
    readonly nodeName: string,
    readonly group: number,
    readonly enabledContactListener = false,
  ) {}
}
