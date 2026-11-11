import { CCDirector } from "./cocos/game/director.ts";
import { register } from "./cocos/physics/framework/physics-selector.ts";
import { BulletWorld } from "./cocos/physics/bullet/bullet-world.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const write = (message: string): void => {
  if (output) output.textContent += message + "\n";
  console.log(message);
};

register("bullet", () => new BulletWorld(write));

const director = new CCDirector(write);
director.init();
director.tick(1 / 120);
director.tick(0.04);
