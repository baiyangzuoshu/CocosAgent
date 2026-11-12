import { runLesson } from "./cocos2d/core/3d/physics/framework/PhysicsStudy.ts";

const output = runLesson();
const log = document.querySelector<HTMLPreElement>("#log");
if (log) log.textContent = output.join("\n");
for (const line of output) console.log(line);
