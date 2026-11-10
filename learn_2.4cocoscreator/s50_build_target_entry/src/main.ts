import { selectBuildProfile } from "./build/build-profile.ts";
import { createBuildMacros } from "./cocos2d/core/predefine.ts";
import { normalizeGameConfig } from "./cocos2d/core/CCGame.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const profile = selectBuildProfile("debug");
const macros = createBuildMacros(profile.mode);
const runtime = normalizeGameConfig({ frameRate: 60, renderMode: 0, showFPS: true });

log("target=" + profile.target + " mode=" + profile.mode);
log("CC_BUILD=" + macros.CC_BUILD + " CC_DEBUG=" + macros.CC_DEBUG + " CC_JSB=" + macros.CC_JSB);
log("runtime frameRate=" + runtime.frameRate + " renderMode=" + runtime.renderMode + " showFPS=" + runtime.showFPS);
log("builder=Creator Editor; engine source exposes runtime/macros, not the complete Builder");
