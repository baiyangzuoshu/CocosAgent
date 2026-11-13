import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import type { AssetFile } from "./cocos2d/core/asset-manager/fetch.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const rootUuid = "2b1ac59a-eccf-4c5a-ae44-ee2313507b57";
const frameUuid = "31bc895a-c003-4566-a9f3-2e54ae1c17dc";
const files = new Map<string, AssetFile>([
  [rootUuid, { uuid: rootUuid, json: JSON.stringify({ name: "label.prefab", dependencies: [frameUuid] }) }],
  [frameUuid, { uuid: frameUuid, json: JSON.stringify({ name: "HelloWorld SpriteFrame", dependencies: [] }) }],
]);
const trace: string[] = [];
const manager = new CCAssetManager(files, trace);

await manager.preloadAny(rootUuid);
const hasAssetAfterPreload = manager.assets.has(rootUuid);
const prefab = await manager.loadAny(rootUuid);
const samePrefab = await manager.loadAny(rootUuid);

output.textContent = [
  "Creator 2.4 AssetManager 管线",
  `正常管线: ${manager.pipeline.describe()}`,
  `预加载管线: ${manager.fetchPipeline.describe()}`,
  `预加载后 Asset 缓存命中: ${hasAssetAfterPreload}`,
  `完整加载返回: ${prefab.data.name}`,
  `重复请求复用对象: ${prefab === samePrefab}`,
  "",
  "执行记录:",
  ...trace,
].join("\n");
