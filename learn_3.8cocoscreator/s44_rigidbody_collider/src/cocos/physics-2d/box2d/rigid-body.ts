import type { RigidBody2D } from "../framework/components/rigid-body-2d.ts";
import type { PhysicsSystem2D } from "../framework/physics-system.ts";
import type { DemoBody } from "./runtime.ts";

export class b2RigidBody2D {
  component!: RigidBody2D;
  implBody: DemoBody | null = null;

  constructor(readonly log: (message: string) => void) {}

  initialize(component: RigidBody2D): void {
    this.component = component;
    this.log(`b2RigidBody2D.initialize：挂接组件 ${component.node.name}`);
  }

  onEnable(system: PhysicsSystem2D): void {
    system.physicsWorld.addBody(this);
  }
}
