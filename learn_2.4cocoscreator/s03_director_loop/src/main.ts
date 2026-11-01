import cc from "./index.ts";

const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const game = cc.game;
const director = cc.director;
const Director = cc.Director;

if (!game || !director || !Director) {
  throw new Error("cc.game 或 cc.director 没有完成注册");
}

director.on(Director.EVENT_AFTER_UPDATE, (deltaTime: number) => {
  status.textContent =
    "Director 已初始化 · 帧数 " + director.totalFrames + " · deltaTime " + deltaTime.toFixed(4) + "s";
});

status.textContent = "正在初始化游戏……";

game.run({ frameRate: 60 }, () => {
  status.textContent = "游戏已启动，等待首帧……";
});
