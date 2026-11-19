import cc from "./index.ts";
import type Node from "./cocos2d/core/CCNode.ts";
import Sprite from "./cocos2d/core/components/CCSprite.ts";
import SpriteFrame from "./cocos2d/core/assets/CCSpriteFrame.ts";
import type Texture2D from "./cocos2d/core/assets/CCTexture2D.ts";
import Prefab from "./cocos2d/core/assets/CCPrefab.ts";
import { instantiate } from "./cocos2d/core/platform/instantiate.ts";

const status = document.querySelector<HTMLPreElement>("#status");
if (!status) throw new Error("找不到状态节点 #status");
const NodeClass = cc.Node;
const ComponentClass = cc.Component;
if (!NodeClass || !ComponentClass) throw new Error("Node/Component 模块尚未注册");

class EnemyLogic extends ComponentClass { hp = 100; }
const prefabData = new NodeClass("Enemy");
prefabData.addComponent(EnemyLogic);
const body = new NodeClass("Body");
prefabData.addChild(body);

// 只给 SpriteFrame 提供 URL 与尺寸，不创建 HTMLImageElement 或 GPU 纹理。
const texture = { url: "memory://hero-atlas", width: 128, height: 64 } as unknown as Texture2D;
const frame = new SpriteFrame(texture, { x: 0, y: 0, width: 64, height: 64 });
const templateSprite = new Sprite(body);
templateSprite.setSpriteFrame(frame);
body.setSprite(templateSprite);
const prefab = new Prefab(prefabData);

const enemyA = instantiate(prefab);
const enemyB = instantiate(prefab);
enemyA.name = "EnemyA";
enemyB.name = "EnemyB";
const logicA = enemyA._components[0] as EnemyLogic;
const logicB = enemyB._components[0] as EnemyLogic;
logicA.hp = 60;
const bodyA = enemyA.children[0] as Node;
const bodyB = enemyB.children[0] as Node;
const spriteA = bodyA.sprite;
const spriteB = bodyB.sprite;
if (!spriteA || !spriteB || !spriteA.spriteFrame || !spriteB.spriteFrame) {
  throw new Error("Prefab 副本缺少 Sprite 或 SpriteFrame");
}
const frameA = spriteA.spriteFrame;
const frameB = spriteB.spriteFrame;
const uvText = Array.from(frameA.uv).map((value) => Number(value.toFixed(2))).join(", ");

status.textContent = [
  "对象副本与资源引用分开看：Node / Component / Sprite 是实例对象；SpriteFrame / Texture2D 是共享资源引用。",
  `Enemy Node 独立: ${enemyA !== enemyB}`,
  `EnemyLogic 独立: ${logicA !== logicB}；HP A/B=${logicA.hp}/${logicB.hp}`,
  `Body Node 独立: ${bodyA !== bodyB}`,
  `Sprite 独立: ${spriteA !== spriteB}`,
  `SpriteFrame 共享: ${frameA === frameB}`,
  `Texture2D 引用共享: ${frameA.texture === frameB.texture}`,
  `共享资源: ${frameA.texture.url}，尺寸 ${frameA.texture.width}×${frameA.texture.height}；Frame rect=${JSON.stringify(frameA.rect)}`,
  `SpriteFrame 计算出的 UV: [${uvText}]`,
  `Prefab 实例化次数: ${prefab.instantiatedTimes}；两棵树都未挂载到 Scene`,
  "texture 是只供 UV 计算的内存尺寸桩；没有加载图片、上传纹理、运行 Renderer 或 draw。",
].join("\n");
