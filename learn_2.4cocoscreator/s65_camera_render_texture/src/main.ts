import { RenderTexture } from "./cocos2d/core/assets/CCRenderTexture.ts";
import { Camera } from "./cocos2d/core/camera/CCCamera.ts";
import { Device } from "./cocos2d/renderer/gfx/device.ts";
import { BaseRenderer } from "./cocos2d/renderer/core/base-renderer.ts";
import { ForwardRenderer } from "./cocos2d/renderer/renderers/forward-renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const target = new RenderTexture();
target.initWithSize(320, 180);
const camera = new Camera();
camera.targetTexture = target;

const device = new Device();
new ForwardRenderer(new BaseRenderer(device)).renderCamera(camera);
device.sampleTexture(target.texture);
