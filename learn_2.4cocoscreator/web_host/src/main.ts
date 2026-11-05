const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

status.textContent = "TypeScript 入口已在浏览器中运行。";
