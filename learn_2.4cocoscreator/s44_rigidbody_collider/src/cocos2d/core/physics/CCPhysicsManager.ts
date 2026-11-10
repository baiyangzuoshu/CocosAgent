import { DemoBox2DWorld, DemoBody } from "../../../box2d/b2-world.ts";
import type { CCRigidBody } from "./CCRigidBody.ts";
import { BodyType } from "./CCPhysicsTypes.ts";

export const PTM_RATIO = 32;

export class CCPhysicsManager {
  readonly world = new DemoBox2DWorld();

  _addBody(component: CCRigidBody, position: { x: number; y: number }): DemoBody {
    const type = component.type === BodyType.Animated ? BodyType.Kinematic : component.type;
    const body = this.world.CreateBody(
      BodyType[type].toLowerCase(),
      { x: position.x / PTM_RATIO, y: position.y / PTM_RATIO },
      component.log,
    );
    component._setBody(body);
    return body;
  }
}
