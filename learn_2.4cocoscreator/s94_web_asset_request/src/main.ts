import { CCAssetManager } from "./cocos2d/core/asset-manager/CCAssetManager.ts";
import { bundleConfigData, exampleFiles, frameUuid } from "./example-assets.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

// 从场景工程路径进入：Bundle 查 UUID，AssetManager 再走 load 管线。
const manager = new CCAssetManager(bundleConfigData, exampleFiles);
const scenePath = "db://assets/Scene/helloworld.fire";
const sceneAsset = await manager.loadScene(scenePath);
const spriteFrame = await manager.loadAny(frameUuid);
const sameSpriteFrame = await manager.loadAny(frameUuid);

output.textContent = [
  "Creator 2.4.15 · 从场景递归加载资源",
  "入口: Bundle.loadScene(" + scenePath + ")",
  "",
  "课程模型的文件 GET 数: " + manager.trace.filter((line) => line.startsWith("GET ")).length,
  "通用 Asset 缓存对象数: " + manager.assets.size,
  "SceneAsset 是否进入通用 Asset 缓存: " + manager.assets.has(sceneAsset.uuid),
  "SpriteFrame 重复请求复用对象: " + (spriteFrame === sameSpriteFrame),
  "",
  ...manager.trace,
  "",
  "预期：一个 import pack GET + 一个 native PNG GET；SceneAsset 返回但不进通用 Asset 缓存，SpriteFrame 和 Texture2D 会缓存。",
  "GET 是课程模型记录，不是浏览器 Network 实测。",
].join("\n");
