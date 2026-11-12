import { runLesson } from "./extensions/spine/SpineStudy.ts";
const lines = runLesson();
const out = document.querySelector<HTMLPreElement>("#log");
if (out) out.textContent = lines.join(String.fromCharCode(10));
for (const line of lines) console.log(line);
