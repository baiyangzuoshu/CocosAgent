import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const run = document.querySelector<HTMLButtonElement>("#pool-dispose-demo");
if (!status || !run) throw new Error("找不到状态区或 dispose 按钮");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !game || !director || !DirectorClass) {
  throw new Error("Node/Scene/Director 模块尚未注册");
}

const scene = new SceneClass("PoolScene");
const pool = new NodePool<Node>();
const node = new NodeClass("PooledNode");
let acceptedBefore = false;
let operation = "等待关闭对象池";

const render = (): void => {
  status.textContent = [
    `dispose 前 put 接受: ${acceptedBefore}`,
    `池大小: ${pool.size()}`,
    `isDisposed: ${pool.isDisposed()}`,
    `池内节点 isValid: ${node.isValid}`,
    operation,
    "dispose 会关闭池并请求销毁池内节点；实际销毁由 Director 在帧末处理。",
  ].join("\n");
};
run.addEventListener("click", () => {
  if (pool.isDisposed()) return;
  pool.dispose();
  const sizeAfterFirst = pool.size();
  const disposedAfterFirst = pool.isDisposed();
  pool.dispose();
  const disposedAfterSecond = pool.isDisposed();
  const rejectedNode = new NodeClass("RejectedNode");
  const acceptedAfterDispose = pool.put(rejectedNode);
  if (!acceptedAfterDispose) rejectedNode.destroy();
  const getAfterDispose = pool.get();
  operation = `第一次 dispose 后 size=${sizeAfterFirst}；重复关闭仍关闭=${disposedAfterSecond}；关闭后 put/get 接收/有值=${acceptedAfterDispose}/${getAfterDispose !== null}`;
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  scene.addChild(node);
  acceptedBefore = pool.put(node);
  render();
});
