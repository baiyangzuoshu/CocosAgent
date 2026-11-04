import { Component, Director, director, game, Node, Scene } from "./exports/base.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

class PlayerComponent extends Component {
  readonly events: string[] = [];

  override onLoad(): void { this.events.push("onLoad"); }
  override onEnable(): void { this.events.push("onEnable"); }
  override start(): void { this.events.push("start"); }
  override update(deltaTime: number): void { this.events.push(`update(${deltaTime.toFixed(3)})`); }
  override lateUpdate(deltaTime: number): void { this.events.push(`lateUpdate(${deltaTime.toFixed(3)})`); }
}

const scene = new Scene("MainScene");
const player = new Node("Player");
const component = player.addComponent(PlayerComponent);
scene.addChild(player);

const render = (): void => {
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `回调: ${component.events.slice(-6).join(" → ")}`,
    "每帧顺序: start（一次）→ update → lateUpdate",
  ].join("\n");
};

director.on(Director.EVENT_AFTER_UPDATE, render);
await game.init({});
director.runSceneImmediate(scene);
game.run();
render();
