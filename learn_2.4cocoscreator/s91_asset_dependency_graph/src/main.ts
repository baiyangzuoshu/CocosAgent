import { CCAsset } from "./cocos2d/core/assets/CCAsset.ts";
import { collectUuidReferences, DependencyGraph } from "./cocos2d/core/asset-manager/depend-util.ts";
import { frameUuid, sceneUuid, serializedSpriteReference, spriteFrameMeta } from "./example-dependencies.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const scene = new CCAsset(sceneUuid, "SceneAsset");
const frame = new CCAsset(frameUuid, "SpriteFrame");
const graph = new DependencyGraph();

for (const uuid of collectUuidReferences(serializedSpriteReference)) graph.add(scene._uuid, uuid);
graph.add(frame._uuid, spriteFrameMeta.rawTextureUuid);

output.textContent = [
  "Creator 2.4 Asset 依赖模型",
  ...graph.edges().map(({ owner, dependency }) => `${owner} → ${dependency}`),
  "",
  `Scene 序列化 UUID 引用: ${collectUuidReferences(serializedSpriteReference).join(", ")}`,
  `SpriteFrame.rawTextureUuid: ${spriteFrameMeta.rawTextureUuid}`,
  `场景递归依赖: ${graph.collect(scene._uuid).join(" → ")}`,
  "场景序列化里出现 SpriteFrame UUID；rawTextureUuid 再指向贴图主资源。",
].join("\n");
