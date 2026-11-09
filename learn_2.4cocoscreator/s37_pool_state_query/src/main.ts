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
let clearProbeDestroyed = false;
let externalProbeDestroyed = false;
let poolActivityUpdateCount = 0;
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
  override update(): void { if (this.node.name === "PoolActivityProbe") poolActivityUpdateCount++; }
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
  override onDestroy(): void {
    this.record("onDestroy");
    if (this.node.name === "ClearProbe") clearProbeDestroyed = true;
    if (this.node.name === "ExternalProbe") externalProbeDestroyed = true;
  }
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
const nodePool = new NodePool<Node>(EnemyLogic);
const prewarmPool = new NodePool<Node>(EnemyLogic);
const clearProbePool = new NodePool<Node>(EnemyLogic);
let clearProbeNode: Node | null = null;
let clearProbeSnapshot = "等待清池演示";
let clearProbeDone = false;
const externalProbePool = new NodePool<Node>(EnemyLogic);
let externalProbeNode: Node | null = null;
let externalProbeSnapshot = "等待外部引用演示";
let externalProbeDone = false;
const activityPool = new NodePool<Node>(EnemyLogic);
let activityProbeStatus = "等待池中调度演示";
let activityProbeDone = false;
const cleanupPolicyPool = new NodePool<Node>(EnemyLogic);
let cleanupPolicyStatus = "等待回收/清理演示";
let cleanupPolicyDone = false;
const orderPool = new NodePool<Node>();
const orderNodeA = new NodeClass("PoolOrderA");
const orderNodeB = new NodeClass("PoolOrderB");
let orderStatus = "等待 put A、B";
let orderDone = false;
const duplicatePool = new NodePool<Node>();
const duplicateNode = new NodeClass("DuplicateProbe");
let duplicateStatus = "等待重复入池演示";
let duplicateDone = false;
const poolA = new NodePool<Node>();
const poolB = new NodePool<Node>();
const sharedNode = new NodeClass("SharedAcrossPools");
let ownerStatus = "等待单池归属演示";
let ownerDone = false;
const disposedPool = new NodePool<Node>();
const disposeProbe = new NodeClass("DisposeProbe");
let disposeStatus = "等待 dispose 演示";
let disposeDone = false;
const prewarmCount = 2;
const prewarmLowWater = 1;
const prewarmRefillBatch = 3;
const prewarmMaxSize = 4;
let prewarmStatus = "等待资源加载后预热";
let prewarmUseCount = 0;
let prewarmCreatedCount = 0;
const refillPrewarmPool = (count: number): number => {
  const room = Math.max(0, prewarmMaxSize - prewarmPool.size());
  const createCount = Math.min(count, room);
  for (let i = 0; i < createCount; i++) {
    const warmNode = instantiate(enemyPrefab);
    warmNode.name = "Prewarmed" + (++prewarmCreatedCount);
    prewarmPool.put(warmNode);
  }
  return createCount;
};
let poolStatus = "等待 EnemyA 挂载";
const poolCapacity = 1;
let poolCapacityDemoDone = false;

let assetStatus = "资源请求中…";
let inputStatus = "点击角色或画布空白处";
let targetStatus = "等待节点事件";
const eventManager = new CCEventManager();
eventManager.addListener(player);
const stop = document.querySelector<HTMLInputElement>("#stop");
const poolToggle = document.querySelector<HTMLButtonElement>("#pool-toggle");
const poolClear = document.querySelector<HTMLButtonElement>("#pool-clear");
const poolSpawn = document.querySelector<HTMLButtonElement>("#pool-spawn");
const poolCapacityDemo = document.querySelector<HTMLButtonElement>("#pool-capacity-demo");
const prewarmGet = document.querySelector<HTMLButtonElement>("#pool-prewarm-get");
const clearProbeButton = document.querySelector<HTMLButtonElement>("#pool-clear-timing");
const externalProbeButton = document.querySelector<HTMLButtonElement>("#pool-external-owner");
const activityProbeButton = document.querySelector<HTMLButtonElement>("#pool-activity-pause");
const cleanupPolicyButton = document.querySelector<HTMLButtonElement>("#pool-cleanup-policy");
const poolOrderButton = document.querySelector<HTMLButtonElement>("#pool-order-demo");
const duplicateButton = document.querySelector<HTMLButtonElement>("#pool-duplicate-put");
const ownerButton = document.querySelector<HTMLButtonElement>("#pool-single-owner");
const disposeButton = document.querySelector<HTMLButtonElement>("#pool-dispose-demo");
if (!poolToggle || !poolClear || !poolSpawn || !poolCapacityDemo || !prewarmGet || !clearProbeButton || !externalProbeButton || !activityProbeButton || !cleanupPolicyButton || !poolOrderButton || !duplicateButton || !ownerButton || !disposeButton) throw new Error("找不到对象池按钮");
let poolReady = false;
let poolFallbackCount = 0;
const putWithinCapacity = (node: Node): boolean => {
  if (nodePool.size() >= poolCapacity) {
    node.removeFromParent(false);
    node.destroy();
    poolStatus = "容量 " + poolCapacity + " 已满：" + node.name + " 已移除并销毁";
    return false;
  }
  nodePool.put(node);
  poolStatus = "已入池：size=" + nodePool.size() + " / " + poolCapacity;
  return true;
};
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
  poolClear.disabled = nodePool.size() === 0 && prewarmPool.size() === 0;
  poolSpawn.disabled = !poolReady;
  poolCapacityDemo.disabled = !poolReady || poolCapacityDemoDone || !enemyNodeA?.isValid || !enemyNodeB?.isValid;
  prewarmGet.disabled = prewarmPool.size() === 0;
  clearProbeButton.disabled = !poolReady || clearProbeDone;
  externalProbeButton.disabled = !poolReady || externalProbeDone;
  activityProbeButton.disabled = !poolReady || activityProbeDone;
  cleanupPolicyButton.disabled = !poolReady || cleanupPolicyDone;
  poolOrderButton.disabled = orderDone;
  duplicateButton.disabled = duplicateDone;
  ownerButton.disabled = ownerDone;
  disposeButton.disabled = disposeDone;
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
    prewarmStatus,
    clearProbeNode
      ? clearProbeSnapshot + "；当前 isValid=" + clearProbeNode.isValid + "；onDestroy=" + clearProbeDestroyed
      : clearProbeSnapshot,
    externalProbeNode
      ? externalProbeSnapshot + "；当前 isValid=" + externalProbeNode.isValid + "；onDestroy=" + externalProbeDestroyed
      : externalProbeSnapshot,
    activityProbeStatus,
    cleanupPolicyStatus,
    orderStatus,
    duplicateStatus,
    ownerStatus,
    disposeStatus,
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
    `取出策略: ${poolStrategyStatus}`,
    `对象池: size=${nodePool.size()}；EnemyA.isValid=${enemyNodeA?.isValid ?? "等待"}；${poolStatus}`,
  ].join("\n");
};

poolToggle.addEventListener("click", () => {
  if (!enemyNodeA || !enemyLogicA?.started) return;
  if (nodePool.size() === 0) {
    const stored = putWithinCapacity(enemyNodeA);
    if (stored) poolStatus = "put：onDisable 后调用 unuse，清理临时状态";
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
  prewarmPool.clear();
  poolCapacityDemoDone = true;
  poolStatus = "clear：已请求销毁池内节点";
  prewarmStatus = "预热池已清空";
  render();
});

clearProbeButton.addEventListener("click", () => {
  if (!poolReady || clearProbeDone) return;
  const probe = instantiate(enemyPrefab);
  probe.name = "ClearProbe";
  scene.addChild(probe);
  clearProbePool.put(probe);
  clearProbeNode = probe;
  clearProbeDestroyed = false;
  clearProbePool.clear();
  clearProbeSnapshot = "clear() 返回：size=" + clearProbePool.size()
    + "；isValid=" + probe.isValid + "；onDestroy=" + clearProbeDestroyed;
  clearProbeDone = true;
  render();
});

externalProbeButton.addEventListener("click", () => {
  if (!poolReady || externalProbeDone) return;
  const probe = instantiate(enemyPrefab);
  probe.name = "ExternalProbe";
  scene.addChild(probe);
  externalProbeNode = probe;
  externalProbeDestroyed = false;
  externalProbePool.put(probe);
  externalProbePool.clear();
  externalProbeSnapshot = "保留 JS 引用后 clear() 返回：size=" + externalProbePool.size()
    + "；isValid=" + probe.isValid + "；onDestroy=" + externalProbeDestroyed;
  externalProbeDone = true;
  render();
});

activityProbeButton.addEventListener("click", async () => {
  if (!poolReady || activityProbeDone) return;
  const probe = instantiate(enemyPrefab);
  probe.name = "PoolActivityProbe";
  scene.addChild(probe);
  const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
  await wait(250);
  const beforePut = poolActivityUpdateCount;
  activityPool.put(probe);
  const atPut = poolActivityUpdateCount;
  const validInPool = probe.isValid;
  const activeInPool = probe.activeInHierarchy;
  const frameAtPut = director.totalFrames;
  activityProbeStatus = "节点已入池，观察池内更新";
  render();
  await wait(250);
  const whilePooled = poolActivityUpdateCount;
  const pooledFrames = director.totalFrames - frameAtPut;
  const reused = activityPool.get(35);
  if (!reused) return;
  scene.addChild(reused);
  const beforeResume = poolActivityUpdateCount;
  await wait(250);
  const afterResume = poolActivityUpdateCount;
  activityProbeStatus = "入池前 update=" + beforePut + "；池内 isValid=" + validInPool + "、activeInHierarchy=" + activeInPool + "；经过 " + pooledFrames + " 帧增加 " + (whilePooled - atPut) + "；重新挂载后增加 " + (afterResume - beforeResume);
  activityProbeDone = true;
  render();
});

ownerButton.addEventListener("click", () => {
  if (ownerDone) return;
  poolA.put(sharedNode);
  poolB.put(sharedNode);
  const sizeA = poolA.size();
  const sizeBAfterRejectedPut = poolB.size();
  const fromA = poolA.get();
  if (fromA) poolB.put(fromA);
  const acceptedAfterTransfer = poolB.size() === 1;
  const fromB = poolB.get();
  ownerStatus = `同时 put：A=${sizeA}、B=${sizeBAfterRejectedPut}（跨池 put 被拒绝）；A.get 后 B 接收=${acceptedAfterTransfer}；仍是同一节点=${fromA === fromB && fromB === sharedNode}`;
  ownerDone = true;
  render();
});

disposeButton.addEventListener("click", () => {
  if (disposeDone) return;
  disposedPool.put(disposeProbe);
  const sizeBeforeDispose = disposedPool.size();
  disposedPool.dispose();
  disposedPool.put(disposeProbe);
  const sizeAfterRejectedPut = disposedPool.size();
  const getAfterDispose = disposedPool.get();
  const emptyPool = new NodePool<Node>();
  const getFromEmptyPool = emptyPool.get();
  disposeStatus = `dispose 前 size=${sizeBeforeDispose}；之后 put 不生效=${sizeAfterRejectedPut === 0}；空池 get 返回 null=${getFromEmptyPool === null}、isDisposed=${emptyPool.isDisposed()}；关闭池 get 返回 null=${getAfterDispose === null}、isDisposed=${disposedPool.isDisposed()}`;
  disposeDone = true;
  render();
});

duplicateButton.addEventListener("click", () => {
  if (duplicateDone) return;
  duplicatePool.put(duplicateNode);
  duplicatePool.put(duplicateNode);
  const sizeAfterPut = duplicatePool.size();
  const first = duplicatePool.get();
  const second = duplicatePool.get();
  duplicateStatus = `put 同一节点两次：size=${sizeAfterPut}；第一次取回原节点=${first === duplicateNode}；第二次为空=${second === null}`;
  duplicateDone = true;
  render();
});

poolOrderButton.addEventListener("click", () => {
  if (orderDone) return;
  orderPool.put(orderNodeA);
  orderPool.put(orderNodeB);
  const first = orderPool.get();
  const second = orderPool.get();
  orderStatus = `put A → B；get ${first?.name} → ${second?.name}；size=${orderPool.size()}`;
  orderDone = true;
  render();
});

cleanupPolicyButton.addEventListener("click", () => {
  if (!poolReady || cleanupPolicyDone) return;
  const probe = instantiate(enemyPrefab);
  probe.name = "CleanupPolicyProbe";
  let eventCount = 0;
  probe.onTouchStart(() => { eventCount++; });
  scene.addChild(probe);
  probe.dispatchTouchStart(0, 0);
  cleanupPolicyPool.put(probe); // NodePool.put 使用 removeFromParent(false)
  const inactiveInPool = !probe.activeInHierarchy;
  const reused = cleanupPolicyPool.get(35);
  if (!reused) return;
  scene.addChild(reused);
  reused.dispatchTouchStart(0, 0);
  const afterPoolReuse = eventCount;
  reused.removeFromParent(true); // cleanup 清除节点事件监听
  scene.addChild(reused);
  reused.dispatchTouchStart(0, 0);
  cleanupPolicyStatus = "入池后事件仍收到；cleanup=false 时 activeInHierarchy=" + inactiveInPool
    + "；池化前后事件数=" + afterPoolReuse + "；cleanup=true 并重新挂载后事件数=" + eventCount;
  cleanupPolicyDone = true;
  render();
});

poolCapacityDemo.addEventListener("click", () => {
  if (!enemyNodeA?.isValid || !enemyNodeB?.isValid) return;
  if (nodePool.size() < poolCapacity && !putWithinCapacity(enemyNodeA)) return;
  const stored = putWithinCapacity(enemyNodeB);
  if (stored) poolStatus = "EnemyB 已入池";
  poolCapacityDemoDone = true;
  render();
});

prewarmGet.addEventListener("click", () => {
  const countBeforeGet = enemyPrefab.instantiatedTimes;
  const warmNode = prewarmPool.get(45);
  if (!warmNode) return;
  const getUsedExistingNode = countBeforeGet === enemyPrefab.instantiatedTimes;
  warmNode.name = "PrewarmedUse" + (++prewarmUseCount);
  warmNode.setPosition(-30 + prewarmUseCount * 28, -35);
  const logic = warmNode.getComponent(EnemyLogic);
  scene.addChild(warmNode);
  let replenished = 0;
  if (prewarmPool.size() <= prewarmLowWater) {
    replenished = refillPrewarmPool(prewarmRefillBatch);
  }
  prewarmStatus = "取出已有实例 " + warmNode.name + "；HP=" + (logic?.hp ?? "?")
    + "；get 未新建节点=" + getUsedExistingNode
    + "；低水位补充=" + replenished
    + "；预热池 size=" + prewarmPool.size() + "/" + prewarmMaxSize;
  render();
});

let poolStrategyStatus = "等待 Prefab";
poolSpawn.addEventListener("click", () => {
  const pooled = nodePool.get(45);
  if (pooled) {
    scene.addChild(pooled);
    poolStrategyStatus = `池命中：取回同一 EnemyA=${pooled === enemyNodeA}`;
  } else {
    const fresh = instantiate(enemyPrefab);
    fresh.name = `EnemyFresh${++poolFallbackCount}`;
    fresh.setPosition(-60 + (poolFallbackCount % 4) * 32, -35);
    scene.addChild(fresh);
    const logic = fresh.getComponent(EnemyLogic);
    poolStrategyStatus = `池未命中：get 返回 null，实例化 ${fresh.name}；初始 HP=${logic?.hp ?? "?"}，未调用 reuse`;
  }
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
    refillPrewarmPool(prewarmCount);
    prewarmStatus = "启动预热完成：创建 " + prewarmCount + " 个节点；size=" + prewarmPool.size()
      + "；低水位=" + prewarmLowWater + "；最大容量=" + prewarmMaxSize;
    enemyLogicA = logicA;
    enemyLogicB = logicB;
    enemyNodeA = enemyA;
    enemyNodeB = enemyB;
    poolReady = true;
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
