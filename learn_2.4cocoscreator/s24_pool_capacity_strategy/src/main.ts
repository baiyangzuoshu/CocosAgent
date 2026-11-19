import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const prewarm = document.querySelector<HTMLButtonElement>("#pool-capacity-demo");
const getButton = document.querySelector<HTMLButtonElement>("#pool-prewarm-get");
const putButton = document.querySelector<HTMLButtonElement>("#pool-toggle");
if (!status || !prewarm || !getButton || !putButton) throw new Error("找不到状态区或对象池按钮");
const NodeClass = cc.Node;
if (!NodeClass) throw new Error("Node 模块尚未注册");

const template = new NodeClass("PrewarmedNode");
const prefab = new Prefab(template);
const pool = new NodePool<Node>();
const maxSize = 4;
const lowWater = 1;
const refillBatch = 2;
let createdCount = 0;
let reusedCount = 0;
let message = "点击预热创建节点";

const makeNode = (): Node => {
  const node = instantiate(prefab);
  node.name = `Node${++createdCount}`;
  return node;
};
const refill = (requested: number): number => {
  const count = Math.min(requested, maxSize - pool.size());
  for (let i = 0; i < count; i++) pool.put(makeNode());
  return count;
};
const render = (): void => {
  prewarm.disabled = pool.size() >= maxSize;
  getButton.disabled = pool.size() === 0;
  status.textContent = [
    `池大小/上限: ${pool.size()}/${maxSize}`,
    `创建数量: ${createdCount}；复用取出数量: ${reusedCount}`,
    `低水位: ${lowWater}；补充批次: ${refillBatch}`,
    message,
  ].join("\n");
};

prewarm.addEventListener("click", () => {
  const added = refill(refillBatch);
  message = `预热补充 ${added} 个；未超过容量上限`;
  render();
});
getButton.addEventListener("click", () => {
  const node = pool.get();
  if (!node) return;
  reusedCount++;
  message = `取出 ${node.name}；get 没有创建新节点`;
  if (pool.size() <= lowWater) {
    const added = refill(refillBatch);
    message += `；达到低水位，补充 ${added} 个`;
  }
  render();
});
putButton.addEventListener("click", () => {
  if (pool.size() >= maxSize) {
    message = "应用层发现容量已满，不创建额外节点";
  } else {
    const node = makeNode();
    pool.put(node);
    message = `应用层接受 ${node.name}`;
  }
  render();
});
render();
