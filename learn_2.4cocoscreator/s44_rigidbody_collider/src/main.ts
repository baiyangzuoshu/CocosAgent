import { CCNode } from "./cocos2d/core/CCNode.ts";
import { CCPhysicsManager } from "./cocos2d/core/physics/CCPhysicsManager.ts";
import { CCRigidBody } from "./cocos2d/core/physics/CCRigidBody.ts";
import { BodyType } from "./cocos2d/core/physics/CCPhysicsTypes.ts";
import { CCPhysicsBoxCollider } from "./cocos2d/core/physics/collider/CCPhysicsBoxCollider.ts";

const output = document.querySelector<HTMLPreElement>("#log")!;
const log = (message: string): void => { output.textContent += `${message}\n`; };
const physicsManager = new CCPhysicsManager();

function addPhysicsNode(name: string, y: number, type: BodyType): void {
  const node = new CCNode(name, { x: 160, y });
  const body = node.addComponent(new CCRigidBody(type, log));
  const collider = node.addComponent(new CCPhysicsBoxCollider(log));
  body.__init(physicsManager);
  collider.__init();
}

addPhysicsNode("ground", 0, BodyType.Static);
addPhysicsNode("crate", 96, BodyType.Dynamic);
