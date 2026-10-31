import cc from "./index.ts";

const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const game = cc.game;

if (!game) {
  throw new Error("cc.game 没有完成注册");
}

const startupOrder: string[] = [];
game.on(game.EVENT_ENGINE_INITED, () => startupOrder.push("EVENT_ENGINE_INITED"));
game.on(game.EVENT_GAME_INITED, () => startupOrder.push("EVENT_GAME_INITED"));

status.textContent = "正在初始化游戏……";

game.run({ frameRate: 60 }, () => {
  startupOrder.push("onStart");
  status.textContent = "启动顺序：" + startupOrder.join(" → ");
});
