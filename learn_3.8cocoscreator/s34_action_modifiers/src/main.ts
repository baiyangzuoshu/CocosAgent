import Director from "./cocos/game/director.ts";
import Node from "./cocos/scene-graph/node.ts";
import {
  Repeat,
  ReverseTime,
} from "./cocos/tween/actions/action-interval.ts";
import TweenSystem from "./cocos/tween/tween-system.ts";
import TweenAction from "./cocos/tween/tween-action.ts";

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

const director = new Director();
const tweenSystem = new TweenSystem();
director.registerSystem(tweenSystem);
const node = new Node("Demo");

function writeBar(bar: HTMLDivElement, progress: number): void {
  bar.style.width = (Math.max(0, Math.min(1, progress)) * 100).toFixed(0) + "%";
}

const linear = new TweenAction(1.2, (progress) => writeBar(bars.linear, progress));
const easeIn = new TweenAction(
  1.2,
  (progress) => writeBar(bars.ease, progress),
  (progress) => progress * progress,
);
const repeat = new Repeat(
  new TweenAction(0.4, (progress) => writeBar(bars.repeat, progress)),
  3,
);
const reverse = new ReverseTime(
  new TweenAction(1.2, (progress) => writeBar(bars.reverse, progress)),
);

const manager = tweenSystem.ActionManager;
manager.addAction(linear, node);
manager.addAction(easeIn, node);
manager.addAction(repeat, node);
manager.addAction(reverse, node);

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.tick(dt);

  elapsed.textContent = (linear.progress * 1.2).toFixed(2) + " / 1.20 秒";
  repeatLabel.textContent = repeat.currentIteration + " / 3";
  runningCount.textContent = String(manager.runningActionCount);
  if (manager.runningActionCount > 0) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
