import { ProbeAction } from "./cocos2d/actions/CCAction.ts";
import CCDirector from "./cocos2d/core/CCDirector.ts";
import CCNode from "./cocos2d/core/CCNode.ts";
import { tween } from "./cocos2d/actions/tween.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到页面元素：" + selector);
  return element;
}

const button = requireElement<HTMLButtonElement>("#start");
const status = requireElement<HTMLParagraphElement>("#status");
const log = requireElement<HTMLPreElement>("#log");

button.addEventListener("click", () => {
  const lines: string[] = [];
  const report = (message: string): void => {
    lines.push(message);
    log.textContent = lines.join("\n");
  };
  const director = new CCDirector(report);
  const node = new CCNode("ProbeNode");
  const action = new ProbeAction(report, 3);

  log.textContent = "";
  button.disabled = true;
  status.textContent = "ActionManager 中的动作数：1";
  tween(node, director, action).start();

  let previousTime = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
    previousTime = now;
    director.mainLoop(dt);
    const count = director.getActionManager().runningActionCount;
    status.textContent = "ActionManager 中的动作数：" + count;
    if (count > 0) {
      requestAnimationFrame(frame);
    } else {
      status.textContent += "；动作已完成";
      button.disabled = false;
    }
  };

  requestAnimationFrame(frame);
});
