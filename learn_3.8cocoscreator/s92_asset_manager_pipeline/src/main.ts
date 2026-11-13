import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import type { AssetFile } from "./cocos/asset/asset-manager/fetch.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const rootUuid = "cfc53c4e-7956-482b-aebc-3fb1dcd36eef";
const meshUuid = "e3553cad-2f15-4293-859a-8f43c780f289@18751";
const files = new Map<string, AssetFile>([
  [rootUuid, { uuid: rootUuid, json: JSON.stringify({ name: "soldier.prefab", dependencies: [meshUuid] }) }],
  [meshUuid, { uuid: meshUuid, json: JSON.stringify({ name: "soldier mesh", dependencies: [] }) }],
]);
const trace: string[] = [];
const manager = new AssetManager(files, trace);

await manager.preloadAny(rootUuid);
const hasAssetAfterPreload = manager.assets.has(rootUuid);
const prefab = await manager.loadAny(rootUuid);
const samePrefab = await manager.loadAny(rootUuid);

output.textContent = [
  "Creator 3.8 AssetManager 管线",
  `正常管线: ${manager.pipeline.describe()}`,
  `预加载管线: ${manager.fetchPipeline.describe()}`,
  `URL 转换: ${manager.transformPipeline.describe()}`,
  `预加载后 Asset 缓存命中: ${hasAssetAfterPreload}`,
  `完整加载返回: ${prefab.data.name}`,
  `重复请求复用对象: ${prefab === samePrefab}`,
  "",
  "执行记录:",
  ...trace,
].join("\n");
