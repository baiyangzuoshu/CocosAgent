import CCDirector from "./cocos2d/core/CCDirector.ts";
import CCNode from "./cocos2d/core/CCNode.ts";
import CCActionManager from "./cocos2d/actions/CCActionManager.ts";
import {
  CCRepeat,
  CCReverseTime,
} from "./cocos2d/actions/CCActionInterval.ts";
import CCProgressAction from "./cocos2d/actions/CCProgressAction.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const elapsed = requireElement<HTMLSpanElement>("#elapsed");
const runningCount = requireElement<HTMLSpanElement>("#running-count");
const repeatLabel = requireElement<HTMLSpanElement>("#repeat-index");

const bars = {
  linear: requireElement<HTMLDivElement>("#linear-bar"),
  ease: requireElement<HTMLDivElement>("#ease-bar"),
  repeat: requireElement<HTMLDivElement>("#repeat-bar"),
  reverse: requireElement<HTMLDivElement>("#reverse-bar"),
};

const director = new CCDirector();
const node = new CCNode("Demo", director);
const actionManager: CCActionManager = director.getActionManager();

function writeBar(bar: HTMLDivElement, progress: number): void {
  bar.style.width = (Math.max(0, Math.min(1, progress)) * 100).toFixed(0) + "%";
}

const linear = new CCProgressAction(1.2, (progress) => writeBar(bars.linear, progress));
const easeIn = new CCProgressAction(
  1.2,
  (progress) => writeBar(bars.ease, progress),
  (progress) => progress * progress,
);
const repeat = new CCRepeat(
  new CCProgressAction(0.4, (progress) => writeBar(bars.repeat, progress)),
  3,
);
const reverse = new CCReverseTime(
  new CCProgressAction(1.2, (progress) => writeBar(bars.reverse, progress)),
);

node.runAction(linear);
node.runAction(easeIn);
node.runAction(repeat);
node.runAction(reverse);

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.mainLoop(dt);

  elapsed.textContent = (linear.progress * 1.2).toFixed(2) + " / 1.20 秒";
  repeatLabel.textContent = repeat.currentIteration + " / 3";
  runningCount.textContent = String(actionManager.runningActionCount);
  if (actionManager.runningActionCount > 0) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
