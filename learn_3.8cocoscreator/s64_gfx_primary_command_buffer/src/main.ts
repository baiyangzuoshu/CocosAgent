import { WebGL2Device } from "./cocos/gfx/webgl2-device.ts";
import { RenderPipeline } from "./cocos/rendering/render-pipeline.ts";
import { Root } from "./cocos/root.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const device = new WebGL2Device();
const root = new Root(new RenderPipeline(device), device);
root.frameMoveEnd([
  { model: "triangle-model", pipelineState: "opaque-pso", inputAssembler: "triangle-ia", indexCount: 3 },
]);
