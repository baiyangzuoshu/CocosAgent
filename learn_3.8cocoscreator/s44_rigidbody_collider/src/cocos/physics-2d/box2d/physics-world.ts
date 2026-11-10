import type { b2RigidBody2D } from "./rigid-body.ts";
import { DemoBody } from "./runtime.ts";

export class b2PhysicsWorld {
  readonly groundBody = new DemoBody("static", { x: 0, y: 0 });

  addBody(component: b2RigidBody2D): void {
    component.implBody = new DemoBody(
      component.component.typeName,
      {
        x: component.component.node.worldPosition.x / 32,
        y: component.component.node.worldPosition.y / 32,
      },
    );
    component.log(`b2PhysicsWorld.addBody：${component.component.node.name} -> ${component.component.typeName}`);
  }
}
