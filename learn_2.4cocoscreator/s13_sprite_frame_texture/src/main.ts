import cc from "./index.ts";
import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import Sprite from "./cocos2d/core/components/CCSprite.ts";
import SpriteFrame from "./cocos2d/core/assets/CCSpriteFrame.ts";
import Texture2D from "./cocos2d/core/assets/CCTexture2D.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到页面状态节点 #status");

const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !game || !director || !DirectorClass) {
  throw new Error("节点、场景或引擎启动模块尚未注册");
}

const scene = new SceneClass("MainScene");
const hero = new NodeClass("Hero");
const sprite = new Sprite(hero);
hero.setRenderComponent(sprite);
scene.addChild(hero);

let assetStatus = "等待资源请求";

const renderStatus = (): void => {
  const frame = sprite.spriteFrame;
  status.textContent = [
    `活动场景: ${director.lastRenderedSceneName}`,
    "职责链: Asset → Texture2D → SpriteFrame → Sprite",
    `资源状态: ${assetStatus}`,
    frame
      ? `帧区域: ${frame.rect.width}×${frame.rect.height} / 贴图 ${frame.texture.width}×${frame.texture.height}`
      : "帧区域: 等待 SpriteFrame",
    frame
      ? `SpriteFrame UV: ${Array.from(frame.uv).map((value) => value.toFixed(2)).join(", ")}`
      : "SpriteFrame UV: 等待计算",
    `WebGL draw call: ${director.drawCallCount}`,
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_DRAW, renderStatus);
status.textContent = "game.run 正在启动引擎；资源加载后会接入 Sprite 并绘制贴图区域。";
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));

const assetManager = new CCAssetManager();
assetStatus = "AssetManager 正在按 UUID 请求 JSON";
assetManager.loadAny("hero-uuid", (error, asset) => {
  if (error || !asset) {
    assetStatus = `资源加载失败: ${error?.message ?? "未知错误"}`;
    renderStatus();
    return;
  }

  const texture = new Texture2D(asset.data.textureUrl);
  assetStatus = "Asset 已创建；Texture2D 正在加载图片";
  texture.load().then(() => {
    const frame = new SpriteFrame(texture, asset.data.rect);
    sprite.setSpriteFrame(frame);
    assetStatus = `SpriteFrame 已接入: ${asset.data.name}`;
    renderStatus();
  }).catch((loadError: unknown) => {
    assetStatus = `贴图加载失败: ${loadError instanceof Error ? loadError.message : String(loadError)}`;
    renderStatus();
  });
});
