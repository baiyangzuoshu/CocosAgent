import { MouseInputSource } from "./pal/input/web/mouse-input.ts";
import { TouchInputSource } from "./pal/input/web/touch-input.ts";
import type { InputPoint } from "./pal/input/web/input-point.ts";
import { Component, Director, director, game, Node, Scene } from "./exports/base.ts";
import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import { Sprite } from "./cocos/2d/components/sprite.ts";
import { SpriteFrame } from "./cocos/2d/assets/sprite-frame.ts";
import { Texture2D } from "./cocos/asset/assets/texture-2d.ts";

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
const branch = new Node("Branch");
branch.setPosition(10, 0);
scene.addChild(branch);
const player = new Node("Player");
player.setPosition(2, 3);
const component = player.addComponent(PlayerComponent);
branch.addChild(player);
const sprite = new Sprite(player);
player.setRenderComponent(sprite);

let branchMoved = false;
director.on(Director.EVENT_AFTER_UPDATE, () => {
  if (!branchMoved && director.totalFrames === 2) {
    branch.setPosition(20, 0);
    branchMoved = true;
  }
});

let assetStatus = "资源请求中…";
let inputStatus = "点击或触摸画布";
const render = (): void => {
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `回调: ${component.events.slice(-6).join(" → ")}`,
    "每帧顺序: start（一次）→ update → lateUpdate",
    `渲染入口: Director.tick → Root.frameMove → RenderPipeline.render → RenderFlow.render → ${director.lastRenderedSceneName}`,
    `Player 世界位置: ${JSON.stringify(player.worldPosition)}`,
    `变换重算次数: Branch=${branch.worldTransformUpdateCount}, Player=${player.worldTransformUpdateCount}`,
    `几何提交: 4 个顶点、6 个索引、${director.drawCallCount} 次 draw call`,
    assetStatus,
    inputStatus,
  ].join("\n");
};

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("找不到画布 #game");
const onInput = (point: InputPoint): void => {
  inputStatus = `输入: ${point.source} id=${point.id} 画布坐标=(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`;
  render();
};
new MouseInputSource(canvas, onInput);
new TouchInputSource(canvas, onInput);

director.on(Director.EVENT_AFTER_RENDER, render);
await game.init({});
director.runSceneImmediate(scene);
game.run();
render();

const assetManager = new AssetManager();
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
      assetStatus = secondError || !secondAsset
        ? `资源加载失败: ${secondError?.message ?? "未知错误"}`
        : [
          "接线: Asset → Texture2D → SpriteFrame → Sprite",
          `帧区域: ${frame.rect.width}×${frame.rect.height} / ${texture.width}×${texture.height}`,
          `SpriteFrame UV: ${Array.from(frame.uv).map((value) => value.toFixed(2)).join(", ")}`,
          `首次请求前有缓存: ${cachedBeforeFirstRequest}`,
          `再次请求前有缓存: ${cachedBeforeSecondRequest}`,
          `两次请求是同一对象: ${firstAsset === secondAsset}`,
        ].join("\n");
      render();
    });
  }).catch((error: unknown) => {
    assetStatus = `贴图加载失败: ${error instanceof Error ? error.message : String(error)}`;
    render();
  });
});
