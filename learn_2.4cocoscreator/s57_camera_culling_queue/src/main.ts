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
scene.models.push(
  { name: "Player", cullingMask: 0x01, stages: ["opaque"], cameraDepth: 3 },
  { name: "GlassNear", cullingMask: 0x01, stages: ["transparent"], cameraDepth: 2 },
  { name: "GlassFar", cullingMask: 0x01, stages: ["transparent"], cameraDepth: 9 },
  { name: "HUD", cullingMask: 0x02, stages: ["opaque"], cameraDepth: 0 },
  { name: "DebugOnly", cullingMask: 0x04, stages: ["opaque"], cameraDepth: 1 },
);

new CameraComponent("Main", scene, 0x01, ["opaque", "transparent"]);
new CameraComponent("Overlay", scene, 0x02, ["opaque"]);

const renderer = new ForwardRenderer();
for (const camera of scene.cameras) renderer.renderCamera(scene, camera);
