import { WebAssetRequest, type AssetRecord } from "./cocos2d/core/asset-manager/WebAssetRequest.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const sceneUuid = "2d2f792f-a40c-49bb-a189-ed176a246e49";
const frameUuid = "31bc895a-c003-4566-a9f3-2e54ae1c17dc";
const textureUuid = "6aa0aa6a-ebee-4155-a088-a687a6aadec4";
const records = new Map<string, AssetRecord>([
  [sceneUuid, { uuid: sceneUuid, type: "SceneAsset", dependencies: [frameUuid] }],
  [frameUuid, { uuid: frameUuid, type: "SpriteFrame", dependencies: [textureUuid] }],
  [textureUuid, { uuid: textureUuid, type: "Texture2D", dependencies: [] }],
]);
const manager = new WebAssetRequest(records);

await manager.load(sceneUuid, "/assets/main/import/05/05dd1dc0e.29693.json");
await manager.load(frameUuid, "/assets/main/import/05/05dd1dc0e.29693.json");
await manager.load(textureUuid, "/assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png");

output.textContent = [
  "Creator 2.4.15 · 当前构建代表性请求",
  "首场景: db://assets/Scene/helloworld.fire",
  `Asset 缓存对象数: ${manager.cache.size}`,
  "",
  ...manager.trace,
  "",
  "pack 内含 SceneAsset 与 SpriteFrame；native PNG 是贴图数据。",
  "这些是从本地构建目录核对出的 URL，不是本课程页面发出的网络请求。",
].join("\n");
