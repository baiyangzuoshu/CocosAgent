import { Config } from "./cocos/asset/asset-manager/config.ts";
import { combine, packPath } from "./cocos/asset/asset-manager/url-transformer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const main = new Config(
  ["010d3a23c", "0693a7d89", "070e260c2", "0a40fbfd0", "7cPn+rex5IZbqEPPgbSLn7"],
  { "4": ["db:/assets/scene/main", 0, 1] },
  { "0693a7d89": [4, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61] },
);
const sceneIndex = main.getSceneIndex("db:/assets/scene/main");
if (sceneIndex === undefined) throw new Error("主 Bundle 中找不到场景路径");
const sceneUuid = main.getUuid(sceneIndex);
const scenePack = main.getPack(sceneIndex);
if (!scenePack) throw new Error("场景没有 pack 映射");
const meshCompressedUuid = "e3VTytLxVCk4Waj0PHgPKJ@18751";

output.textContent = [
  "Creator 3.8 Bundle Config → 文件",
  `场景路径 → index ${sceneIndex} → UUID ${sceneUuid}`,
  `场景 UUID → pack ${scenePack} → ${packPath("/assets/main", scenePack)}`,
  `FBX Mesh native → ${combine({ base: "/assets/main", importBase: "import", nativeBase: "native" }, meshCompressedUuid, ".bin", true)}`,
  "scene pack 和 Mesh 文件都存在于 3.8NewProject/build/web-mobile/assets/main/。",
  "3.8 UUID 解码会保留 @ 子资源 ID。",
].join("\n");
