import { RenderTexture } from "./cocos/asset/render-texture.ts";
import { CameraComponent } from "./cocos/misc/camera-component.ts";
import { RenderPipeline } from "./cocos/rendering/render-pipeline.ts";
import { Sprite } from "./cocos/rendering/sprite.ts";
import { Root } from "./cocos/root.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const target = new RenderTexture();
target.initialize("camera-output", 320, 180);
const camera = new CameraComponent();
camera.targetTexture = target;
new Root(new RenderPipeline()).render(camera);
new Sprite().renderTexture(target.getGFXTexture());
