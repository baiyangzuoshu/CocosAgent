import type { CCNode } from "../CCNode.ts";
import { CCPhysicsManager } from "./CCPhysicsManager.ts";
import type { DemoBody } from "../../../box2d/b2-world.ts";
import { BodyType } from "./CCPhysicsTypes.ts";

export class CCRigidBody {
  node!: CCNode;
  private body: DemoBody | null = null;

  constructor(
    readonly type: BodyType = BodyType.Dynamic,
    readonly log: (message: string) => void,
  ) {}

  __init(manager: CCPhysicsManager): void {
    this.log(`RigidBody.__init：读取节点 ${this.node.name} 的世界坐标`);
    this.body = manager._addBody(this, this.node.worldPosition);
  }

  _setBody(body: DemoBody): void {
    this.body = body;
  }

  _getBody(): DemoBody | null {
    return this.body;
  }
}
