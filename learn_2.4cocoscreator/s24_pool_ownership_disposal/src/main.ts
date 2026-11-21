import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const run = document.querySelector<HTMLButtonElement>("#pool-safety-demo");
if (!status || !run) throw new Error("找不到状态区或检查按钮");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) throw new Error("引擎模块尚未注册");

const scene = new SceneClass("PoolSafetyScene");
const poolA = new NodePool<Node>();
const poolB = new NodePool<Node>();
const nodeA = new NodeClass("A");
const nodeB = new NodeClass("B");
const duplicate = new NodeClass("Duplicate");
const pooled = new NodeClass("DisposedFromPool");
class DestroyProbe extends ComponentClass { override onDestroy(): void { lifecycle.push("onDestroy"); } }
pooled.addComponent(DestroyProbe);
const lifecycle: string[] = [];
let hasRun = false;
let result = "等待检查";
let retained: Node | null = null;

const render = (): void => {
  status.textContent = [
    result,
    `PoolA/PoolB 大小: ${poolA.size()}/${poolB.size()}`,
    `PoolA 已关闭: ${poolA.isDisposed()}`,
    `保留节点 isValid: ${retained?.isValid ?? "尚未关闭"}`,
    `生命周期: ${lifecycle.join(" → ") || "无"}`,
  ].join("\n");
};
run.addEventListener("click", () => {
  if (hasRun) return;
  hasRun = true;
  const scenePool = new NodePool<Node>();
  scenePool.put(nodeA);
  scenePool.put(nodeB);
  const lifo = `${scenePool.get()?.name} → ${scenePool.get()?.name}`;
  const firstPut = poolA.put(duplicate);
  const duplicatePut = poolA.put(duplicate);
  const crossPoolPut = poolB.put(duplicate);
  const transferred = poolA.get();
  const transferAfterGet = transferred ? poolB.put(transferred) : false;
  const finalTransfer = poolB.get() === duplicate;
  scene.addChild(pooled);
  const acceptedForDispose = poolA.put(pooled);
  retained = pooled;
  poolA.dispose();
  const closedOnce = poolA.isDisposed();
  poolA.dispose();
  const putAfterClose = poolA.put(new NodeClass("RejectedAfterDispose"));
  const getAfterClose = poolA.get();
  result = [
    `put A → B 后 get 顺序: ${lifo}（LIFO）`,
    `首次入池/重复入池/仍在 A 时给 B: ${firstPut}/${duplicatePut}/${crossPoolPut}` ,
    `从 A 取出后转给 B/仍为原节点: ${transferAfterGet}/${finalTransfer}` ,
    `dispose 前接收=${acceptedForDispose}；幂等关闭=${closedOnce && poolA.isDisposed()}` ,
    `关闭后 put/get 接收/有值=${putAfterClose}/${getAfterClose !== null}` ,
    `clear 后池大小=${poolA.size()}；外部仍持有节点引用`,
  ].join("\n");
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => { director.runSceneImmediate(scene); render(); });
