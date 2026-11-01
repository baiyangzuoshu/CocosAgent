import { Game, game } from "./exports/base.ts";

const status = document.querySelector<HTMLParagraphElement>("#status");

if (!status) {
  throw new Error("找不到页面状态节点 #status");
}

const events = [
  Game.EVENT_PRE_BASE_INIT,
  Game.EVENT_POST_BASE_INIT,
  Game.EVENT_PRE_INFRASTRUCTURE_INIT,
  Game.EVENT_POST_INFRASTRUCTURE_INIT,
  Game.EVENT_PRE_SUBSYSTEM_INIT,
  Game.EVENT_POST_SUBSYSTEM_INIT,
  Game.EVENT_ENGINE_INITED,
  Game.EVENT_PRE_PROJECT_INIT,
  Game.EVENT_POST_PROJECT_INIT,
  Game.EVENT_GAME_INITED,
];
const steps: string[] = [];

for (const event of events) {
  game.on(event, () => steps.push(event));
}

await game.init({});
game.run(() => steps.push("onStart"));
status.textContent = steps.join(" → ");
