import cc from "./index.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

const SceneClass = cc.Scene;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!SceneClass || !game || !director || !DirectorClass) {
  throw new Error("引擎模块尚未完成注册");
}

const scene = new SceneClass("MainScene");

const renderStatus = (): void => {
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `入口: Director.mainLoop → Renderer.render → RenderFlow.render`,
    `送入 RenderFlow 的场景: ${director.lastRenderedSceneName}`,
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_DRAW, renderStatus);
status.textContent = "等待 game.run 完成启动并进入首帧……";
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
