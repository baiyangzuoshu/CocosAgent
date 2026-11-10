import { selectBuildProfile } from "./build/build-profile.ts";
import { compatibleWithOldParams } from "./cocos/game/game.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const profile = selectBuildProfile("debug");
const runtimeSettings = compatibleWithOldParams({ showFPS: true, frameRate: 60, renderMode: 0 });

log("target=" + profile.target + " mode=" + profile.mode + " version=" + profile.engineVersion);
log("runtimeSettings=" + JSON.stringify(runtimeSettings));
log("builder=Creator Editor; game.ts describes runtime options, not the complete Builder");
