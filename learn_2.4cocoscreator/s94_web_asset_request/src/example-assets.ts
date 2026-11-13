import type { AssetRecord } from "./cocos2d/core/asset-manager/types.ts";

const sceneUuid = "2d2f792f-a40c-49bb-a189-ed176a246e49";
const frameUuid = "31bc895a-c003-4566-a9f3-2e54ae1c17dc";
const textureUuid = "6aa0aa6a-ebee-4155-a088-a687a6aadec4";
const packUrl = "/assets/main/import/05/05dd1dc0e.29693.json";

/** 依赖边与地址来自 2.4NewProject 构建产物、场景序列化和 .meta。 */
export const sceneUuidForExample = sceneUuid;
export const assetRecords = new Map<string, AssetRecord>([
  [sceneUuid, {
    uuid: sceneUuid,
    type: "SceneAsset",
    dependencies: [frameUuid],
    url: packUrl,
    fileKind: "import",
  }],
  [frameUuid, {
    uuid: frameUuid,
    type: "SpriteFrame",
    dependencies: [textureUuid],
    url: packUrl,
    fileKind: "import",
  }],
  [textureUuid, {
    uuid: textureUuid,
    type: "Texture2D",
    dependencies: [],
    url: "/assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png",
    fileKind: "native",
  }],
]);
