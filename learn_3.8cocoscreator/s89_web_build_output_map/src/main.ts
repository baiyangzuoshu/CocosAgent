import { currentWebBuild } from "./example-build.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");

output.textContent = [
  "Creator 3.8.8 · web-mobile · runtime source baseline 3.8.7",
  "",
  ...currentWebBuild.lines(),
  "",
  "Bundle: main / internal（本次输出中没有 BundleMain）",
  "证据来源：3.8NewProject/build/web-mobile/",
  "本课观察构建结果，不复刻 Editor Builder。",
].join("\n");
