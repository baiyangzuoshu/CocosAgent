import { runLesson } from "./cocos/animation/AnimationStudy.ts";
const lines = runLesson();
const output = document.querySelector<HTMLPreElement>("#log");
if (output) output.textContent = lines.join("\n");
for (const line of lines) console.log(line);
