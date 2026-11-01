import { Director, director, game } from "./exports/base.ts";

const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

director.on(Director.EVENT_AFTER_UPDATE, () => {
  status.textContent = [
    `Director 已初始化: ${director.initialized}`,
    `帧数: ${director.totalFrames}`,
    `deltaTime: ${director.deltaTime.toFixed(4)}s`,
  ].join(" · ");
});

await game.init({});
game.run();

status.textContent = "初始化完成，等待浏览器帧回调……";
