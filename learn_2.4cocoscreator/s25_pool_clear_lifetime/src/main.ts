import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import type Component from "./cocos2d/core/components/CCComponent.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const clearButton = document.querySelector<HTMLButtonElement>("#pool-clear-timing");
const externalButton = document.querySelector<HTMLButtonElement>("#pool-external-owner");
if (!status || !clearButton || !externalButton) throw new Error("找不到状态区或清池按钮");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) {
  throw new Error("Node/Scene/Component/Director 模块尚未注册");
}

let callbacks: string[] = [];
class LifetimeProbe extends ComponentClass {
  override onLoad(): void { callbacks.push(`${this.node.name}: onLoad`); }
  override onDisable(): void { callbacks.push(`${this.node.name}: onDisable`); }
  override onDestroy(): void { callbacks.push(`${this.node.name}: onDestroy`); }
}
const scene = new SceneClass("PoolScene");
const clearPool = new NodePool<Node>();
const externalPool = new NodePool<Node>();
let clearNode: Node | null = null;
let externalNode: Node | null = null;
let snapshot = "等待操作";

const render = (): void => {
  clearButton.disabled = !!clearNode;
  externalButton.disabled = !!externalNode;
  status.textContent = [
    snapshot,
    `clearProbe: valid=${clearNode?.isValid ?? "未创建"}；池大小=${clearPool.size()}`,
    `externalProbe: valid=${externalNode?.isValid ?? "未创建"}；池大小=${externalPool.size()}`,
    `组件回调: ${callbacks.join(" → ") || "无"}`,
    "clear() 清空池数组并调用 destroy；实际失效在 Director 帧末处理，外部变量不会取消销毁请求。",
  ].join("\n");
};

const makeProbe = (name: string): Node => {
  const node = new NodeClass(name);
  node.addComponent(LifetimeProbe);
  scene.addChild(node);
  return node;
};
clearButton.addEventListener("click", () => {
  clearNode = makeProbe("ClearProbe");
  clearPool.put(clearNode);
  clearPool.clear();
  snapshot = `clear() 返回后立即：isValid=${clearNode.isValid}；池大小=${clearPool.size()}`;
  render();
});
externalButton.addEventListener("click", () => {
  externalNode = makeProbe("ExternalProbe");
  externalPool.put(externalNode);
  externalPool.clear();
  snapshot = `保留 externalNode 引用并 clear() 后立即：isValid=${externalNode.isValid}；池大小=${externalPool.size()}`;
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => director.runSceneImmediate(scene));
