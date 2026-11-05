import cc from "./index.ts";
import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";

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

  override onLoad(): void { this.events.push("onLoad"); }
  override onEnable(): void { this.events.push("onEnable"); }
  override start(): void { this.events.push("start"); }
  override update(deltaTime: number): void { this.events.push(`update(${deltaTime.toFixed(3)})`); }
  override lateUpdate(deltaTime: number): void { this.events.push(`lateUpdate(${deltaTime.toFixed(3)})`); }
}

const scene = new SceneClass("MainScene");
const player = new NodeClass("Player");
const component = player.addComponent(PlayerComponent);
scene.addChild(player);

let assetStatus = "资源请求中…";
const render = (): void => {
  status.textContent = [
    `帧数: ${director.totalFrames}`,
    `回调: ${component.events.slice(-6).join(" → ")}`,
    "每帧顺序: start（一次）→ update → lateUpdate",
    assetStatus,
  ].join("\n");
};

director.on(DirectorClass.EVENT_AFTER_UPDATE, render);
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
