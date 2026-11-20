import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

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
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `首次调度阶段（持续保留）: ${component.firstSchedule.join(" → ") || "等待"}`,
    `最近回调: ${component.events.slice(-6).join(" → ")}`,
    "每帧顺序: start（一次）→ update → lateUpdate",
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_UPDATE, render);
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
