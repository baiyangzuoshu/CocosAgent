import type { AssetFile, AssetRecord, BundleConfigData } from "./cocos/asset/asset-manager/types.ts";

const sceneUuid = "7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb";
const prefabUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
const meshUuid = "e3553cad-2f15-4293-859a-8f43c780f289@18751";
const packUrl = "/assets/main/import/06/0693a7d89.json";
const meshUrl = "/assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin";

/** 已由第 93 课查出的 Runtime 索引结果；这里不再手算压缩 UUID 和版本表。 */
export const bundleConfigData: BundleConfigData = {
  scenes: { "db://assets/scene/main.scene": sceneUuid },
  assets: new Map<string, AssetRecord>([
    [sceneUuid, { uuid: sceneUuid, type: "SceneAsset", url: packUrl, fileKind: "import" }],
    [prefabUuid, { uuid: prefabUuid, type: "Prefab", url: packUrl, fileKind: "import" }],
    [meshUuid, { uuid: meshUuid, type: "Mesh", url: meshUrl, fileKind: "native" }],
  ]),
};

/** 课程用小文件代替真实 pack 和 Mesh 数据；UUID 引用来自场景与 Prefab。 */
export const exampleFiles = new Map<string, AssetFile>([
  [packUrl, {
    url: packUrl,
    resources: new Map([
      [sceneUuid, JSON.stringify({ name: "main.scene", prefabInfo: { asset: { __uuid__: prefabUuid } } })],
      [prefabUuid, JSON.stringify({ name: "soldier.prefab", meshRenderer: { _mesh: { __uuid__: meshUuid } } })],
    ]),
  }],
  [meshUrl, {
    url: meshUrl,
    resources: new Map([[meshUuid, "soldier.mesh"]]),
  }],
]);
