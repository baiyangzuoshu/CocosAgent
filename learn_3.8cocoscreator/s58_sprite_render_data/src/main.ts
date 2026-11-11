import { Sprite } from "./cocos/2d/components/sprite.ts";
import { Batcher2D } from "./cocos/2d/renderer/batcher-2d.ts";
import { uiRendererManager } from "./cocos/2d/framework/ui-renderer-manager.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  const message = values.join(" ");
  if (output) output.textContent += message + "\n";
  originalLog(...values);
};

const sprite = new Sprite();
sprite.setContentSize(80, 40);
uiRendererManager.updateAllDirtyRenderers();
new Batcher2D().commitComp(sprite);
