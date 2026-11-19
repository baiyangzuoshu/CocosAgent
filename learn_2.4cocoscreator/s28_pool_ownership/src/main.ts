import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const run = document.querySelector<HTMLButtonElement>("#pool-single-owner");
if (!status || !run) throw new Error("找不到状态区或归属测试按钮");
const NodeClass = cc.Node;
if (!NodeClass) throw new Error("Node 模块尚未注册");

const poolA = new NodePool<Node>();
const poolB = new NodePool<Node>();
const sharedNode = new NodeClass("SharedNode");

run.addEventListener("click", () => {
  run.disabled = true;
  const acceptedByA = poolA.put(sharedNode);
  const rejectedByB = poolB.put(sharedNode);
  const fromA = poolA.get();
  const acceptedByBAfterTransfer = fromA ? poolB.put(fromA) : false;
  const fromB = poolB.get();
  status.textContent = [
    `PoolA 首次接收: ${acceptedByA}`,
    `仍由 A 持有时 PoolB 接收: ${rejectedByB}`,
    `从 A 取出后转交 B: ${acceptedByBAfterTransfer}`,
    `最终仍是原节点: ${fromA === fromB && fromB === sharedNode}`,
    `最终池大小 A/B: ${poolA.size()}/${poolB.size()}`,
  ].join("\n");
});
