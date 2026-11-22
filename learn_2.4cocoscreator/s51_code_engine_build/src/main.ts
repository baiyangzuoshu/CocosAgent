import { createEngineBundlePlan } from "./build/engine-bundle-plan.ts";

const output = document.querySelector<HTMLPreElement>("#log");
if (!output) throw new Error("找不到 #log");
const log = (message: string): void => { output.textContent += `${message}\n`; };

for (const mode of ["debug", "release"] as const) {
  const plan = createEngineBundlePlan(mode, {
    entry: "cocos2d/core/CCGame.js",
    output: `bin/cocos2d-js${mode === "release" ? ".min" : ""}.js`,
    exclude: ["Audio", "WebGL Renderer"],
    sourceMap: mode === "debug",
  });
  log(`=== ${mode.toUpperCase()} WEB ENGINE BUNDLE ===`);
  log(`entry: ${plan.entry}`);
  log(`output: ${plan.output}${plan.sourceMap ? " (+ .map)" : ""}`);
  log(`excluded modules (reverse dependencies): ${plan.excludedModules.join(" -> ")}`);
  log(`excluded source entries: ${plan.excludedFiles.join(", ")}`);
  log(`macros: ${Object.entries(plan.macros).filter(([, enabled]) => enabled).map(([name]) => name).join(", ")}`);
  for (const [i, stage] of plan.stages.entries()) {
    log(`${i + 1}. ${stage.name}`);
    log(`   in: ${stage.inputs.join(", ")}`);
    log(`   out: ${stage.outputs.join(", ")}`);
    log(`   ${stage.detail}`);
  }
}
log("boundary: models engine.js::buildCocosJs; does not invoke Browserify/Gulp or Creator Editor Builder");
