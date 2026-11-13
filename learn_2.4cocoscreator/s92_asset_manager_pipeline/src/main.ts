import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import { exampleFiles, rootUuid } from "./example-files.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const trace: string[] = [];
const manager = new CCAssetManager(exampleFiles, trace);

await manager.preloadAny(rootUuid);
const hasAssetAfterPreload = manager.assets.has(rootUuid);
const downloadedFilesAfterPreload = manager.downloaded.size;
const prefab = await manager.loadAny(rootUuid);
const samePrefab = await manager.loadAny(rootUuid);

output.textContent = [
  "Creator 2.4 AssetManager 管线",
  `正常管线: ${manager.pipeline.describe()}`,
  `预加载管线: ${manager.fetchPipeline.describe()}`,
  `预加载后文件缓存数: ${downloadedFilesAfterPreload}`,
  `预加载后 Asset 缓存命中: ${hasAssetAfterPreload}`,
  `完整加载返回: ${prefab.data.name}`,
  `完整加载后 Asset 对象数: ${manager.assets.size}`,
  `重复请求复用对象: ${prefab === samePrefab}`,
  "",
  "执行记录:",
  ...trace,
].join("\n");
