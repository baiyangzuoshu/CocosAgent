import type { AssetMeta } from "./cocos/asset/assets/AssetMeta.ts";

// 从 soldier.FBX.meta 摘取主资源和 Mesh/Skeleton/Animation 子资源 UUID。
export const soldierMeta: AssetMeta = {
  uuid: "e3553cad-2f15-4293-859a-8f43c780f289",
  importer: "fbx",
  imported: true,
  subMetas: {
    "18751": { uuid: "e3553cad-2f15-4293-859a-8f43c780f289@18751", importer: "gltf-mesh" },
    "73b7f": { uuid: "e3553cad-2f15-4293-859a-8f43c780f289@73b7f", importer: "gltf-animation" },
    "30732": { uuid: "e3553cad-2f15-4293-859a-8f43c780f289@30732", importer: "gltf-skeleton" },
  },
};

// 从 main.scene 和 soldier.prefab 里摘取本课追踪的引用。
export const prefabUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
export const prefabReferences = ["e3553cad-2f15-4293-859a-8f43c780f289@18751"];

// 来自 BundleMain.meta；这只是目录身份，不含 Bundle 配置。
export const bundleDirectoryMeta: AssetMeta = {
  uuid: "70a96ae5-291e-4f82-a93a-26b9b943711c",
  importer: "directory",
  imported: true,
  subMetas: {},
  userData: {},
};
