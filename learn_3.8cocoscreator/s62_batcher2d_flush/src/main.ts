import { Batcher2D, type RenderItem } from "./cocos/2d/renderer/batcher-2d.ts";
import type { Material } from "./cocos/2d/renderer/draw-batch.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const shared: Material = { name: "sprite-material" };
const alternate: Material = { name: "custom-material" };
const item = (
  name: string,
  material: Material,
  stencilStage: number,
): RenderItem => ({
  name,
  renderData: { dataHash: 17, indexCount: 6, valid: true },
  material,
  texture: "ui-atlas",
  sampler: "linear-clamp",
  stencilStage,
  layer: 1,
});

const batcher = new Batcher2D();
batcher.commitComp(item("button-icon", shared, 0));
batcher.commitComp(item("button-label", shared, 0));
batcher.commitComp(item("masked-panel", shared, 1));
batcher.commitComp(item("custom-sprite", alternate, 1));
batcher.finishMergeBatches();
console.log("DrawBatch2D count =", batcher.batches.length);
