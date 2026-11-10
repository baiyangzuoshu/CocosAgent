import { Director } from "./cocos2d/core/CCDirector.ts";
import { PhysicsManager } from "./cocos2d/core/physics/CCPhysicsManager.ts";

const output = document.querySelector<HTMLPreElement>("#log")!;
const lines: string[] = [];
const log = (message: string): void => {
  lines.push(message);
  output.textContent = lines.join("\n");
};

const physicsManager = new PhysicsManager(log);
physicsManager.enabledAccumulator = true;
const director = new Director(physicsManager, log);

document.querySelector<HTMLButtonElement>("#enable")!.addEventListener(
  "click",
  () => physicsManager.setEnabled(true),
);
document.querySelector<HTMLButtonElement>("#frame")!.addEventListener(
  "click",
  () => director.mainLoop(0.04),
);
