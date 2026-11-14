import type { AssetFile, AssetRecord } from "./cocos2d/core/asset-manager/types.ts";

// 沿用第 91、94 课的案例：场景 → SpriteFrame → Texture2D。
const sceneUuid = "2d2f792f-a40c-49bb-a189-ed176a246e49";
const frameUuid = "31bc895a-c003-4566-a9f3-2e54ae1c17dc";
const textureUuid = "6aa0aa6a-ebee-4155-a088-a687a6aadec4";
const importUrl = "/assets/main/import/05/05dd1dc0e.29693.json";
const textureUrl = "/assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png";

export const rootUuid = sceneUuid;
export const assetRecords = new Map<string, AssetRecord>([
  [sceneUuid, { uuid: sceneUuid, type: "SceneAsset", url: importUrl, fileKind: "import" }],
  [frameUuid, { uuid: frameUuid, type: "SpriteFrame", url: importUrl, fileKind: "import" }],
  [textureUuid, { uuid: textureUuid, type: "Texture2D", url: textureUrl, fileKind: "native" }],
]);

// 一个 import pack 包含两个资源条目；Texture2D 的 PNG 是另一个文件。
export const exampleFiles = new Map<string, AssetFile>([
  [importUrl, {
    url: importUrl,
    resources: new Map([
      [sceneUuid, JSON.stringify({ name: "helloworld.fire", dependencies: [frameUuid] })],
      [frameUuid, JSON.stringify({ name: "HelloWorld SpriteFrame", dependencies: [textureUuid] })],
    ]),
  }],
  [textureUrl, {
    url: textureUrl,
    resources: new Map([[textureUuid, "HelloWorld.png"]]),
  }],
]);
