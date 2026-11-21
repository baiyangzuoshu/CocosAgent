import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import Component from "./cocos2d/core/components/CCComponent.ts";
import { CCAsset } from "./cocos2d/core/assets/CCAsset.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到状态节点 #status");
const NodeClass = cc.Node;
if (!NodeClass) throw new Error("Node 模块尚未注册");

class EnemyStats extends Component {
  targetNode: Node | null = null;
  readonly asset: CCAsset;
  readonly sharedConfig: { tags: string[]; tuning: { armor: number } };
  aliasConfig: { tags: string[]; tuning: { armor: number } };
  self!: EnemyStats;

  constructor(asset: CCAsset, sharedConfig: { tags: string[]; tuning: { armor: number } }) {
    super();
    this.asset = asset;
    this.sharedConfig = sharedConfig;
    this.aliasConfig = sharedConfig;
    this.self = this;
  }
}

const template = new NodeClass("Enemy");
const body = new NodeClass("Body");
const marker = new NodeClass("Marker");
const config = { tags: ["enemy", "ground"], tuning: { armor: 25 } };
const sharedAsset = new CCAsset("enemy-data-uuid", "EnemyData");
const stats = body.addComponent(new EnemyStats(sharedAsset, config));
stats.targetNode = marker;
body.addChild(marker);
template.addChild(body);
const prefab = new Prefab(template);

// instantiate 只创建节点树副本；本课故意不把副本挂进 Scene。
const enemyA = instantiate(prefab);
const enemyB = instantiate(prefab);
enemyA.name = "EnemyA";
enemyB.name = "EnemyB";
const bodyA = enemyA.children[0] as Node;
const bodyB = enemyB.children[0] as Node;
const markerA = bodyA.children[0] as Node;
const markerB = bodyB.children[0] as Node;
const statsA = bodyA._components[0] as EnemyStats;
const statsB = bodyB._components[0] as EnemyStats;
bodyA.name = "BodyA";
bodyB.name = "BodyB";
bodyA.setPosition(12, 0);
bodyB.setPosition(-12, 0);
statsA.sharedConfig.tags.push("clone-only");
statsA.sharedConfig.tuning.armor = 99;

const formatTree = (node: Node, depth = 0): string => {
  const position = node.getPosition();
  const line = `${"  ".repeat(depth)}${node.name} @ (${position.x}, ${position.y})`;
  return [line, ...node.children.map((child) => formatTree(child as Node, depth + 1))].join("\n");
};

status.textContent = [
  "本课观察 Prefab 模板如何产生彼此独立的节点树；创建副本不等于挂载到活动场景。",
  `Prefab 实例化次数: ${prefab.instantiatedTimes}`,
  `根节点独立: ${enemyA !== enemyB}；Body 独立: ${bodyA !== bodyB}；Marker 独立: ${markerA !== markerB}`,
  `组件独立: ${statsA !== statsB}；组件.node 指向副本 Body: ${statsA.node === bodyA}`,
  `组件中的子节点引用已重映射: A=${statsA.targetNode === markerA}，B=${statsB.targetNode === markerB}`,
  `Asset 保持共享引用: 模板/A/B=${stats.asset === statsA.asset && statsA.asset === statsB.asset}`,
  `共享普通对象在各副本内保持别名: A=${statsA.sharedConfig === statsA.aliasConfig}，B=${statsB.sharedConfig === statsB.aliasConfig}`,
  `循环引用指向各自组件: A=${statsA.self === statsA}，B=${statsB.self === statsB}`,
  `修改 A 的深层数据不会影响模板/B: A=${statsA.sharedConfig.tuning.armor}, 模板=${stats.sharedConfig.tuning.armor}, B=${statsB.sharedConfig.tuning.armor}`,
  `模板仍未改名: ${template.name}；模板 Body 位置: ${JSON.stringify(body.getPosition())}`,
  `副本都未挂载: A.parent=${enemyA.getParent()?.name ?? "null"}；B.parent=${enemyB.getParent()?.name ?? "null"}`,
  "\n模板树:\n" + formatTree(template),
  "\nEnemyA 副本树:\n" + formatTree(enemyA),
  "\nEnemyB 副本树:\n" + formatTree(enemyB),
].join("\n");
