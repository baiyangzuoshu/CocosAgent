import type { AssetFile, AssetRecord, BundleConfigData } from "./cocos2d/core/asset-manager/types.ts";

const sceneUuid = "2d2f792f-a40c-49bb-a189-ed176a246e49";
const frameUuid = "31bc895a-c003-4566-a9f3-2e54ae1c17dc";
const textureUuid = "6aa0aa6a-ebee-4155-a088-a687a6aadec4";
const packUrl = "/assets/main/import/05/05dd1dc0e.29693.json";
const textureUrl = "/assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png";

/** 已由第 93 课查出的 Runtime 索引结果；这里不再手算压缩 UUID 和版本表。 */
export const bundleConfigData: BundleConfigData = {
  scenes: { "db://assets/Scene/helloworld.fire": sceneUuid },
  assets: new Map<string, AssetRecord>([
    [sceneUuid, { uuid: sceneUuid, type: "SceneAsset", url: packUrl, fileKind: "import" }],
    [frameUuid, { uuid: frameUuid, type: "SpriteFrame", url: packUrl, fileKind: "import" }],
    [textureUuid, { uuid: textureUuid, type: "Texture2D", url: textureUrl, fileKind: "native" }],
  ]),
};

/** 课程用小文件代替真实 pack 和 PNG；依赖字段从真实场景/.meta 关系摘取。 */
export const exampleFiles = new Map<string, AssetFile>([
  [packUrl, {
    url: packUrl,
    resources: new Map([
      [sceneUuid, JSON.stringify({ name: "helloworld.fire", sprite: { _spriteFrame: { __uuid__: frameUuid } } })],
      [frameUuid, JSON.stringify({ name: "HelloWorld SpriteFrame", _texture: { __uuid__: textureUuid } })],
    ]),
  }],
  [textureUrl, {
    url: textureUrl,
    resources: new Map([[textureUuid, "HelloWorld.png"]]),
  }],
]);
