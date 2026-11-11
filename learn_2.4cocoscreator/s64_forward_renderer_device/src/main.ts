import { Device } from "./cocos2d/renderer/gfx/device.ts";
import type { DrawItem } from "./cocos2d/renderer/core/base-renderer.ts";
import { ForwardRenderer } from "./cocos2d/renderer/renderers/forward-renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const item: DrawItem = {
  name: "triangle",
  vertexBuffer: "mesh-vb",
  indexBuffer: "mesh-ib",
  program: "sprite-program",
  pass: "opaque-depth",
  assembler: { name: "triangle-ia", indexed: true, indexCount: 3 },
};

new ForwardRenderer(new Device()).renderOpaque([item]);
