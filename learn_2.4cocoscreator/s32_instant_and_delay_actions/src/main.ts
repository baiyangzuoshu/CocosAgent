import CCDirector from "./cocos2d/core/CCDirector.ts";
import CCNode from "./cocos2d/core/CCNode.ts";
import { CCCallFunc } from "./cocos2d/actions/CCActionInstant.ts";
import { CCDelayTime } from "./cocos2d/actions/CCActionInterval.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const callbackState = requireElement<HTMLSpanElement>("#callback-state");
const delayState = requireElement<HTMLSpanElement>("#delay-state");
const delayBar = requireElement<HTMLDivElement>("#delay-bar");
const actionCount = requireElement<HTMLSpanElement>("#action-count");

const director = new CCDirector();
const node = new CCNode("Demo", director, 0);
const delay = new CCDelayTime(1);

node.runAction(new CCCallFunc(() => {
  callbackState.textContent = "已在首帧 ActionManager.update 中执行";
}));
node.runAction(delay);

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.mainLoop(dt);

  const progress = delay.progress;
  delayBar.style.width = (progress * 100).toFixed(0) + "%";
  delayState.textContent = progress >= 1
    ? "1.00 秒延迟完成"
    : "延迟进度 " + progress.toFixed(2);
  actionCount.textContent = String(director.getActionManager().runningActionCount);

  if (director.getActionManager().runningActionCount > 0) {
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);
