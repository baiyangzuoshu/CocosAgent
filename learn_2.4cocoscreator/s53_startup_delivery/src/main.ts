import { CCDirector } from "./cocos2d/core/CCDirector.ts";
import { CCGame } from "./cocos2d/core/CCGame.ts";
import { createWebReleasePlan } from "./cocos2d/core/platform/WebRelease.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const write = (message: string): void => {
  if (output) output.textContent += message + "\n";
  console.log(message);
};

const release = createWebReleasePlan("r53", "main");
write("Static entry: " + release.entryUrl);
write("Entry policy: " + release.entryPolicy);
write("Versioned assets: " + release.assetBase + " (" + release.assetPolicy + ")");

const director = new CCDirector(write);
director.addPersistRootNode("persistent-audio-root", "AudioManager");
const game = new CCGame(write, (sceneName) => director.loadScene(sceneName, (scene) => write(`onLaunched: ${scene.name} is ${scene.lifecycle}`)));
game.on("engine-inited", () => write("application listener: EVENT_ENGINE_INITED"), true);
game.on("game-inited", () => write("application listener: EVENT_GAME_INITED"), true);
game.run({ frameRate: 60, showFPS: true }, () => game.loadLaunchScene(release.startScene));
