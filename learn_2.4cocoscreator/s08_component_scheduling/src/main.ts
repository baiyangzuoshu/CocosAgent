import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const toggleActive = document.querySelector<HTMLButtonElement>("#toggle-active");
if (!status || !toggleActive) throw new Error("找不到状态节点或启停按钮");

const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) {
  throw new Error("引擎模块尚未完成注册");
}

class PlayerComponent extends ComponentClass {
  readonly events: string[] = [];
  readonly firstSchedule: string[] = [];
  private firstUpdateSeen = false;

  override onLoad(): void { this.events.push("onLoad"); }
  override onEnable(): void { this.events.push("onEnable"); }
  override onDisable(): void { this.events.push("onDisable"); }
  override start(): void {
    this.events.push("start");
    this.firstSchedule.push("start");
  }
  override update(deltaTime: number): void {
    const event = `update(${deltaTime.toFixed(3)})`;
    this.events.push(event);
    if (!this.firstUpdateSeen) {
      this.firstUpdateSeen = true;
      this.firstSchedule.push("update");
    }
  }
  override lateUpdate(deltaTime: number): void {
    const event = `lateUpdate(${deltaTime.toFixed(3)})`;
    this.events.push(event);
    if (this.firstSchedule.includes("update") && !this.firstSchedule.includes("lateUpdate")) {
      this.firstSchedule.push("lateUpdate");
    }
  }
}

const scene = new SceneClass("MainScene");
const player = new NodeClass("Player");
const component = player.addComponent(PlayerComponent);
scene.addChild(player);

const render = (): void => {
  const hasStarted = component.firstSchedule.includes("start");
  toggleActive.disabled = !hasStarted;
  toggleActive.textContent = player.active ? "停用节点调度" : "重新启用节点调度";
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `Player.active: ${player.active}`,
    `首次调度阶段（持续保留）: ${component.firstSchedule.join(" → ") || "等待"}`,
    `最近回调: ${component.events.slice(-6).join(" → ")}`,
    "每帧顺序: start（一次）→ update → lateUpdate",
  ].join("\n");
};

toggleActive.addEventListener("click", () => {
  player.active = !player.active;
  render();
});

director.on(DirectorClass.EVENT_AFTER_UPDATE, render);
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
