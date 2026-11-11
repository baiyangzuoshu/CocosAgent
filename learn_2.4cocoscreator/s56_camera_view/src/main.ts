import { CameraComponent } from "./cocos2d/core/camera/CCCamera.ts";
import { ForwardRenderer } from "./cocos2d/renderer/renderers/forward-renderer.ts";
import { RenderScene } from "./cocos2d/renderer/scene/scene.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  const message = values.join(" ");
  if (output) output.textContent += message + "\n";
  originalLog(...values);
};

const scene = new RenderScene();
new CameraComponent("Main", scene, 0, { x: 0, y: 0, width: 1, height: 1 }).onEnable();
new CameraComponent("Overlay", scene, 10, { x: 0.5, y: 0, width: 0.5, height: 1 }).onEnable();

new ForwardRenderer().render(scene, 960, 640);
