const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

status.textContent = "3.8.7 课程入口已运行。";
