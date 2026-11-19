import cc from "./index.ts";
import Sprite from "./cocos2d/core/components/CCSprite.ts";

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
const quad = new NodeClass("Quad");
quad.setRenderComponent(new Sprite(quad));
scene.addChild(quad);

director.on(DirectorClass.EVENT_AFTER_DRAW, () => {
  status.textContent = [
    `场景: ${director.lastRenderedSceneName}`,
    "几何: Sprite assembler 生成 4 个顶点 / 6 个索引",
    `WebGL draw call: ${director.drawCallCount}`,
  ].join("\n");
});

game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
