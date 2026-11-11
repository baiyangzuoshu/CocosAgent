import { CCDirector } from "./cocos2d/core/CCDirector.ts";
import { instantiate } from "./cocos2d/core/3d/physics/framework/physics-selector.ts";
import { CannonWorld } from "./cocos2d/core/3d/physics/cannon/cannon-world.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const write = (message: string): void => {
  if (output) output.textContent += message + "\n";
  console.log(message);
};

instantiate(() => new CannonWorld(write));

const director = new CCDirector(write);
director.sharedInit(true);

const physics = director.getPhysics3DManager();
if (physics) {
  physics.enabled = true;
  director.mainLoop(1 / 30);
  director.mainLoop(1 / 30);
}
