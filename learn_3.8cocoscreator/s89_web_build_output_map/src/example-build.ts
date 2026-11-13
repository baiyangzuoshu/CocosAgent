import { BundleOutputMap } from "./cocos/asset/asset-manager/BundleOutputMap.ts";

// 当前 3.8NewProject/build/web-mobile/ 的代表文件；构建配置会改变输出清单。
export const currentWebBuild = new BundleOutputMap([
  { path: "index.html", role: "page", note: "浏览器页面" },
  { path: "application.js", role: "startup", note: "应用初始化与启动入口" },
  { path: "index.js", role: "startup", note: "项目运行入口" },
  { path: "cocos-js/cc.js", role: "engine", note: "Creator 3.8 Web 引擎模块" },
  { path: "src/settings.json", role: "startup", note: "引擎、资源、场景和渲染设置" },
  { path: "assets/main/config.json", role: "bundle-config", note: "主 Bundle 索引" },
  { path: "assets/main/index.js", role: "bundle-script", note: "主 Bundle 脚本入口" },
  { path: "assets/main/import/06/0693a7d89.json", role: "import", note: "合并后的序列化资源包" },
  { path: "assets/main/native/e3/e3553cad-2f15-4293-859a-8f43c780f289@18751.bin", role: "native", note: "FBX 网格子资源文件" },
  { path: "assets/internal/config.json", role: "bundle-config", note: "内置资源索引" },
]);
