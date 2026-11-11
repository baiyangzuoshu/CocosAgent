import { CCSprite } from "./cocos2d/core/components/CCSprite.ts";
import { RenderFlow } from "./cocos2d/core/renderer/render-flow.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  const message = values.join(" ");
  if (output) output.textContent += message + "\n";
  originalLog(...values);
};

const sprite = new CCSprite();
sprite.setContentSize(80, 40);
sprite.setColor("#ffb45a80");
new RenderFlow().render(sprite);
