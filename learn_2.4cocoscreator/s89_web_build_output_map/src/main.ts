import { currentWebBuild } from "./example-build.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

output.textContent = [
  "Creator 2.4.15 · web-mobile",
  "",
  ...currentWebBuild.lines(),
  "",
  "Bundle: main / internal / BundleMain",
  "证据来源：2.4NewProject/build/web-mobile/",
  "本课观察构建结果，不复刻 Editor Builder。",
].join("\n");
