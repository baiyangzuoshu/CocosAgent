import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const toggle = document.querySelector<HTMLButtonElement>("#pool-toggle");
const clear = document.querySelector<HTMLButtonElement>("#pool-clear");
if (!status || !toggle || !clear) throw new Error("找不到状态区或按钮");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) throw new Error("引擎模块尚未注册");

class PoolProbe extends ComponentClass {
  events: string[] = [];
  started = false;
  updates = 0;
  private record(name: string): void { this.events.push(name); }
  override onLoad(): void { this.record("onLoad"); }
  override onEnable(): void { this.record("onEnable"); }
  override onDisable(): void { this.record("onDisable"); }
  override start(): void { this.started = true; this.record("start"); }
  override update(): void { this.updates++; }
  override onDestroy(): void { this.record("onDestroy"); }
}
const scene = new SceneClass("PoolScene");
const enemy = new NodeClass("EnemyA");
const probe = enemy.addComponent(PoolProbe);
const pool = new NodePool<Node>();
let lastOperation = "等待首次 start";
const render = (): void => {
  toggle.disabled = !probe.started || !enemy.isValid;
  clear.disabled = pool.size() === 0;
  toggle.textContent = pool.size() ? "取回 EnemyA" : "回收 EnemyA";
  status.textContent = [
    `池大小: ${pool.size()}`,
    `EnemyA.isValid: ${enemy.isValid}`,
    `EnemyA.activeInHierarchy: ${enemy.activeInHierarchy}`,
    `组件 update 次数: ${probe.updates}`,
    `组件回调: ${probe.events.join(" → ") || "等待"}`,
    lastOperation,
    "put 暂存同一节点；get 取回它；clear 才请求销毁池内节点。",
  ].join("\n");
};
toggle.addEventListener("click", () => {
  if (!probe.started || !enemy.isValid) return;
  if (pool.size() === 0) {
    pool.put(enemy);
    lastOperation = "put：节点离开场景，组件收到 onDisable；没有销毁";
  } else {
    const reused = pool.get();
    if (reused) { scene.addChild(reused); lastOperation = `get：取回同一节点=${reused === enemy}`; }
  }
  render();
});
clear.addEventListener("click", () => {
  pool.clear();
  lastOperation = "clear：已调用 destroy()；真实销毁在帧末处理";
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => { director.runSceneImmediate(scene); scene.addChild(enemy); render(); });
