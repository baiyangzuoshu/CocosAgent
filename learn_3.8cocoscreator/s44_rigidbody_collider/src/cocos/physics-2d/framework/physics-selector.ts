import { b2RigidBody2D } from "../box2d/rigid-body.ts";
import { b2BoxShape } from "../box2d/shapes/box-shape-2d.ts";

export function createRigidBody(log: (message: string) => void): b2RigidBody2D {
  log("PhysicsSelector.createRigidBody：选择 Box2D 实现");
  return new b2RigidBody2D(log);
}

export function createShape(type: string, log: (message: string) => void): b2BoxShape {
  log(`PhysicsSelector.createShape(${type})：选择 Box2D box shape`);
  return new b2BoxShape(log);
}
