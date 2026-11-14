import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import { assetRecords, exampleFiles, rootUuid } from "./example-files.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const trace: string[] = [];
const manager = new AssetManager(assetRecords, exampleFiles, trace);

await manager.preloadAny(rootUuid);
const assetsAfterPreload = manager.assets.size;
const filesAfterPreload = manager.downloaded.size;
const scene = await manager.loadAny(rootUuid);
const sameScene = await manager.loadAny(rootUuid);

output.textContent = [
  "Creator 3.8 AssetManager 管线",
  "load: " + manager.pipeline.describe(),
  "preload: " + manager.fetchPipeline.describe(),
  "URL 转换管线: parse → replaceOverrideAsset → combine（第 93 课展开）",
  "预加载后下载文件数: " + filesAfterPreload,
  "预加载后 Asset 对象数: " + assetsAfterPreload,
  "完整加载返回: " + scene.type + " (" + String(scene.data.name) + ")",
  "完整加载后 Asset 对象数: " + manager.assets.size,
  "重复请求复用对象: " + (scene === sameScene),
  "",
  "执行记录:",
  ...trace,
].join("\n");
