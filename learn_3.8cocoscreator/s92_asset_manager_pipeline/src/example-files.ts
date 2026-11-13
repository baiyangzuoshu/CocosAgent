import type { AssetFile } from "./cocos/asset/asset-manager/fetch.ts";

// 为了专注加载管线，dependencies 是第 91 课已提取好的依赖 UUID 列表。
export const rootUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
export const exampleFiles = new Map<string, AssetFile>([
  [rootUuid, {
    uuid: rootUuid,
    json: JSON.stringify({
      name: "soldier.prefab",
      dependencies: ["e3553cad-2f15-4293-859a-8f43c780f289@18751"],
    }),
  }],
  ["e3553cad-2f15-4293-859a-8f43c780f289@18751", {
    uuid: "e3553cad-2f15-4293-859a-8f43c780f289@18751",
    json: JSON.stringify({ name: "soldier mesh", dependencies: [] }),
  }],
]);
