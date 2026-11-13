import { Config } from "./cocos/asset/asset-manager/config.ts";
import { combine, packPath } from "./cocos/asset/asset-manager/url-transformer.ts";
import { decodeUuid } from "./cocos/core/utils/decode-uuid.ts";
import { mainConfigData, meshCompressedUuid } from "./example-config.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

// 这是 3.8NewProject/build/web-mobile/assets/main/config.json 的相关字段节选。
const main = new Config(mainConfigData);

const scene = main.getScene("db://assets/scene/main.scene");
if (!scene) throw new Error("main Config 里找不到首场景");
const scenePathIndex = main.getPathIndex("db:/assets/scene/main");
const scenePack = main.getPack(scene.index);
if (!scenePack) throw new Error("场景 UUID 没有 pack 映射");

// 上面的示例配置只节选了场景索引；Mesh UUID 单独摘出供本课继续追踪。
const meshUuid = decodeUuid(meshCompressedUuid);
const meshUrl = combine(
  { base: "/assets/main", importBase: "import", nativeBase: "native" },
  meshCompressedUuid,
  ".bin",
  true,
);

output.textContent = [
  "Creator 3.8 · 一步步查 Bundle Config",
  "",
  "首场景路径",
  "  db://assets/scene/main.scene",
  `  → scenes 查到 uuids[${scene.index}]`,
  `  → UUID ${scene.uuid}`,
  `  → paths 中的资源索引 ${scenePathIndex}`,
  `  → packs 查到 ${scenePack}`,
  `  → ${packPath("/assets/main", scenePack)}`,
  "",
  `Mesh UUID 解码前（config.uuids[51]）: ${meshCompressedUuid}`,
  `Mesh UUID 解码后（保留 @18751）: ${meshUuid}`,
  `  → ${combine({ base: "/assets/main", importBase: "import", nativeBase: "native" }, meshCompressedUuid, ".bin", true)}`,
  `Mesh 文件地址: ${meshUrl}`,
  "",
  "这些节选来自当前构建配置；只实现本课追踪需要的字段。",
].join("\n");
