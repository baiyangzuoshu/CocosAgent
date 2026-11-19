import { CCEventManager } from "./cocos2d/core/event-manager/CCEventManager.ts";
import { CCInputManager } from "./cocos2d/core/platform/CCInputManager.ts";
import type { InputPoint } from "./cocos2d/core/platform/input-point.ts";
import type { NodeEvent } from "./cocos2d/core/event/event.ts";
import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const canvas = document.querySelector<HTMLCanvasElement>("#game");
const stop = document.querySelector<HTMLInputElement>("#stop");
if (!status) throw new Error("找不到状态节点 #status");
if (!canvas) throw new Error("找不到画布 #game");
if (!stop) throw new Error("找不到选项 #stop");

const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const game = cc.game;
const director = cc.director;
if (!NodeClass || !SceneClass || !game || !director) {
  throw new Error("节点/场景/主循环模块尚未完成注册");
}

const scene = new SceneClass("MainScene");
const branch = new NodeClass("Branch");
const target = new NodeClass("Target");
scene.addChild(branch);
branch.addChild(target);

const eventManager = new CCEventManager();
eventManager.addListener(target);
let route: string[] = [];
const record = (event: NodeEvent): void => {
  route.push(`${event.phase}: target=${event.target.name}, currentTarget=${event.currentTarget.name}`);
};
scene.onTouchStart(record, true);
branch.onTouchStart((event) => {
  record(event);
  if (stop.checked) {
    route.push("Branch 调用 stopPropagation()；不再走向 Target 或更外层节点");
    event.stopPropagation();
  }
}, true);
target.onTouchStart(record);
branch.onTouchStart(record);
scene.onTouchStart(record);

const onInput = (point: InputPoint): void => {
  const worldX = point.x - canvas.width / 2;
  const worldY = point.y - canvas.height / 2;
  route = [];
  const hit = eventManager.dispatchTouchStart(worldX, worldY);
  status.textContent = [
    `输入 backing-store 点: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`,
    `中心原点点: (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`,
    `Target 命中: ${hit ? "是" : "否；没有事件路径"}`,
    "传播记录:",
    ...(route.length ? route.map((line, index) => `${index + 1}. ${line}`) : ["（空）"]),
  ].join("\n");
};

new CCInputManager().registerSystemEvent(canvas, onInput);
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
