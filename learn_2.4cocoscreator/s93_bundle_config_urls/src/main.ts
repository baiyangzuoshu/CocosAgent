import { Config } from "./cocos2d/core/asset-manager/config.ts";
import { combine, packPath } from "./cocos2d/core/asset-manager/urlTransformer.ts";
import { bundleMainConfigData, mainConfigData } from "./example-config.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

// 这是 2.4NewProject/build/web-mobile/assets/BundleMain/config.5af34.json
// 中与 label.prefab 有关的字段节选。
const bundleMain = new Config(bundleMainConfigData);
const label = bundleMain.getPathEntry("label");
if (!label) throw new Error("BundleMain Config 里找不到 label");
const labelVersion = bundleMain.getVersion(label.index, false);
const labelUrl = combine(
  { base: "/assets/BundleMain", importBase: "import", nativeBase: "native" },
  bundleMain.data.uuids[label.index],
  ".json",
  labelVersion,
);

// 这是 main/config.a9f01.json 中与首场景和贴图有关的字段节选。
const main = new Config(mainConfigData);

const scene = main.getScene("db://assets/Scene/helloworld.fire");
if (!scene) throw new Error("main Config 里找不到首场景");
const scenePack = main.getPack(scene.index);
if (!scenePack) throw new Error("场景 UUID 没有 pack 映射");
const scenePackVersion = main.getVersion(scenePack, false);

const textureUuid = main.getUuid(1);
const textureVersion = main.getVersion(1, true);
const textureUrl = combine(
  { base: "/assets/main", importBase: "import", nativeBase: "native" },
  textureUuid,
  ".png",
  textureVersion,
  true,
);

output.textContent = [
  "Creator 2.4 · 一步步查 Bundle Config",
  "",
  "首场景路径",
  "  db://assets/Scene/helloworld.fire",
  `  → scenes 查到 uuids[${scene.index}]`,
  `  → UUID ${scene.uuid}`,
  `  → packs 查到 ${scenePack}`,
  `  → versions.import 查到 ${scenePackVersion}`,
  `  → ${packPath("/assets/main", scenePack, scenePackVersion)}`,
  "",
  "BundleMain 的 label.prefab",
  `  path label → uuids[${label.index}] → ${label.uuid}`,
  `  → import 版本 ${labelVersion}`,
  `  → ${labelUrl}`,
  "",
  `贴图 UUID ${textureUuid} → native 版本 ${textureVersion}`,
  `  → ${textureUrl}`,
  "",
  "这些节选来自当前构建配置；只实现本课追踪需要的字段。",
].join("\n");
