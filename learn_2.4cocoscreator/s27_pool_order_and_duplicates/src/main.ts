import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const run = document.querySelector<HTMLButtonElement>("#pool-order-demo");
if (!status || !run) throw new Error("找不到状态区或演示按钮");
const NodeClass = cc.Node;
if (!NodeClass) throw new Error("Node 模块尚未注册");

const pool = new NodePool<Node>();
const nodeA = new NodeClass("A");
const nodeB = new NodeClass("B");
const duplicatePool = new NodePool<Node>();
const duplicateNode = new NodeClass("Duplicate");
let done = false;

run.addEventListener("click", () => {
  if (done) return;
  pool.put(nodeA);
  pool.put(nodeB);
  const order = [pool.get()?.name, pool.get()?.name];
  const firstAccepted = duplicatePool.put(duplicateNode);
  const duplicateAccepted = duplicatePool.put(duplicateNode);
  status.textContent = [
    `put A → B，get 顺序: ${order.join(" → ")}（LIFO）`,
    `重复 put 首次/第二次接受: ${firstAccepted}/${duplicateAccepted}`,
    `重复保护后池大小: ${duplicatePool.size()}`,
    "本课只演示 NodePool 的数组顺序和对象身份检查。",
  ].join("\n");
  done = true;
});
