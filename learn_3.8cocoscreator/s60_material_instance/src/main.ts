import { EffectAsset } from "./cocos/asset/assets/effect-asset.ts";
import { Material } from "./cocos/asset/assets/material.ts";
import { Renderer } from "./cocos/misc/renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const effectAsset = new EffectAsset("SpriteEffect", [{
  name: "default",
  passes: [{
    name: "forward",
    blendState: { enabled: true, src: "SRC_ALPHA", dst: "ONE_MINUS_SRC_ALPHA" },
  }],
}]);
const material = new Material();
material.initialize({ effectAsset });
const renderer = new Renderer([material]);

console.log("shared EffectAsset -> Material -> Pass:", material.effectAsset.name, material.passes[0].name);
console.log("instance created before access =", renderer.hasMaterialInstance(0));
const instance = renderer.getMaterialInstance(0);
if (!instance) throw new Error("renderer has no material at index 0");
instance.overridePipelineStates({ enabled: false });
console.log("instance blend =", instance.passes[0].state.enabled);
console.log("shared blend remains =", material.passes[0].state.enabled);
