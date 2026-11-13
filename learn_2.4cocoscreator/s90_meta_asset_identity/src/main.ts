import { findSource, type AssetMeta } from "./cocos2d/core/assets/AssetMeta.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const textureMeta: AssetMeta = {
  uuid: "6aa0aa6a-ebee-4155-a088-a687a6aadec4",
  importer: "texture",
  subMetas: {
    HelloWorld: {
      uuid: "31bc895a-c003-4566-a9f3-2e54ae1c17dc",
      importer: "sprite-frame",
      rawTextureUuid: "6aa0aa6a-ebee-4155-a088-a687a6aadec4",
    },
  },
};
const sceneReferences = [
  "31bc895a-c003-4566-a9f3-2e54ae1c17dc",
  "2b1ac59a-eccf-4c5a-ae44-ee2313507b57",
];
const bundleFolder: AssetMeta = {
  uuid: "fe4c34e3-5582-4284-91fa-7cd90ae1d5ce",
  importer: "folder",
  subMetas: {},
  isBundle: true,
};

output.textContent = [
  "Creator 2.4 .meta 身份查找",
  `Texture 主 UUID: ${textureMeta.uuid}`,
  `SpriteFrame UUID: ${textureMeta.subMetas.HelloWorld.uuid}`,
  `SpriteFrame.rawTextureUuid: ${textureMeta.subMetas.HelloWorld.rawTextureUuid}`,
  "",
  ...sceneReferences.map((uuid) => `场景引用 ${uuid} → ${findSource([textureMeta], uuid) ?? "本示例元数据未收录"}`),
  `BundleMain 目录 .meta isBundle: ${bundleFolder.isBundle}`,
  "结论：场景引用 SpriteFrame 子 UUID；贴图主 UUID 是它的依赖。",
].join("\n");
