import cc from "./index.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到状态节点 #status");
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

// 在挂载前保存快照；后续生命周期回调只会写入各组件自己的日志。
const beforeMount = [
  `A: parent=${enemyA.getParent()?.name ?? "null"}；Node.active=${enemyA.active}；activeInHierarchy=${enemyA.activeInHierarchy}`,
  `A: Component.enabled=${logicA.enabled}；enabledInHierarchy=${logicA.enabledInHierarchy}；callbacks=${logicA.events || "无"}`,
  `B: parent=${enemyB.getParent()?.name ?? "null"}；callbacks=${logicB.events || "无"}`,
].join("\n");

const render = (): void => {
  status.textContent = [
    "① instantiate 后、挂载前（保存的快照）:",
    beforeMount,
    "",
    "② 加入活动 Scene 后（实时状态）:",
    `A: active=${enemyA.active}；activeInHierarchy=${enemyA.activeInHierarchy}；enabled=${logicA.enabled}；enabledInHierarchy=${logicA.enabledInHierarchy}`,
    `A callbacks: ${logicA.events || "无"}`,
    `B callbacks: ${logicB.events || "无"}`,
    "",
    "首次调度顺序：start → 第一次 update。挂载只触发一次 onLoad；启用组件收到 onEnable。",
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  scene.addChild(enemyA);
  scene.addChild(enemyB);
  render();
});
