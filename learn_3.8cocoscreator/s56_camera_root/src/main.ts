import { CameraComponent } from "./cocos/misc/camera-component.ts";
import { RenderScene } from "./cocos/render-scene/core/render-scene.ts";
import { RenderWindow } from "./cocos/render-scene/core/render-window.ts";
import { Root } from "./cocos/root.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  const message = values.join(" ");
  if (output) output.textContent += message + "\n";
  originalLog(...values);
};

const root = new Root();
const window = new RenderWindow();
const scene = new RenderScene();
new CameraComponent(root, scene, window, "Overlay", 10, { x: 0.5, y: 0, width: 0.5, height: 1 }).onEnable();
new CameraComponent(root, scene, window, "Main", 0, { x: 0, y: 0, width: 1, height: 1 }).onEnable();

root.frameMove([window]);
