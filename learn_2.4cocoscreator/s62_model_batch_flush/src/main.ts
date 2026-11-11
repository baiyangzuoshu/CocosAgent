import { Material, type RenderItem } from "./cocos2d/core/components/render-component.ts";
import { RenderFlow } from "./cocos2d/core/renderer/render-flow.ts";
import { ModelBatcher } from "./cocos2d/core/renderer/webgl/model-batcher.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const common = new Material("common", 1);
const tinted = new Material("tinted", 2);
const items: RenderItem[] = [
  { name: "sprite-a", material: common, cullingMask: 1 },
  { name: "sprite-b", material: common, cullingMask: 1 },
  { name: "sprite-c", material: common, cullingMask: 1 },
  { name: "sprite-d", material: tinted, cullingMask: 1 },
  { name: "sprite-e", material: tinted, cullingMask: 2 },
];

// The real WebGL MeshBuffer limit is 65535 vertices; use 8 here to expose the overflow flush.
new RenderFlow(new ModelBatcher(8)).render(items);
