import { CCAsset } from "./cocos2d/core/assets/CCAsset.ts";
import { DependencyGraph } from "./cocos2d/core/asset-manager/depend-util.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const scene = new CCAsset("2d2f792f-a40c-49bb-a189-ed176a246e49", "SceneAsset");
const frame = new CCAsset("31bc895a-c003-4566-a9f3-2e54ae1c17dc", "SpriteFrame");
const texture = new CCAsset("6aa0aa6a-ebee-4155-a088-a687a6aadec4", "Texture2D");
const graph = new DependencyGraph();
graph.add(scene._uuid, frame._uuid);
graph.add(frame._uuid, texture._uuid);
texture.addRef();

output.textContent = [
  "Creator 2.4 Asset 依赖模型",
  ...graph.edges().map(({ owner, dependency }) => `${owner} → ${dependency}`),
  "",
  `场景递归依赖: ${graph.collect(scene._uuid).join(" → ")}`,
  `Texture Asset.refCount: ${texture.refCount}`,
  "场景序列化里出现 SpriteFrame UUID；rawTextureUuid 再指向贴图主资源。",
].join("\n");
