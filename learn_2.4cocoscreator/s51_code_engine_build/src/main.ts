import { createEngineBundlePlan } from "./build/engine-bundle-plan.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += message + "\n"; };

const plan = createEngineBundlePlan("debug");
log("Creator 2.4 Web engine-bundle model");
log("entry=" + plan.entry + " (illustrative; real entry is supplied by the caller)");
log("output=" + plan.output);
log("CC_BUILD=" + plan.macros.CC_BUILD + " CC_DEBUG=" + plan.macros.CC_DEBUG + " CC_JSB=" + plan.macros.CC_JSB);
for (const [index, stage] of plan.stages.entries()) log(`${index + 1}. ${stage}`);
log("scope=engine JavaScript bundle only; not the complete Creator Editor Builder");
