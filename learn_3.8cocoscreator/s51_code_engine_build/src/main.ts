import { createRuntimeConstants } from "./build/runtime-constants.ts";
import { canResume } from "./cocos/game/game.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const constants = createRuntimeConstants("build");
log("Creator 3.8 compile-time constant model");
log("BUILD=" + constants.BUILD + " EDITOR=" + constants.EDITOR + " PREVIEW=" + constants.PREVIEW);
log("game.run can resume after init=" + canResume(true, constants));
log("scope=static source model; no Editor Builder or Creator 3.8 runtime validation");
