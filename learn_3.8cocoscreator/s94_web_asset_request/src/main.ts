import { WebAssetRequest, type AssetRecord } from "./cocos/asset/asset-manager/web-asset-request.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const sceneUuid = "7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb";
const soldierPrefabUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
const meshUuid = "e3553cad-2f15-4293-859a-8f43c780f289@18751";
const packUrl = "/assets/main/import/06/0693a7d89.json";
const records = new Map<string, AssetRecord>([
  [sceneUuid, { uuid: sceneUuid, type: "SceneAsset", dependencies: [soldierPrefabUuid] }],
  [soldierPrefabUuid, { uuid: soldierPrefabUuid, type: "Prefab", dependencies: [meshUuid] }],
  [meshUuid, { uuid: meshUuid, type: "Mesh", dependencies: [] }],
]);
const manager = new WebAssetRequest(records);

await manager.load(sceneUuid, packUrl);
await manager.load(soldierPrefabUuid, packUrl);
await manager.load(meshUuid, "/assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin");

output.textContent = [
  "Creator 3.8.8 · 当前构建代表性请求 · runtime source 3.8.7",
  "首场景: db://assets/scene/main.scene",
  `Asset 缓存对象数: ${manager.cache.size}`,
  "",
  ...manager.trace,
  "",
  "Scene、Prefab 和 Mesh 关系取自真实 UUID；文件 URL 对应当前 main Bundle。",
  "这些是从本地构建目录核对出的 URL，不是本课程页面发出的网络请求。",
].join("\n");
