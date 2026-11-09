import { MouseInputSource } from "./pal/input/web/mouse-input.ts";
import { TouchInputSource } from "./pal/input/web/touch-input.ts";
import type { InputPoint } from "./pal/input/web/input-point.ts";
import { Component, Director, director, game, Node, Scene } from "./exports/base.ts";
import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import { Sprite } from "./cocos/2d/components/sprite.ts";
import { SpriteFrame } from "./cocos/2d/assets/sprite-frame.ts";
import { Texture2D } from "./cocos/asset/assets/texture-2d.ts";
import { Prefab } from "./cocos/scene-graph/prefab/prefab.ts";
import { instantiate } from "./cocos/serialization/instantiate.ts";

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

const prefabData = new Node("Enemy");
const body = new Node("Body");
const marker = new Node("Marker");
class EnemyLogic extends Component {
  hp = 100;
  events = "";
  started = false;
  private record(event: string): void { this.events += `${this.events ? " → " : ""}${event}`; }
  override onLoad(): void { this.record("onLoad"); }
  override onEnable(): void { this.record("onEnable"); }
  override onDisable(): void { this.record("onDisable"); }
  override start(): void { this.started = true; this.record("start"); }
  override onDestroy(): void { this.record("onDestroy"); }
}
prefabData.addComponent(EnemyLogic);
body.addChild(marker);
prefabData.addChild(body);
const enemyPrefab = new Prefab(prefabData);
const prefabSprite = new Sprite(body);
body.setRenderComponent(prefabSprite);
let prefabStatus = "Prefab 等待 SpriteFrame";
let lifecycleStatus = "Prefab 未实例化";
let enemyLogicA: EnemyLogic | null = null;
let enemyLogicB: EnemyLogic | null = null;
let enemyNodeA: Node | null = null;
let enemyNodeB: Node | null = null;
let destructionStatus = "尚未请求销毁";

let branchMoved = false;
director.on(Director.EVENT_AFTER_UPDATE, () => {
  if (!branchMoved && director.totalFrames === 2) {
    branch.setPosition(20, 0);
    branchMoved = true;
  }
});

let assetStatus = "资源请求中…";
let inputStatus = "点击角色或画布空白处";
let targetStatus = "等待节点事件";
const processor = player.eventProcessor;
const stop = document.querySelector<HTMLInputElement>("#stop");
const toggleEnemy = document.querySelector<HTMLButtonElement>("#toggle-enemy");
if (!toggleEnemy) throw new Error("找不到按钮 #toggle-enemy");
const destroyEnemy = document.querySelector<HTMLButtonElement>("#destroy-enemy");
if (!destroyEnemy) throw new Error("找不到按钮 #destroy-enemy");
let route: string[] = [];
scene.onTouchStart((event) => { route.push(`${event.currentTarget.name}: ${event.phase}`); }, true);
branch.onTouchStart((event) => {
  route.push(`${event.currentTarget.name}: ${event.phase}`);
  if (stop?.checked) event.stopPropagation();
}, true);
player.onTouchStart((event) => { route.push(`${event.currentTarget.name}: ${event.phase}`); });
branch.onTouchStart((event) => { route.push(`${event.currentTarget.name}: ${event.phase}`); });
scene.onTouchStart((event) => { route.push(`${event.currentTarget.name}: ${event.phase}`); });
const render = (): void => {
  const attached = enemyNodeA?.parent === scene;
  toggleEnemy.disabled = !enemyLogicA?.started;
  destroyEnemy.disabled = !enemyLogicB?.started || !enemyNodeB?.isValid;
  toggleEnemy.textContent = enemyNodeA && !attached ? "重新挂载 EnemyA" : "移除 EnemyA";
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
    targetStatus,
    prefabStatus,
    lifecycleStatus,
    enemyLogicA
      ? `挂载生命周期: A=${enemyLogicA.events || "等待"}；B=${enemyLogicB?.events || "等待"}`
      : "等待实例化",
    `EnemyB: ${destructionStatus}${enemyNodeB ? `；isValid=${enemyNodeB.isValid}` : ""}`,
  ].join("\n");
};

toggleEnemy.addEventListener("click", () => {
  if (!enemyNodeA || !enemyLogicA?.started) return;
  if (enemyNodeA?.parent === scene) scene.removeChild(enemyNodeA);
  else scene.addChild(enemyNodeA);
  render();
});

destroyEnemy.addEventListener("click", () => {
  if (!enemyNodeB || !enemyLogicB?.started) return;
  destructionStatus = `destroy()=${enemyNodeB.destroy()}；调用后`;
  render();
});

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("找不到画布 #game");
const onInput = (point: InputPoint): void => {
  inputStatus = `输入: ${point.source} id=${point.id} 画布坐标=(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`;
  const x = point.x - canvas.width / 2;
  const y = point.y - canvas.height / 2;
  targetStatus = "未命中";
  route = [];
  processor.handleTouchStart(x, y);
  if (route.length) targetStatus = `传播: ${route.join(" → ")}`;
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
    prefabSprite.setSpriteFrame(frame);
    const enemyA = instantiate(enemyPrefab);
    const enemyB = instantiate(enemyPrefab);
    enemyA.name = "EnemyA";
    enemyB.name = "EnemyB";
    enemyA.setPosition(-45, 0);
    enemyB.setPosition(45, 0);
    const logicA = enemyA.components[0] as EnemyLogic;
    const logicB = enemyB.components[0] as EnemyLogic;
    logicA.hp = 60;
    const spriteA = enemyA.children[0]._renderComponent as Sprite;
    const spriteB = enemyB.children[0]._renderComponent as Sprite;
    prefabStatus = [
      `节点独立: ${enemyA !== enemyB}`,
      `组件独立: ${logicA !== logicB}；HP A/B: ${logicA.hp}/${logicB.hp}`,
      `Sprite 独立: ${spriteA !== spriteB}`,
      `SpriteFrame 共享: ${spriteA.spriteFrame === spriteB.spriteFrame}`,
      `实例化次数: ${enemyPrefab.instantiatedTimes}`,
    ].join("；");
    lifecycleStatus = `实例化后、挂载前: A=${logicA.events || "无"}；B=${logicB.events || "无"}`;
    scene.addChild(enemyA);
    scene.addChild(enemyB);
    enemyLogicA = logicA;
    enemyLogicB = logicB;
    enemyNodeA = enemyA;
    enemyNodeB = enemyB;
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
