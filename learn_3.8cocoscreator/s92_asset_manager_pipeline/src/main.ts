import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import { exampleFiles, rootUuid } from "./example-files.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const trace: string[] = [];
const manager = new AssetManager(exampleFiles, trace);

await manager.preloadAny(rootUuid);
const hasAssetAfterPreload = manager.assets.has(rootUuid);
const downloadedFilesAfterPreload = manager.downloaded.size;
const prefab = await manager.loadAny(rootUuid);
const samePrefab = await manager.loadAny(rootUuid);

output.textContent = [
  "Creator 3.8 AssetManager 管线",
  `正常管线: ${manager.pipeline.describe()}`,
  `预加载管线: ${manager.fetchPipeline.describe()}`,
  "另有 URL 转换管线: parse → replaceOverrideAsset → combine（第 93 课展开）",
  `预加载后文件缓存数: ${downloadedFilesAfterPreload}`,
  `预加载后 Asset 缓存命中: ${hasAssetAfterPreload}`,
  `完整加载返回: ${prefab.data.name}`,
  `完整加载后 Asset 对象数: ${manager.assets.size}`,
  `重复请求复用对象: ${prefab === samePrefab}`,
  "",
  "执行记录:",
  ...trace,
].join("\n");
