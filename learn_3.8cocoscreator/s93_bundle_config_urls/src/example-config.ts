import type { ConfigData } from "./cocos/asset/asset-manager/config.ts";

// 从 assets/main/config.json 摘出场景、路径和 pack 的必要字段。
export const mainConfigData: ConfigData = {
  uuids: [
    "010d3a23c",
    "0693a7d89",
    "070e260c2",
    "0a40fbfd0",
    "7cPn+rex5IZbqEPPgbSLn7",
  ],
  paths: { "4": ["db:/assets/scene/main", 0, 1] },
  scenes: { "db://assets/scene/main.scene": 4 },
  packs: { "0693a7d89": [4, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61] },
};

// config.uuids[51] 是当前构建中的 Mesh 子资源压缩 UUID。
export const meshCompressedUuid = "e3VTytLxVCk4Waj0PHgPKJ@18751";
