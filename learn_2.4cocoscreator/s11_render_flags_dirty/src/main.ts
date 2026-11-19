import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !game || !director || !DirectorClass) {
  throw new Error("节点/场景/帧循环模块尚未注册");
}

const scene = new SceneClass("MainScene");
const branch = new NodeClass("Branch");
const player = new NodeClass("Player");
branch.setPosition(10, 0);
player.setPosition(2, 3);
scene.addChild(branch);
branch.addChild(player);

director.on(DirectorClass.EVENT_AFTER_UPDATE, () => {
  if (director.totalFrames === 2) branch.setPosition(20, 0);
});

director.on(DirectorClass.EVENT_AFTER_DRAW, () => {
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `Branch 本地位置: ${JSON.stringify(branch.getPosition())}`,
    `Player 世界位置: ${JSON.stringify(player.getWorldPosition())}`,
    `本帧变换更新: ${director.transformHistory.at(-1) ?? "等待首帧"}`,
  ].join("\n");
});

game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
