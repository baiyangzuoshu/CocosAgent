import { CCEventManager } from "./cocos2d/core/event-manager/CCEventManager.ts";
import { CCInputManager } from "./cocos2d/core/platform/CCInputManager.ts";
import type { InputPoint } from "./cocos2d/core/platform/input-point.ts";
import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!status) throw new Error("找不到状态节点 #status");
if (!canvas) throw new Error("找不到画布 #game");

const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const game = cc.game;
const director = cc.director;
if (!NodeClass || !SceneClass || !game || !director) {
  throw new Error("节点/场景/主循环模块尚未完成注册");
}

const scene = new SceneClass("InputScene");
const target = new NodeClass("HitTarget");
target.setPosition(0, 0);
scene.addChild(target);

const eventManager = new CCEventManager();
eventManager.addListener(target);
let callbackResult = "尚未触发目标回调";
target.onTouchStart(() => { callbackResult = "HitTarget 收到 touch-start 回调"; });

const onInput = (point: InputPoint): void => {
  // s14 已演示 client → canvas backing-store；本课从 backing-store 点开始讲命中。
  const worldX = point.x - canvas.width / 2;
  const worldY = point.y - canvas.height / 2;
  const targetPosition = target.getWorldPosition();
  const dx = Math.abs(worldX - targetPosition.x);
  const dy = Math.abs(worldY - targetPosition.y);
  const insideAabb = target.activeInHierarchy && dx <= 28 && dy <= 28;
  const hit = eventManager.dispatchTouchStart(worldX, worldY);
  if (!hit) callbackResult = "本次未命中；没有派发 touch-start";

  status.textContent = [
    `输入: ${point.source}，id=${point.id}`,
    `Backing-store 点: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})，尺寸=${canvas.width}×${canvas.height}`,
    `中心原点世界点: (${worldX.toFixed(1)}, ${worldY.toFixed(1)})`,
    `HitTarget 世界中心: (${targetPosition.x.toFixed(1)}, ${targetPosition.y.toFixed(1)})`,
    `本课 AABB 检查: |dx|=${dx.toFixed(1)}≤28 且 |dy|=${dy.toFixed(1)}≤28；activeInHierarchy=${target.activeInHierarchy}；预测=${insideAabb ? "命中" : "未命中"}`,
    `CCEventManager.dispatchTouchStart: ${hit ? "命中并派发" : "无目标命中"}`,
    `回调结果: ${callbackResult}`,
  ].join("\n");
};

new CCInputManager().registerSystemEvent(canvas, onInput);
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
