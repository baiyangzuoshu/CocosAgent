import type { AssetRecord } from "./cocos/asset/asset-manager/types.ts";

const sceneUuid = "7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb";
const soldierPrefabUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
const meshUuid = "e3553cad-2f15-4293-859a-8f43c780f289@18751";
const packUrl = "/assets/main/import/06/0693a7d89.json";

/** 依赖边与地址来自 3.8NewProject 构建产物、场景序列化和 Prefab。 */
export const sceneUuidForExample = sceneUuid;
export const assetRecords = new Map<string, AssetRecord>([
  [sceneUuid, {
    uuid: sceneUuid,
    type: "SceneAsset",
    dependencies: [soldierPrefabUuid],
    url: packUrl,
    fileKind: "import",
  }],
  [soldierPrefabUuid, {
    uuid: soldierPrefabUuid,
    type: "Prefab",
    dependencies: [meshUuid],
    url: packUrl,
    fileKind: "import",
  }],
  [meshUuid, {
    uuid: meshUuid,
    type: "Mesh",
    dependencies: [],
    url: "/assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin",
    fileKind: "native",
  }],
]);
