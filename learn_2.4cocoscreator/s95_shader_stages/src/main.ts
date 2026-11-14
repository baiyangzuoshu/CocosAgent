import { WebGLDevice } from "./cocos2d/renderer/gfx/device.ts";
import { EffectParser } from "./cocos2d/core/assets/material/effect-parser.ts";


const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl");
if (!gl) throw new Error("当前浏览器不支持 webgl");
const device = new WebGLDevice(gl);
device.clear();

const triangle = new Float32Array([-0.8, -0.7, 0.8, -0.7, 0.0, 0.8]);
const effectProgram = new EffectParser().parse({
  name: "stage-demo",
  vertex: "attribute vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }",
  fragment: "precision mediump float;\nvoid main() { gl_FragColor = vec4(0.15, 0.75, 0.95, 1.0); }",
});

const program = device.createProgram(effectProgram.vertex, effectProgram.fragment);
device.draw(program, [{ name: "a_position", size: 2, values: triangle }], {});
