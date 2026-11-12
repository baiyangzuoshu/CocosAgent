import { runLesson } from "./cocos/particle/ParticleStudy.ts";
const lines=runLesson();
const out=document.querySelector<HTMLPreElement>("#log");
if(out) out.textContent=lines.join("\n");
for(const line of lines) console.log(line);
