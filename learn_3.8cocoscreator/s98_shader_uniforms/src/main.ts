import { WebGLDevice } from "./cocos/gfx/webgl2/webgl2-device.ts";
import { Pass } from "./cocos/render-scene/core/pass.ts";



const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("当前浏览器不支持 WebGL 2");
const device = new WebGLDevice(gl);
device.clear();

const leftQuad = new Float32Array([-0.9,-0.6, -0.05,-0.6, -0.05,0.6, -0.9,-0.6, -0.05,0.6, -0.9,0.6]);
const rightQuad = new Float32Array([0.05,-0.6, 0.9,-0.6, 0.9,0.6, 0.05,-0.6, 0.9,0.6, 0.05,0.6]);

const program = device.createProgram("#version 300 es\nin vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }", "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nuniform vec4 u_tint;\nvoid main() { fragColor = u_tint; }");
const pass = new Pass({ u_tint: new Float32Array([0.2, 0.75, 1.0, 1.0]) });
device.draw(program, [{ name: "a_position", size: 2, values: leftQuad }], pass.uniforms);
pass.setColor("u_tint", new Float32Array([1.0, 0.45, 0.18, 1.0]));
device.draw(program, [{ name: "a_position", size: 2, values: rightQuad }], pass.uniforms);
console.log("One program, two Pass uniform values, two Sprite colors.");
