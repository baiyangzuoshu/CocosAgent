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

// 只收录本次样例中的代表文件；哈希和输出清单会随工程内容改变。
export const currentWebBuild = new BundleOutputMap([
  { path: "index.html", role: "page", note: "浏览器页面" },
  { path: "main.975ec.js", role: "startup", note: "项目 Web 启动脚本" },
  { path: "cocos2d-js-min.7038f.js", role: "engine", note: "Creator 2.4 Web 引擎" },
  { path: "src/settings.f161e.js", role: "startup", note: "平台、首场景和 Bundle 版本表" },
  { path: "assets/main/config.a9f01.json", role: "bundle-config", note: "主 Bundle 索引" },
  { path: "assets/main/index.a9f01.js", role: "bundle-script", note: "主 Bundle 脚本入口" },
  { path: "assets/main/import/05/05dd1dc0e.29693.json", role: "import", note: "合并后的序列化资源包" },
  { path: "assets/main/native/6a/6aa0aa6a-ebee-4155-a088-a687a6aadec4.a4b27.png", role: "native", note: "贴图原生文件" },
  { path: "assets/BundleMain/config.5af34.json", role: "bundle-config", note: "自定义 Bundle 索引" },
  { path: "assets/BundleMain/import/2b/2b1ac59a-eccf-4c5a-ae44-ee2313507b57.e273f.json", role: "import", note: "label.prefab 序列化数据" },
]);
