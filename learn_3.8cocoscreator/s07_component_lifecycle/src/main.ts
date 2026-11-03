import { Component, Director, director, game, Node, Scene } from "./exports/base.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

class PlayerComponent extends Component {
  readonly events: string[] = [];

  override onLoad(): void {
    this.events.push("onLoad");
  }

  override onEnable(): void {
    this.events.push("onEnable");
  }

  override onDisable(): void {
    this.events.push("onDisable");
  }
}

const scene = new Scene("MainScene");
const player = new Node("Player");
const component = player.addComponent(PlayerComponent);
scene.addChild(player);

const render = (): void => {
  status.textContent = [
    `Player.activeInHierarchy: ${player.activeInHierarchy}`,
    `回调顺序: ${component.events.join(" → ")}`,
    "onLoad 只在首次激活时调用；停用再启用会重复 onEnable。",
  ].join("\n");
};

director.on(Director.EVENT_AFTER_UPDATE, render);
await game.init({});
director.runSceneImmediate(scene);
player.active = false;
player.active = true;
game.run();
render();
