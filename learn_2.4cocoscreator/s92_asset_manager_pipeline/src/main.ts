import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import { assetRecords, exampleFiles, frameUuid, rootUuid } from "./example-files.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

const trace: string[] = [];
const manager = new CCAssetManager(assetRecords, exampleFiles, trace);

await manager.preloadAny(rootUuid);
const assetsAfterPreload = manager.assets.size;
const filesAfterPreload = manager.downloaded.size;
const scene = await manager.loadAny(rootUuid);
const spriteFrame = await manager.loadAny(frameUuid);
const sameSpriteFrame = await manager.loadAny(frameUuid);

output.textContent = [
  "Creator 2.4 AssetManager 管线",
  "load: " + manager.pipeline.describe(),
  "preload: " + manager.fetchPipeline.describe(),
  "预加载后下载文件数: " + filesAfterPreload,
  "预加载后通用 Asset 缓存对象数: " + assetsAfterPreload,
  "完整加载返回: " + scene.type + " (" + String(scene.data.name) + ")",
  "完整加载后通用 Asset 缓存对象数: " + manager.assets.size,
  "SceneAsset 是否进入通用 Asset 缓存: " + manager.assets.has(rootUuid),
  "SpriteFrame 重复请求复用对象: " + (spriteFrame === sameSpriteFrame),
  "",
  "执行记录:",
  ...trace,
].join("\n");
