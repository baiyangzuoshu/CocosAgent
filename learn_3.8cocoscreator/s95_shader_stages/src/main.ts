import { WebGLDevice } from "./cocos/gfx/webgl2/webgl2-device.ts";
import { EffectAsset } from "./cocos/asset/assets/effect-asset.ts";



const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("当前浏览器不支持 WebGL 2");
const device = new WebGLDevice(gl);
device.clear();

const triangle = new Float32Array([-0.8, -0.7, 0.8, -0.7, 0.0, 0.8]);
const effectProgram = new EffectAsset().selectProgram({
  name: "stage-demo",
  vertex: "#version 300 es\nin vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }",
  fragment: "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nvoid main() { fragColor = vec4(0.15, 0.75, 0.95, 1.0); }",
});

const program = device.createProgram(effectProgram.vertex, effectProgram.fragment);
device.draw(program, [{ name: "a_position", size: 2, values: triangle }], {});
