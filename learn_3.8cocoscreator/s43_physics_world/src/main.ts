import { Director } from "./cocos/game/director.ts";
import { PhysicsSystem2D } from "./cocos/physics-2d/framework/physics-system.ts";

const output = document.querySelector<HTMLPreElement>("#log")!;
const lines: string[] = [];
const log = (message: string): void => {
  lines.push(message);
  output.textContent = lines.join("\n");
};

const director = new Director(log);
const physicsSystem = new PhysicsSystem2D(log);
director.registerSystem(physicsSystem);

document.querySelector<HTMLButtonElement>("#frame")!.addEventListener(
  "click",
  () => director.mainLoop(0.04),
);
