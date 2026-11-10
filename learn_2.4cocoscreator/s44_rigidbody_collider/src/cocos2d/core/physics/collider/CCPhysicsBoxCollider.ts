import { CCPhysicsCollider } from "./CCPhysicsCollider.ts";
import { DemoPolygonShape } from "../../../../box2d/b2-world.ts";
import { PTM_RATIO } from "../CCPhysicsManager.ts";

export class CCPhysicsBoxCollider extends CCPhysicsCollider {
  readonly size = { width: 40, height: 24 };

  protected override _createShape() {
    return new DemoPolygonShape().SetAsBox(
      this.size.width / 2 / PTM_RATIO * Math.abs(this.node.scale.x),
      this.size.height / 2 / PTM_RATIO * Math.abs(this.node.scale.y),
    );
  }
}
