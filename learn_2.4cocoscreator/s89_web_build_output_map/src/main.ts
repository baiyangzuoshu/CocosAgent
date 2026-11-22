import { currentWebBuild } from "./example-build.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

output.textContent = [
  "Creator 2.4.15 · web-mobile",
  "",
  "按角色分组的文件数:",
  ...[...currentWebBuild.byRole()].filter(([, items]) => items.length).map(([role, items]) => `  ${role}: ${items.length}`),
  "",
  "构建文件树:",
  ...currentWebBuild.tree(),
  "",
  `映射检查: ${currentWebBuild.validate().length ? currentWebBuild.validate().map((issue) => `${issue.path}: ${issue.message}`).join("; ") : "所有已声明引用都能在映射中找到"}`,
  "",
  ...currentWebBuild.lines(),
  "",
  "Bundle: main / internal / BundleMain",
  "证据来源：2.4NewProject/build/web-mobile/",
  "本课观察构建结果，不复刻 Editor Builder。",
].join("\n");
