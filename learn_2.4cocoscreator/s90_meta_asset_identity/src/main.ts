import { findSource } from "./cocos2d/core/assets/AssetMeta.ts";
import { bundleFolderMeta, sceneReferences, textureMeta } from "./example-meta.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

output.textContent = [
  "Creator 2.4 .meta 身份查找",
  `Texture 主 UUID: ${textureMeta.uuid}`,
  `SpriteFrame UUID: ${textureMeta.subMetas.HelloWorld.uuid}`,
  `SpriteFrame.rawTextureUuid: ${textureMeta.subMetas.HelloWorld.rawTextureUuid}`,
  "",
  ...sceneReferences.map((uuid) => `场景引用 ${uuid} → ${findSource([textureMeta], uuid) ?? "本示例元数据未收录"}`),
  `BundleMain 目录 .meta isBundle: ${bundleFolderMeta.isBundle}`,
  "结论：场景引用 SpriteFrame 子 UUID；贴图主 UUID 是它的依赖。",
].join("\n");
