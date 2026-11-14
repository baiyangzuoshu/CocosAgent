import type { AssetFile, AssetRecord } from "./cocos/asset/asset-manager/types.ts";

// 沿用第 91、94 课的案例：场景 → Prefab → Mesh。
const sceneUuid = "7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb";
const prefabUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
const meshUuid = "e3553cad-2f15-4293-859a-8f43c780f289@18751";
const importUrl = "/assets/main/import/06/0693a7d89.json";
const meshUrl = "/assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin";

export const rootUuid = sceneUuid;
export const assetRecords = new Map<string, AssetRecord>([
  [sceneUuid, { uuid: sceneUuid, type: "SceneAsset", url: importUrl, fileKind: "import" }],
  [prefabUuid, { uuid: prefabUuid, type: "Prefab", url: importUrl, fileKind: "import" }],
  [meshUuid, { uuid: meshUuid, type: "Mesh", url: meshUrl, fileKind: "native" }],
]);

// 一个 import pack 包含 Scene 与 Prefab 条目；Mesh 示例指向 native 数据文件。
export const exampleFiles = new Map<string, AssetFile>([
  [importUrl, {
    url: importUrl,
    resources: new Map([
      [sceneUuid, JSON.stringify({ name: "main.scene", dependencies: [prefabUuid] })],
      [prefabUuid, JSON.stringify({ name: "soldier.prefab", dependencies: [meshUuid] })],
    ]),
  }],
  [meshUrl, {
    url: meshUrl,
    resources: new Map([[meshUuid, "soldier.mesh"]]),
  }],
]);
