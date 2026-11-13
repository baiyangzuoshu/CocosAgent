export type OutputRole = "page" | "engine" | "startup" | "bundle-config" | "bundle-script" | "import" | "native";

export interface BuildArtifact {
  path: string;
  role: OutputRole;
  note: string;
}

export class BundleOutputMap {
  constructor(readonly artifacts: BuildArtifact[]) {}

  lines(): string[] {
    return this.artifacts.map(({ path, role, note }) => `${role.padEnd(14)} ${path}\n               ${note}`);
  }
}

// 只收录本次样例中的代表文件；不同 Creator 构建配置会产生不同目录。
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
