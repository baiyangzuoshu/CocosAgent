import { CCEffectAsset } from "./cocos2d/core/assets/material/CCEffectAsset.ts";
import { Material } from "./cocos2d/core/assets/material/CCMaterial.ts";
import { BaseRenderer } from "./cocos2d/renderer/core/base-renderer.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const canvas = document.querySelector<HTMLCanvasElement>("#surface");
const gl = canvas?.getContext("webgl");
if (!gl) throw new Error("当前浏览器没有 WebGL 1");

const asset = new CCEffectAsset("SpriteEffect", [
  {
    name: "default",
    passes: [{
      name: "forward",
      program: "sprite",
      blendState: {
        blend: true,
        blendSrc: gl.SRC_ALPHA,
        blendDst: gl.ONE_MINUS_SRC_ALPHA,
      },
    }],
  },
]);
const material = new Material(asset);
material.techniqueIndex = 0;
const pass = material.effect.passes[0];

new BaseRenderer(gl).applyPass(pass);
console.log("Material -> EffectAsset:", asset.name);
console.log("Technique -> Pass:", material.effect.technique.name, "->", pass.name);
console.log("Program selected =", pass.programName, "(compilation is the next topic)");
