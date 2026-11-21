import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import type Component from "./cocos2d/core/components/CCComponent.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const prewarm = document.querySelector<HTMLButtonElement>("#pool-capacity-demo");
const getButton = document.querySelector<HTMLButtonElement>("#pool-prewarm-get");
const clearButton = document.querySelector<HTMLButtonElement>("#pool-toggle");
if (!status || !prewarm || !getButton || !clearButton) throw new Error("找不到对象池控件");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) throw new Error("引擎模块尚未注册");

const scene = new SceneClass("PoolPolicyScene");
const template = new NodeClass("PooledItem");
const messages: string[] = [];
class PoolProbe extends ComponentClass {
  hp = 100;
  unuse(): void { this.hp = 0; messages.push(`${this.node.name}: unuse`); }
  reuse(hp = 100): void { this.hp = hp; messages.push(`${this.node.name}: reuse(${hp})`); }
  override onDestroy(): void { messages.push(`${this.node.name}: onDestroy`); }
}
template.addComponent(PoolProbe);
const prefab = new Prefab(template);
const pool = new NodePool<Node>(PoolProbe);
const maxSize = 4;
const lowWater = 1;
const refillBatch = 2;
let createdCount = 0;
let reusedCount = 0;
let lastPooled: Node | null = null;
let message = "点击预热创建节点";
const makeNode = (): Node => {
  const node = instantiate(prefab);
  node.name = `Pooled${++createdCount}`;
  scene.addChild(node);
  return node;
};
const refill = (requested: number): number => {
  const count = Math.min(requested, maxSize - pool.size());
  for (let i = 0; i < count; i++) pool.put(makeNode());
  return count;
};
const render = (): void => {
  prewarm.disabled = pool.size() >= maxSize;
  status.textContent = [
    `池大小/上限: ${pool.size()}/${maxSize}`,
    `创建数量: ${createdCount}；复用取出数量: ${reusedCount}`,
    `低水位: ${lowWater}；补充批次: ${refillBatch}`,
    `最近节点: ${lastPooled ? `${lastPooled.name}; valid=${lastPooled.isValid}; HP=${lastPooled.getComponent(PoolProbe)?.hp}` : "无"}`,
    `回调: ${messages.join(" → ") || "无"}`,
    message,
    "容量/预热由应用维护；clear 清空池并请求延迟销毁。",
  ].join("\n");
};
prewarm.addEventListener("click", () => {
  const added = refill(refillBatch);
  message = `应用层预热补充 ${added} 个；最大容量为 ${maxSize}`;
  render();
});
getButton.addEventListener("click", () => {
  const pooled = pool.get(75);
  if (pooled) {
    lastPooled = pooled;
    scene.addChild(pooled);
    reusedCount++;
    message = `池命中：取回 ${pooled.name} 并调用 reuse(75)`;
  } else {
    const fresh = makeNode();
    lastPooled = fresh;
    message = `池未命中：get 返回 null，调用方实例化 ${fresh.name}`;
  }
  if (pool.size() <= lowWater) message += `；达到低水位，补充 ${refill(refillBatch)} 个`;
  render();
});
clearButton.addEventListener("click", () => {
  const retained = pool.get();
  if (retained) { lastPooled = retained; pool.put(retained); }
  const before = pool.size();
  pool.clear();
  message = `clear 请求销毁 ${before} 个节点；池清空后外部仍持有最近节点引用`;
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => { director.runSceneImmediate(scene); render(); });
