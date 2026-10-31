import cc from "./index.ts";

const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

if (!cc.macro) {
  throw new Error("cc.macro 没有完成注册");
}

status.textContent = "cc 模块已装配，RAD = " + cc.macro.RAD.toFixed(6);
