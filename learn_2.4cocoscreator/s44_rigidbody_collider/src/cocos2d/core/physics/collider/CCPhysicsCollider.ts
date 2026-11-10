import type { CCNode } from "../../CCNode.ts";
import { CCRigidBody } from "../CCRigidBody.ts";
import type { DemoShape } from "../../../../box2d/b2-world.ts";

export class CCPhysicsCollider {
  node!: CCNode;
  density = 1;
  friction = 0.2;
  restitution = 0;

  constructor(readonly log: (message: string) => void) {}

  __init(): void {
    const body = this.node.getComponent(CCRigidBody)?._getBody();
    if (!body) throw new Error("同节点必须先初始化 RigidBody");

    const shape = this._createShape();
    this.log(`PhysicsCollider.__init：${this.node.name} 的碰撞形状`);
    body.CreateFixture({ shape, density: this.density, friction: this.friction, restitution: this.restitution }, this.log);
  }

  protected _createShape(): DemoShape {
    throw new Error("具体 collider 负责生成形状");
  }
}
