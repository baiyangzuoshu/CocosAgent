import { Component, Director, director, game, Node, Scene } from "./exports/base.ts";
import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import { Sprite } from "./cocos/2d/components/sprite.ts";

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
player.setRenderComponent(new Sprite(player));

let branchMoved = false;
director.on(Director.EVENT_AFTER_UPDATE, () => {
  if (!branchMoved && director.totalFrames === 2) {
    branch.setPosition(20, 0);
    branchMoved = true;
  }
});

let assetStatus = "资源请求中…";
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
  ].join("\n");
};

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

  const cachedBeforeSecondRequest = assetManager.assets.has(uuid);
  assetManager.loadAny(uuid, (secondError, secondAsset) => {
    if (secondError || !secondAsset) {
      assetStatus = `资源加载失败: ${secondError?.message ?? "未知错误"}`;
    } else {
      assetStatus = [
        `资源对象: ${firstAsset.data.name}`,
        `首次请求前有缓存: ${cachedBeforeFirstRequest}`,
        `再次请求前有缓存: ${cachedBeforeSecondRequest}`,
        `两次请求是同一对象: ${firstAsset === secondAsset}`,
      ].join("\n");
    }
    render();
  });
});
