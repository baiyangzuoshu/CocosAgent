import cc from "./index.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const toggleParent = document.querySelector<HTMLButtonElement>("#toggle-parent");
const toggleNodeActive = document.querySelector<HTMLButtonElement>("#toggle-node-active");
const toggleComponentEnabled = document.querySelector<HTMLButtonElement>("#toggle-component-enabled");
if (!status || !toggleParent || !toggleNodeActive || !toggleComponentEnabled) {
  throw new Error("找不到状态区或生命周期控制按钮");
}
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) {
  throw new Error("Node/Scene/Component/Director 模块尚未注册");
}

class EnemyLogic extends ComponentClass {
  events = "";
  started = false;
  private updated = false;
  private record(event: string): void { this.events += `${this.events ? " → " : ""}${event}`; }
  override onLoad(): void { this.record("onLoad"); }
  override onEnable(): void { this.record("onEnable"); }
  override onDisable(): void { this.record("onDisable"); }
  override start(): void { this.started = true; this.record("start"); }
  override update(): void {
    if (!this.updated) {
      this.updated = true;
      this.record("update");
    }
  }
}

const scene = new SceneClass("MainScene");
const prefabData = new NodeClass("Enemy");
prefabData.addComponent(EnemyLogic);
const prefab = new Prefab(prefabData);
const enemyA = instantiate(prefab);
const enemyB = instantiate(prefab);
const logicA = enemyA._components[0] as EnemyLogic;
const logicB = enemyB._components[0] as EnemyLogic;
let lastOperation = "等待首次 update；之后可分别切换三种状态";

const render = (): void => {
  const attached = enemyA.getParent() === scene;
  toggleParent.disabled = !logicA.started;
  toggleNodeActive.disabled = !logicA.started;
  toggleComponentEnabled.disabled = !logicA.started;
  toggleParent.textContent = attached ? "移出场景（保留实例）" : "重新挂载 EnemyA";
  toggleNodeActive.textContent = enemyA.active ? "设 Node.active = false" : "设 Node.active = true";
  toggleComponentEnabled.textContent = logicA.enabled ? "设 Component.enabled = false" : "设 Component.enabled = true";
  status.textContent = [
    `最近操作: ${lastOperation}`,
    `Node: parent=${enemyA.getParent()?.name ?? "null"}；active=${enemyA.active}；activeInHierarchy=${enemyA.activeInHierarchy}`,
    `Component: enabled=${logicA.enabled}；enabledInHierarchy=${logicA.enabledInHierarchy}`,
    `EnemyA callbacks: ${logicA.events || "等待"}`,
    `EnemyB（未操作对照）callbacks: ${logicB.events || "等待"}`,
    `EnemyA.isValid: ${enemyA.isValid}`,
    "active 控制节点自身；enabled 控制组件自身；挂载状态影响 activeInHierarchy。观察 onEnable/onDisable 的变化与 onLoad/start 不重复。",
  ].join("\n");
};

toggleParent.addEventListener("click", () => {
  if (!logicA.started) return;
  if (enemyA.getParent() === scene) {
    scene.removeChild(enemyA, false);
    lastOperation = "removeChild(enemyA, false)：离开活动层级，保留对象";
  } else {
    scene.addChild(enemyA);
    lastOperation = "scene.addChild(enemyA)：回到活动层级";
  }
  render();
});
toggleNodeActive.addEventListener("click", () => {
  if (!logicA.started) return;
  enemyA.active = !enemyA.active;
  lastOperation = `切换 Node.active → ${enemyA.active}`;
  render();
});
toggleComponentEnabled.addEventListener("click", () => {
  if (!logicA.started) return;
  logicA.enabled = !logicA.enabled;
  lastOperation = `切换 Component.enabled → ${logicA.enabled}`;
  render();
});

director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  scene.addChild(enemyA);
  scene.addChild(enemyB);
  render();
});
