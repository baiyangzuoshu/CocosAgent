import type { Node } from "../../../Node.ts";
import { ERigidBody2DType } from "../physics-types.ts";
import type { PhysicsSystem2D } from "../physics-system.ts";
import type { b2RigidBody2D } from "../../box2d/rigid-body.ts";
import { createRigidBody } from "../physics-selector.ts";

export class RigidBody2D {
  node!: Node;
  impl: b2RigidBody2D | null = null;

  constructor(
    readonly type: ERigidBody2DType,
    private readonly system: PhysicsSystem2D,
    readonly log: (message: string) => void,
  ) {}

  get typeName(): string {
    return ERigidBody2DType[this.type].toLowerCase();
  }

  onLoad(): void {
    this.impl = createRigidBody(this.log);
    this.impl.initialize(this);
  }

  onEnable(): void {
    this.impl?.onEnable(this.system);
  }
}
