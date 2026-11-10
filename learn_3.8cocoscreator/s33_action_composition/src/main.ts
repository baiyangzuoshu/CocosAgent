import Director from "./cocos/game/director.ts";
import Node from "./cocos/scene-graph/node.ts";
import { CallFunc } from "./cocos/tween/actions/action-instant.ts";
import {
  DelayTime,
  Sequence,
  Spawn,
} from "./cocos/tween/actions/action-interval.ts";
import TweenSystem from "./cocos/tween/tween-system.ts";

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error("找不到演示节点：" + selector);
  return element;
}

const elapsedLabel = requireElement<HTMLSpanElement>("#elapsed");
const shortState = requireElement<HTMLSpanElement>("#short-state");
const longState = requireElement<HTMLSpanElement>("#long-state");
const groupState = requireElement<HTMLSpanElement>("#group-state");
const eventList = requireElement<HTMLOListElement>("#events");
const progressBar = requireElement<HTMLDivElement>("#progress-bar");

const director = new Director();
const tweenSystem = new TweenSystem();
director.registerSystem(tweenSystem);
const node = new Node("Demo");

function addEvent(message: string): void {
  const item = document.createElement("li");
  item.textContent = message;
  eventList.append(item);
}

const shortBranch = new Sequence([
  new DelayTime(0.25),
  new CallFunc(() => {
    shortState.textContent = "完成";
    addEvent("短分支完成（0.25 秒）");
  }),
]);
const longBranch = new Sequence([
  new DelayTime(0.5),
  new CallFunc(() => {
    longState.textContent = "完成";
    addEvent("长分支完成（0.50 秒）");
  }),
]);
const parallel = new Spawn([shortBranch, longBranch]);
const action = new Sequence([
  parallel,
  new CallFunc(() => {
    groupState.textContent = "完成";
    addEvent("并行组结束，外层序列继续");
  }),
]);
tweenSystem.ActionManager.addAction(action, node);

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.tick(dt);

  elapsedLabel.textContent = action.progress.toFixed(2);
  progressBar.style.width = (action.progress * 100).toFixed(0) + "%";
  if (tweenSystem.ActionManager.runningActionCount > 0) {
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);
