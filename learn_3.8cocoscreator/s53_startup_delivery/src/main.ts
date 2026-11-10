import { Director } from "./cocos/game/director.ts";
import { Game } from "./cocos/game/game.ts";
import { createWebReleasePlan } from "./cocos/platform/WebRelease.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const write = (message: string): void => {
  if (output) output.textContent += message + "\n";
  console.log(message);
};

async function boot(): Promise<void> {
  const release = createWebReleasePlan("r53", "main");
  write("Static entry: " + release.entryUrl);
  write("Entry policy: " + release.entryPolicy);
  write("Versioned assets: " + release.assetBase + " (" + release.assetPolicy + ")");

  const director = new Director(write);
  const game = new Game(write, director, release.startScene);
  await game.init();
  game.run(() => write("Project onStart callback"));
  game.firstTick();
}

void boot();
