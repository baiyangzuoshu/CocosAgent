import { AssetManager } from "./cocos/asset/asset-manager/asset-manager.ts";
import { assetRecords, sceneUuidForExample } from "./example-assets.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

// main 只负责组装本课示例并发起入口请求；加载细节在 AssetManager 模块。
const manager = new AssetManager(assetRecords);
const firstLoad = await manager.load(sceneUuidForExample);
const secondLoad = await manager.load(sceneUuidForExample);

output.textContent = [
  "Creator 3.8.8 · 从场景递归加载资源 · runtime source 3.8.7",
  "首场景: db://assets/scene/main.scene",
  "",
  `课程模型的文件 GET 数: ${manager.trace.filter((line) => line.startsWith("GET ")).length}`,
  `Asset 对象数: ${manager.assets.size}`,
  `重复 load 是否复用同一个对象: ${firstLoad === secondLoad}`,
  "",
  ...manager.trace,
  "",
  "预期：一个 import pack GET + 一个 native Mesh GET；生成三个独立 Asset 对象；第二次 load 命中 Asset 缓存。",
  "GET 是课程模型记录，不是浏览器 Network 实测。",
].join("\n");
