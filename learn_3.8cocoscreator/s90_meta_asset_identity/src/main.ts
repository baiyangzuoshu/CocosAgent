import { findSource, type AssetMeta } from "./cocos/asset/assets/AssetMeta.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const soldierMeta: AssetMeta = {
  uuid: "e3553cad-2f15-4293-859a-8f43c780f289",
  importer: "fbx",
  imported: true,
  subMetas: {
    "18751": { uuid: "e3553cad-2f15-4293-859a-8f43c780f289@18751", importer: "gltf-mesh" },
    "73b7f": { uuid: "e3553cad-2f15-4293-859a-8f43c780f289@73b7f", importer: "gltf-animation" },
    "30732": { uuid: "e3553cad-2f15-4293-859a-8f43c780f289@30732", importer: "gltf-skeleton" },
  },
};
const prefabUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
const prefabReferences = ["e3553cad-2f15-4293-859a-8f43c780f289@18751"];
const bundleDirectoryMeta: AssetMeta = {
  uuid: "70a96ae5-291e-4f82-a93a-26b9b943711c",
  importer: "directory",
  imported: true,
  subMetas: {},
  userData: {},
};

output.textContent = [
  "Creator 3.8 .meta 身份查找",
  `FBX 主 UUID: ${soldierMeta.uuid}`,
  ...Object.values(soldierMeta.subMetas).map((sub) => `  ${sub.importer}: ${sub.uuid}`),
  `场景 → Prefab: ${prefabUuid}`,
  `Prefab → FBX 子资源: ${prefabReferences.join(", ")}`,
  `Prefab UUID 是 FBX 主 UUID: ${prefabUuid === soldierMeta.uuid}`,
  `BundleMain 目录 .meta userData: ${JSON.stringify(bundleDirectoryMeta.userData)}`,
  `查询 Mesh 子资源: ${findSource(soldierMeta, "e3553cad-2f15-4293-859a-8f43c780f289@18751")}`,
  "项目 Bundle 配置与资源 .meta 是两类数据。",
].join("\n");
