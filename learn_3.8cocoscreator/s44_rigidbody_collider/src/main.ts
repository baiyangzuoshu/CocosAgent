import { Node } from "./cocos/Node.ts";
import { PhysicsSystem2D } from "./cocos/physics-2d/framework/physics-system.ts";
import { ERigidBody2DType } from "./cocos/physics-2d/framework/physics-types.ts";
import { RigidBody2D } from "./cocos/physics-2d/framework/components/rigid-body-2d.ts";
import { BoxCollider2D } from "./cocos/physics-2d/framework/components/colliders/box-collider-2d.ts";

const output = document.querySelector<HTMLPreElement>("#log")!;
const log = (message: string): void => { output.textContent += `${message}\n`; };
const system = new PhysicsSystem2D(log);

function addPhysicsNode(name: string, y: number, type: ERigidBody2DType): void {
  const node = new Node(name, { x: 160, y });
  const body = node.addComponent(new RigidBody2D(type, system, log));
  const collider = node.addComponent(new BoxCollider2D(system, log));
  body.onLoad();
  body.onEnable();
  collider.onLoad();
  collider.apply();
}

addPhysicsNode("ground", 0, ERigidBody2DType.Static);
addPhysicsNode("crate", 96, ERigidBody2DType.Dynamic);
