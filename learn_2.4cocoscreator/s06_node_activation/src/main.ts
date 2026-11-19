import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const NodeClass = cc.Node;
const SceneClass = cc.Scene;

if (!NodeClass || !SceneClass) {
  throw new Error("cc.Node 或 cc.Scene 没有完成注册");
}

const scene = new SceneClass("MainScene");
const canvas = new NodeClass("Canvas");
const player = new NodeClass("Player");
const weapon = new NodeClass("Weapon");
const world = new NodeClass("World");

canvas.active = false;
scene.addChild(canvas);
canvas.addChild(player);
player.addChild(weapon);
scene.addChild(world);

const game = cc.game;
const director = cc.director;
const Director = cc.Director;

if (!game || !director || !Director) {
  throw new Error("cc.game 或 cc.director 没有完成注册");
}

const showResult = (deltaTime: number): void => {
  status.textContent = [
    `帧数: ${director.totalFrames} · deltaTime: ${deltaTime.toFixed(4)}s`,
    `Canvas.active / activeInHierarchy: ${canvas.active} / ${canvas.activeInHierarchy}`,
    `Player.active / activeInHierarchy: ${player.active} / ${player.activeInHierarchy}`,
    `World.activeInHierarchy: ${world.activeInHierarchy}`,
  ].join("\n");
};

director.on(Director.EVENT_AFTER_UPDATE, showResult);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  showResult(0);
});
