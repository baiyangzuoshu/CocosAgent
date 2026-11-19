import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const toggle = document.querySelector<HTMLButtonElement>("#toggle-enemy");
const destroyButton = document.querySelector<HTMLButtonElement>("#destroy-enemy");
if (!status || !toggle || !destroyButton) throw new Error("找不到状态区或按钮");
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
  override onDestroy(): void { this.record("onDestroy"); }
}

const scene = new SceneClass("MainScene");
const enemyA = new NodeClass("EnemyA");
const enemyB = new NodeClass("EnemyB");
const logicA = enemyA.addComponent(EnemyLogic);
const logicB = enemyB.addComponent(EnemyLogic);
let destroyRequested = false;
let beforeFlushRecorded = false;
let afterFlushRecorded = false;
let destroyRequest = "尚未请求销毁";
const phaseSnapshots: string[] = [];

const render = (): void => {
  const attached = enemyA.getParent() === scene;
  toggle.disabled = !logicA.started;
  toggle.textContent = attached ? "暂存 EnemyA（仅移除）" : "重新挂载 EnemyA";
  destroyButton.disabled = !logicB.started || destroyRequested || !enemyB.isValid;
  status.textContent = [
    `EnemyA（removeChild(false)）: isValid=${enemyA.isValid}；parent=${enemyA.getParent()?.name ?? "null"}；enabledInHierarchy=${logicA.enabledInHierarchy}`,
    `EnemyA callbacks: ${logicA.events || "等待"}`,
    `EnemyB（destroy）: ${destroyRequest}；isValid=${enemyB.isValid}；parent=${enemyB.getParent()?.name ?? "null"}；enabledInHierarchy=${logicB.enabledInHierarchy}`,
    `EnemyB callbacks: ${logicB.events || "等待"}`,
    "帧阶段快照:",
    ...(phaseSnapshots.length ? phaseSnapshots.map((line, index) => `${index + 1}. ${line}`) : ["等待 destroy 请求"]),
    "移除只改变挂载/激活状态；destroy() 先入队，队列处理后对象才失效。",
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_UPDATE, () => {
  if (!destroyRequested || beforeFlushRecorded) return;
  beforeFlushRecorded = true;
  phaseSnapshots.push(`EVENT_AFTER_UPDATE（刷新队列前）: isValid=${enemyB.isValid}；callbacks=${logicB.events}`);
});
director.on(DirectorClass.EVENT_AFTER_FRAME, () => {
  if (destroyRequested && !afterFlushRecorded) {
    afterFlushRecorded = true;
    phaseSnapshots.push(`EVENT_AFTER_FRAME（课程队列已处理）: isValid=${enemyB.isValid}；callbacks=${logicB.events}`);
  }
  render();
});

toggle.addEventListener("click", () => {
  if (!logicA.started) return;
  if (enemyA.getParent() === scene) {
    scene.removeChild(enemyA, false);
  } else {
    scene.addChild(enemyA);
  }
  render();
});
destroyButton.addEventListener("click", () => {
  if (!logicB.started || destroyRequested || !enemyB.isValid) return;
  const accepted = enemyB.destroy();
  destroyRequested = accepted;
  destroyRequest = `destroy()=${accepted}；调用返回后 isValid=${enemyB.isValid}`;
  render();
});

game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  scene.addChild(enemyA);
  scene.addChild(enemyB);
  render();
});
