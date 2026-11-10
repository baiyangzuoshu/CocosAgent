import CCDirector from "./cocos2d/core/CCDirector.ts";
import CCNode from "./cocos2d/core/CCNode.ts";
import { CCCallFunc } from "./cocos2d/actions/CCActionInstant.ts";
import {
  CCDelayTime,
  CCSequence,
  CCSpawn,
} from "./cocos2d/actions/CCActionInterval.ts";

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

const director = new CCDirector();
const node = new CCNode("Demo", director);

function addEvent(message: string): void {
  const item = document.createElement("li");
  item.textContent = message;
  eventList.append(item);
}

const shortBranch = new CCSequence(
  new CCDelayTime(0.25),
  new CCCallFunc(() => {
    shortState.textContent = "完成";
    addEvent("短分支完成（0.25 秒）");
  }),
);
const longBranch = new CCSequence(
  new CCDelayTime(0.5),
  new CCCallFunc(() => {
    longState.textContent = "完成";
    addEvent("长分支完成（0.50 秒）");
  }),
);
const parallel = new CCSpawn(shortBranch, longBranch);
const action = new CCSequence(
  parallel,
  new CCCallFunc(() => {
    groupState.textContent = "完成";
    addEvent("并行组结束，外层序列继续");
  }),
);
node.runAction(action);

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(Math.max((now - previousTime) / 1000, 0), 0.1);
  previousTime = now;
  director.mainLoop(dt);

  elapsedLabel.textContent = action.progress.toFixed(2);
  progressBar.style.width = (action.progress * 100).toFixed(0) + "%";
  if (director.getActionManager().runningActionCount > 0) {
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);
