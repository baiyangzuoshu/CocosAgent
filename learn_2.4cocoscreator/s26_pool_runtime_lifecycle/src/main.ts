import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const activityButton = document.querySelector<HTMLButtonElement>("#pool-activity-pause");
const cleanupButton = document.querySelector<HTMLButtonElement>("#pool-cleanup-policy");
if (!status || !activityButton || !cleanupButton) throw new Error("找不到状态区或演示按钮");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) {
  throw new Error("Node/Scene/Component/Director 模块尚未注册");
}

let updateCount = 0;
let lifecycle: string[] = [];
class PoolProbe extends ComponentClass {
  started = false;
  override onEnable(): void { lifecycle.push("onEnable"); }
  override onDisable(): void { lifecycle.push("onDisable"); }
  override start(): void { this.started = true; lifecycle.push("start"); }
  override update(): void { updateCount++; }
}
const scene = new SceneClass("PoolScene");
const node = new NodeClass("PoolProbe");
node.addComponent(PoolProbe);
const activityPool = new NodePool<Node>();
let activityStatus = "等待首次 start";
let listenerStatus = "监听器尚未测试";
let eventCount = 0;
let listenerNode: Node | null = null;

const render = (): void => {
  activityButton.disabled = !node.getComponent(PoolProbe)?.started;
  cleanupButton.disabled = !node.getComponent(PoolProbe)?.started || !!listenerNode;
  status.textContent = [
    `节点在池中: ${activityPool.size() > 0}；isValid=${node.isValid}；activeInHierarchy=${node.activeInHierarchy}`,
    `组件 update 次数: ${updateCount}`,
    `组件回调: ${lifecycle.join(" → ") || "等待"}`,
    activityStatus,
    `cleanup 探针回调数: ${eventCount}`,
    listenerStatus,
  ].join("\n");
};

activityButton.addEventListener("click", () => {
  if (activityPool.size() === 0) {
    activityPool.put(node);
    activityStatus = "put：节点离开活动层级，onDisable 后 update 暂停；节点仍有效";
  } else {
    const reused = activityPool.get();
    if (reused) {
      scene.addChild(reused);
      activityStatus = "get + addChild：同一节点重新启用，onEnable 后 update 恢复；start 不重跑";
    }
  }
  render();
});
cleanupButton.addEventListener("click", () => {
  const probe = new NodeClass("ListenerProbe");
  probe.onTouchStart(() => { eventCount++; });
  scene.addChild(probe);
  probe.dispatchTouchStart(0, 0);
  const beforePut = eventCount;
  const pool = new NodePool<Node>();
  pool.put(probe); // NodePool.put uses removeFromParent(false): listener remains.
  const pooledInactive = !probe.activeInHierarchy;
  const reused = pool.get();
  if (!reused) return;
  scene.addChild(reused);
  reused.dispatchTouchStart(0, 0);
  const afterReuse = eventCount;
  reused.removeFromParent(true); // cleanup clears this model's node listeners.
  scene.addChild(reused);
  reused.dispatchTouchStart(0, 0);
  listenerStatus = `put(cleanup=false) 后仍收事件；池内 inactive=${pooledInactive}；入池前/复用后/cleanup 后=${beforePut}/${afterReuse}/${eventCount}`;
  listenerNode = probe;
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  scene.addChild(node);
  render();
});
