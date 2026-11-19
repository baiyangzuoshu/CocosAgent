import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";
import NodePool from "./extensions/ccpool/CCNodePool.ts";

const status = document.querySelector<HTMLPreElement>("#status");
const toggle = document.querySelector<HTMLButtonElement>("#pool-toggle");
const spawn = document.querySelector<HTMLButtonElement>("#pool-spawn");
const clear = document.querySelector<HTMLButtonElement>("#pool-clear");
if (!status || !toggle || !spawn || !clear) throw new Error("找不到状态区或对象池按钮");
const NodeClass = cc.Node;
const SceneClass = cc.Scene;
const ComponentClass = cc.Component;
const game = cc.game;
const director = cc.director;
const DirectorClass = cc.Director;
if (!NodeClass || !SceneClass || !ComponentClass || !game || !director || !DirectorClass) {
  throw new Error("Node/Scene/Component/Director 模块尚未注册");
}

class EnemyLogic extends ComponentClass {
  hp = 100;
  started = false;
  events = "";
  private record(name: string): void { this.events += `${this.events ? " → " : ""}${name}`; }
  override onLoad(): void { this.record("onLoad"); }
  override onEnable(): void { this.record("onEnable"); }
  override onDisable(): void { this.record("onDisable"); }
  override start(): void { this.started = true; this.record("start"); }
  unuse(): void { this.hp = 0; this.record("unuse"); }
  reuse(hp = 100): void { this.hp = hp; this.record(`reuse(${hp})`); }
}

const scene = new SceneClass("PoolScene");
const template = new NodeClass("Enemy");
template.addComponent(EnemyLogic);
const prefab = new Prefab(template);
const pool = new NodePool<Node>(EnemyLogic);
let currentNode: Node | null = null;
let inPool = false;
let fallbackCount = 0;
let message = "先点击“取出或新建”";

const render = (): void => {
  toggle.disabled = !currentNode || !currentNode.isValid || !currentNode.getComponent(EnemyLogic)?.started;
  clear.disabled = pool.size() === 0;
  toggle.textContent = inPool ? "取回当前节点" : "回收当前节点";
  status.textContent = [
    `池大小: ${pool.size()}`,
    `空池兜底创建次数: ${fallbackCount}`,
    currentNode ? `当前节点: ${currentNode.name}；isValid=${currentNode.isValid}；HP=${currentNode.getComponent(EnemyLogic)?.hp}` : "当前节点: 无",
    `组件回调: ${currentNode?.getComponent(EnemyLogic)?.events || "无"}`,
    message,
  ].join("\n");
};

toggle.addEventListener("click", () => {
  if (!currentNode?.isValid) return;
  if (!inPool) {
    pool.put(currentNode);
    inPool = true;
    message = "put：NodePool 调用 unuse，节点离开活动场景";
  } else {
    const previousNode = currentNode;
    const reused = pool.get(45);
    if (reused) {
      currentNode = reused;
      scene.addChild(reused);
      inPool = false;
      message = `get：NodePool 调用 reuse(45)，取回同一节点=${reused === previousNode}`;
    }
  }
  render();
});
spawn.addEventListener("click", () => {
  const pooled = pool.get(75);
  if (pooled) {
    currentNode = pooled;
    scene.addChild(pooled);
    inPool = false;
    message = `池命中：reuse(75)，取回 ${pooled.name}`;
  } else {
    currentNode = instantiate(prefab);
    currentNode.name = `EnemyFresh${++fallbackCount}`;
    scene.addChild(currentNode);
    inPool = false;
    message = `池未命中：get 返回 null，由调用方实例化 ${currentNode.name}`;
  }
  render();
});
clear.addEventListener("click", () => {
  pool.clear();
  inPool = false;
  message = "clear：已请求销毁池内节点";
  render();
});
director.on(DirectorClass.EVENT_AFTER_FRAME, render);
game.run({ frameRate: 60 }, () => {
  director.runSceneImmediate(scene);
  render();
});
