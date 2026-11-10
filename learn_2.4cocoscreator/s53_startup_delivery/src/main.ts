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
const game = new CCGame(write);
game.run({ frameRate: 60 }, () => director.loadScene(release.startScene));
