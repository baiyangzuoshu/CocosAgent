import { Config } from "./cocos2d/core/asset-manager/config.ts";
import { combine, packPath } from "./cocos2d/core/asset-manager/urlTransformer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const bundleMain = new Config(
  ["2bGsWa7M9MWq5E7iMTUHtX", "ecpdLyjvZBwrvm+cedCcQy"],
  { "0": ["label", 0] },
  {},
  { import: [0, "e273f"], native: [] },
);
const label = bundleMain.getPathEntry("label");
if (!label) throw new Error("BundleMain 配置里找不到 label");
const prefabUrl = combine(
  { base: "/assets/BundleMain", importBase: "import", nativeBase: "native" },
  "2bGsWa7M9MWq5E7iMTUHtX",
  ".json",
  bundleMain.getVersion(0, false),
);

const main = new Config(
  ["2dL3kvpAxJu6GJ7RdqJG5J", "6aoKpq6+5BVaCIpoemqt7E", "a8Anh32NZGRZegUtSgEj26", "31vIlawANFZqnzLlSuHBfc", "41D7kWhyFGY7q4NDlzkazn", "ecpdLyjvZBwrvm+cedCcQy"],
  {},
  { "05dd1dc0e": [0, 3, 4], "0cfd22b7a": [1, 2] },
  { import: ["05dd1dc0e", "29693", "0cfd22b7a", "b2b05"], native: [1, "a4b27", 2, "cea68"] },
);
const scenePackVersion = main.getVersion("05dd1dc0e", false);

output.textContent = [
  "Creator 2.4 Bundle Config → 文件",
  `path label → uuid ${label.uuid}`,
  `label.prefab → ${prefabUrl}`,
  `场景 UUID → pack 05dd1dc0e → ${packPath("/assets/main", "05dd1dc0e", scenePackVersion)}`,
  `贴图 native → ${combine({ base: "/assets/main", importBase: "import", nativeBase: "native" }, "6aoKpq6+5BVaCIpoemqt7E", ".png", main.getVersion(1, true), true)}`,
  "以上三条地址均对应 2.4NewProject/build/web-mobile/assets/ 中的当前文件。",
].join("\n");
