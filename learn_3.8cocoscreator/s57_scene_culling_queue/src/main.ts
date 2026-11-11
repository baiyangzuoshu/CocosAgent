import { Camera } from "./cocos/render-scene/scene/camera.ts";
import type { Model } from "./cocos/render-scene/scene/model.ts";
import { RenderPipeline } from "./cocos/rendering/render-pipeline.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  const message = values.join(" ");
  if (output) output.textContent += message + "\n";
  originalLog(...values);
};

const forwardPass = (transparent: boolean, hash: number, depth: number, shaderId: number) => ({
  phase: "forward",
  transparent,
  hash,
  depth,
  shaderId,
});

const models: Model[] = [
  { name: "OpaqueNear", enabled: true, nodeLayer: 0x01, visFlags: 0, inFrustum: true, priority: 0, passes: [forwardPass(false, 4, 2, 2)] },
  { name: "OpaqueFar", enabled: true, nodeLayer: 0x01, visFlags: 0, inFrustum: true, priority: 0, passes: [forwardPass(false, 4, 8, 1)] },
  { name: "GlassNear", enabled: true, nodeLayer: 0x01, visFlags: 0, inFrustum: true, priority: 1, passes: [forwardPass(true, 4, 2, 1)] },
  { name: "GlassFar", enabled: true, nodeLayer: 0x01, visFlags: 0, inFrustum: true, priority: 1, passes: [forwardPass(true, 4, 8, 2)] },
  { name: "HUD", enabled: true, nodeLayer: 0x02, visFlags: 0, inFrustum: true, priority: 0, passes: [forwardPass(false, 1, 0, 1)] },
  { name: "OutsideFrustum", enabled: true, nodeLayer: 0x01, visFlags: 0, inFrustum: false, priority: 0, passes: [forwardPass(false, 1, 1, 1)] },
  { name: "Disabled", enabled: false, nodeLayer: 0x01, visFlags: 0, inFrustum: true, priority: 0, passes: [forwardPass(false, 1, 1, 1)] },
];

new RenderPipeline().render(new Camera("Main", 0x01), models);
