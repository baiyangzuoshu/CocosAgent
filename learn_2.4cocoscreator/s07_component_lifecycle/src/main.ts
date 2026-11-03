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

const scene = new SceneClass("MainScene");
const player = new NodeClass("Player");
const component = player.addComponent(PlayerComponent);
scene.addChild(player);

const render = (): void => {
  status.textContent = [
    `Player.activeInHierarchy: ${player.activeInHierarchy}`,
    `回调顺序: ${component.events.join(" → ")}`,
    "onLoad 只在首次激活时调用；停用再启用会重复 onEnable。",
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_UPDATE, render);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  player.active = false;
  player.active = true;
  render();
});
