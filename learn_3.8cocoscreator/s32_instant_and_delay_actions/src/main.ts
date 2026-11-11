import Director from "./cocos/game/director.ts";
import Node from "./cocos/scene-graph/node.ts";
import { CallFunc } from "./cocos/tween/actions/action-instant.ts";
import { DelayTime } from "./cocos/tween/actions/action-interval.ts";
import TweenSystem from "./cocos/tween/tween-system.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const callbackState = requireElement<HTMLSpanElement>("#callback-state");
const delayState = requireElement<HTMLSpanElement>("#delay-state");
const delayBar = requireElement<HTMLDivElement>("#delay-bar");
const actionCount = requireElement<HTMLSpanElement>("#action-count");

const director = new Director();
const tweenSystem = new TweenSystem();
director.registerSystem(tweenSystem);

const node = new Node("Demo", 0);
const delay = new DelayTime(1);
tweenSystem.ActionManager.addAction(new CallFunc(() => {
  callbackState.textContent = "已在首帧 TweenSystem.update 中执行";
}), node);
tweenSystem.ActionManager.addAction(delay, node);

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.tick(dt);

  const progress = delay.progress;
  delayBar.style.width = (progress * 100).toFixed(0) + "%";
  delayState.textContent = progress >= 1
    ? "1.00 秒延迟完成"
    : "延迟进度 " + progress.toFixed(2);
  actionCount.textContent = String(tweenSystem.ActionManager.runningActionCount);

  if (tweenSystem.ActionManager.runningActionCount > 0) {
    requestAnimationFrame(frame);
  } else {
  }
}
requestAnimationFrame(frame);
