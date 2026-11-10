import CCDirector from "./cocos2d/core/CCDirector.ts";
import CCNode from "./cocos2d/core/CCNode.ts";
import { tween } from "./cocos2d/actions/tween.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const status = requireElement<HTMLPreElement>("#status");
const leftElement = requireElement<HTMLDivElement>("#left-actor");
const rightElement = requireElement<HTMLDivElement>("#right-actor");

const director = new CCDirector();
const left = new CCNode("Left", director, 20);
const right = new CCNode("Right", director, 350);
tween(left).to(2, { x: 220 }).start();
tween(right).to(2, { x: 220 }).start();

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.mainLoop(dt);

  leftElement.style.transform = "translateX(" + left.x + "px)";
  rightElement.style.transform = "translateX(" + right.x + "px)";
  status.textContent = "Left x=" + left.x.toFixed(1) + " → 220; Right x=" +
    right.x.toFixed(1) + " → 220";

  if (director.getActionManager().runningActionCount > 0) {
    requestAnimationFrame(frame);
  } else {
    status.textContent += "；两个节点到达同一绝对终点。";
  }
}
requestAnimationFrame(frame);
