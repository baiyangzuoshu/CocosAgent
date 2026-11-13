import type { ConfigData } from "./cocos2d/core/asset-manager/config.ts";

// 从 assets/BundleMain/config.5af34.json 摘出 label.prefab 相关字段。
export const bundleMainConfigData: ConfigData = {
  uuids: ["2bGsWa7M9MWq5E7iMTUHtX", "ecpdLyjvZBwrvm+cedCcQy"],
  paths: { "0": ["label", 0] },
  scenes: {},
  packs: {},
  versions: { import: [0, "e273f"], native: [] },
};

// 从 assets/main/config.a9f01.json 摘出首场景、pack 和贴图版本字段。
export const mainConfigData: ConfigData = {
  uuids: [
    "2dL3kvpAxJu6GJ7RdqJG5J",
    "6aoKpq6+5BVaCIpoemqt7E",
    "a8Anh32NZGRZegUtSgEj26",
    "31vIlawANFZqnzLlSuHBfc",
    "41D7kWhyFGY7q4NDlzkazn",
    "ecpdLyjvZBwrvm+cedCcQy",
  ],
  paths: {},
  scenes: { "db://assets/Scene/helloworld.fire": 0 },
  packs: { "05dd1dc0e": [0, 3, 4], "0cfd22b7a": [1, 2] },
  versions: {
    import: ["05dd1dc0e", "29693", "0cfd22b7a", "b2b05"],
    native: [1, "a4b27", 2, "cea68"],
  },
};
