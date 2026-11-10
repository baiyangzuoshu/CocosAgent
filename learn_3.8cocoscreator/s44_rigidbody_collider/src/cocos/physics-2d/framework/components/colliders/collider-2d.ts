import type { Node } from "../../../../Node.ts";
import type { PhysicsSystem2D } from "../../physics-system.ts";
import { RigidBody2D } from "../rigid-body-2d.ts";
import type { b2BoxShape } from "../../../box2d/shapes/box-shape-2d.ts";
import { createShape } from "../../physics-selector.ts";

export class Collider2D {
  node!: Node;
  body: RigidBody2D | null = null;
  impl: b2BoxShape | null = null;
  density = 1;
  friction = 0.2;
  restitution = 0;
  readonly TYPE: string = "NONE";

  constructor(
    readonly system: PhysicsSystem2D,
    readonly log: (message: string) => void,
  ) {}

  onLoad(): void {
    this.impl = createShape(this.TYPE, this.log);
    this.impl.initialize(this);
    this.body = this.node.getComponent(RigidBody2D);
    this.log(`Collider2D.onLoad：${this.node.name} 同节点刚体 ${this.body ? "已找到" : "未找到，使用 groundBody"}`);
  }

  apply(): void {
    this.impl?.apply(this.system);
  }
}
