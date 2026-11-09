import { CCEventManager } from "./cocos2d/core/event-manager/CCEventManager.ts";
import { CCInputManager } from "./cocos2d/core/platform/CCInputManager.ts";
import type { InputPoint } from "./cocos2d/core/platform/input-point.ts";
import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import Sprite from "./cocos2d/core/components/CCSprite.ts";
import SpriteFrame from "./cocos2d/core/assets/CCSpriteFrame.ts";
import Texture2D from "./cocos2d/core/assets/CCTexture2D.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

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

const prefabData = new NodeClass("Enemy");
const body = new NodeClass("Body");
const marker = new NodeClass("Marker");
class EnemyLogic extends ComponentClass {
  hp = 100;
  visualEffectActive = true;
  events = "";
  started = false;
  private record(event: string): void { this.events += `${this.events ? " → " : ""}${event}`; }
  override onLoad(): void { this.record("onLoad"); }
  override onEnable(): void { this.record("onEnable"); }
  override onDisable(): void { this.record("onDisable"); }
  override start(): void { this.started = true; this.record("start"); }
  unuse(): void {
    this.hp = 0;
    this.visualEffectActive = false;
    this.record("unuse");
  }
  reuse(hp = 100): void {
    this.hp = hp;
    this.visualEffectActive = true;
    this.record(`reuse(${hp})`);
  }
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
const nodePool = new NodePool<Node>(EnemyLogic);
let poolStatus = "等待 EnemyA 挂载";

let assetStatus = "资源请求中…";
let inputStatus = "点击角色或画布空白处";
let targetStatus = "等待节点事件";
const eventManager = new CCEventManager();
eventManager.addListener(player);
const stop = document.querySelector<HTMLInputElement>("#stop");
const poolToggle = document.querySelector<HTMLButtonElement>("#pool-toggle");
const poolClear = document.querySelector<HTMLButtonElement>("#pool-clear");
if (!poolToggle || !poolClear) throw new Error("找不到对象池按钮");
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
  poolToggle.disabled = !enemyLogicA?.started || !enemyNodeA?.isValid;
  poolClear.disabled = nodePool.size() === 0;
  poolToggle.textContent = nodePool.size() ? "取回 EnemyA" : "回收 EnemyA";
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
    prefabStatus,
    lifecycleStatus,
    enemyLogicA
      ? `挂载生命周期: A=${enemyLogicA.events || "等待"}；B=${enemyLogicB?.events || "等待"}`
      : "等待实例化",
    enemyLogicA
      ? `EnemyA 状态: HP=${enemyLogicA.hp}；临时效果=${enemyLogicA.visualEffectActive}`
      : "EnemyA 状态: 等待实例化",
    `对象池: size=${nodePool.size()}；EnemyA.isValid=${enemyNodeA?.isValid ?? "等待"}；${poolStatus}`,
  ].join("\n");
};

poolToggle.addEventListener("click", () => {
  if (!enemyNodeA || !enemyLogicA?.started) return;
  if (nodePool.size() === 0) {
    nodePool.put(enemyNodeA);
    poolStatus = "put：onDisable 后调用 unuse，清理临时状态";
  } else {
    const reused = nodePool.get(45);
    if (reused) {
      scene.addChild(reused);
      poolStatus = `get：reuse(45) 后取回同一节点=${reused === enemyNodeA}`;
    }
  }
  render();
});

poolClear.addEventListener("click", () => {
  nodePool.clear();
  poolStatus = "clear：已请求销毁池内节点";
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
  eventManager.dispatchTouchStart(x, y);
  if (route.length) targetStatus = `传播: ${route.join(" → ")}`;
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
    prefabSprite.setSpriteFrame(frame);
    const enemyA = instantiate(enemyPrefab);
    const enemyB = instantiate(enemyPrefab);
    enemyA.name = "EnemyA";
    enemyB.name = "EnemyB";
    enemyA.setPosition(-45, 0);
    enemyB.setPosition(45, 0);
    const logicA = enemyA._components[0] as EnemyLogic;
    const logicB = enemyB._components[0] as EnemyLogic;
    logicA.hp = 60;
    const spriteA = (enemyA.children[0] as Node).renderComponent as Sprite;
    const spriteB = (enemyB.children[0] as Node).renderComponent as Sprite;
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
