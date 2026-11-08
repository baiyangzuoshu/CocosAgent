import { CCEventManager } from "./cocos2d/core/event-manager/CCEventManager.ts";
import { CCInputManager } from "./cocos2d/core/platform/CCInputManager.ts";
import type { InputPoint } from "./cocos2d/core/platform/input-point.ts";
import cc from "./index.ts";
import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import Sprite from "./cocos2d/core/components/CCSprite.ts";
import SpriteFrame from "./cocos2d/core/assets/CCSpriteFrame.ts";
import Texture2D from "./cocos2d/core/assets/CCTexture2D.ts";

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

const scene = new SceneClass("MainScene");
const branch = new NodeClass("Branch");
branch.setPosition(10, 0);
scene.addChild(branch);

class PlayerComponent extends ComponentClass {
  readonly events: string[] = [];

  override onLoad(): void { this.events.push("onLoad"); }
  override onEnable(): void { this.events.push("onEnable"); }
  override start(): void { this.events.push("start"); }
  override update(deltaTime: number): void {
    this.events.push(`update(${deltaTime.toFixed(3)})`);
    if (director!.totalFrames === 2) branch.setPosition(20, 0);
  }
  override lateUpdate(deltaTime: number): void { this.events.push(`lateUpdate(${deltaTime.toFixed(3)})`); }
}

const player = new NodeClass("Player");
player.setPosition(2, 3);
const component = player.addComponent(PlayerComponent);
branch.addChild(player);
const sprite = new Sprite(player);
player.setRenderComponent(sprite);

let assetStatus = "资源请求中…";
let inputStatus = "点击角色或画布空白处";
let targetStatus = "等待节点事件";
const eventManager = new CCEventManager();
eventManager.addListener(player);
player.onTouchStart(() => { targetStatus = "Player 收到 touch-start"; });
const render = (): void => {
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `回调: ${component.events.slice(-6).join(" → ")}`,
    "每帧顺序: start（一次）→ update → lateUpdate",
    `渲染入口: Director.mainLoop → Renderer.render → RenderFlow.render → ${director.lastRenderedSceneName}`,
    `Player 世界位置: ${JSON.stringify(player.getWorldPosition())}`,
    `最近渲染脏标记: ${director.transformHistory.join("；")}`,
    `几何提交: 4 个顶点、6 个索引、${director.drawCallCount} 次 draw call`,
    assetStatus,
    inputStatus,
    targetStatus,
  ].join("\n");
};

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("找不到画布 #game");
const onInput = (point: InputPoint): void => {
  inputStatus = `输入: ${point.source} id=${point.id} 画布坐标=(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`;
  const x = point.x - canvas.width / 2;
  const y = point.y - canvas.height / 2;
  targetStatus = "未命中";
  eventManager.dispatchTouchStart(x, y);
  render();
};
new CCInputManager().registerSystemEvent(canvas, onInput);

director.on(DirectorClass.EVENT_AFTER_DRAW, render);
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));

const assetManager = new CCAssetManager();
const uuid = "hero-uuid";
const cachedBeforeFirstRequest = assetManager.assets.has(uuid);
assetManager.loadAny(uuid, (firstError, firstAsset) => {
  if (firstError || !firstAsset) {
    assetStatus = `资源加载失败: ${firstError?.message ?? "未知错误"}`;
    render();
    return;
  }

  const texture = new Texture2D(firstAsset.data.textureUrl);
  texture.load().then(() => {
    const frame = new SpriteFrame(texture, firstAsset.data.rect);
    sprite.setSpriteFrame(frame);
    const cachedBeforeSecondRequest = assetManager.assets.has(uuid);
    assetManager.loadAny(uuid, (secondError, secondAsset) => {
      if (secondError || !secondAsset) {
        assetStatus = `资源加载失败: ${secondError?.message ?? "未知错误"}`;
      } else {
        assetStatus = [
          `接线: Asset → Texture2D → SpriteFrame → Sprite`,
          `帧区域: ${frame.rect.width}×${frame.rect.height} / ${texture.width}×${texture.height}`,
          `SpriteFrame UV: ${Array.from(frame.uv).map((value) => value.toFixed(2)).join(", ")}`,
          `首次请求前有缓存: ${cachedBeforeFirstRequest}`,
          `再次请求前有缓存: ${cachedBeforeSecondRequest}`,
          `两次请求是同一对象: ${firstAsset === secondAsset}`,
        ].join("\n");
      }
      render();
    });
  }).catch((error: unknown) => {
    assetStatus = `贴图加载失败: ${error instanceof Error ? error.message : String(error)}`;
    render();
  });
});
