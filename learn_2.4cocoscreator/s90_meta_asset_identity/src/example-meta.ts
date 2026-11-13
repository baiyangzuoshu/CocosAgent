import type { AssetMeta } from "./cocos2d/core/assets/AssetMeta.ts";

// 从 Texture/HelloWorld.png.meta 摘取本课要追的字段。
export const textureMeta: AssetMeta = {
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

// 从 helloworld.fire 中 Sprite._spriteFrame.__uuid__ 摘出的资源引用。
export const sceneReferences = [
  "31bc895a-c003-4566-a9f3-2e54ae1c17dc",
  "2b1ac59a-eccf-4c5a-ae44-ee2313507b57",
];

// 从 BundleMain.meta 摘取 Bundle 标记。
export const bundleFolderMeta: AssetMeta = {
  uuid: "fe4c34e3-5582-4284-91fa-7cd90ae1d5ce",
  importer: "folder",
  subMetas: {},
  isBundle: true,
};
