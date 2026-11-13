import type { AssetFile } from "./cocos2d/core/asset-manager/fetch.ts";

// 为了专注加载管线，dependencies 是第 91 课已提取好的依赖 UUID 列表。
export const rootUuid = "2b1ac59a-eccf-4c5a-ae44-ee2313507b57";
export const exampleFiles = new Map<string, AssetFile>([
  [rootUuid, {
    uuid: rootUuid,
    json: JSON.stringify({
      name: "label.prefab",
      dependencies: ["31bc895a-c003-4566-a9f3-2e54ae1c17dc"],
    }),
  }],
  ["31bc895a-c003-4566-a9f3-2e54ae1c17dc", {
    uuid: "31bc895a-c003-4566-a9f3-2e54ae1c17dc",
    json: JSON.stringify({ name: "HelloWorld SpriteFrame", dependencies: [] }),
  }],
]);
