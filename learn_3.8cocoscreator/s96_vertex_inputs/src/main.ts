import { WebGLDevice } from "./cocos/gfx/webgl2/webgl2-device.ts";
import { vertexData } from "./cocos/render-scene/core/vertex-layout.ts";



const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("当前浏览器不支持 WebGL 2");
const device = new WebGLDevice(gl);
device.clear();



const program = device.createProgram("#version 300 es\nin vec2 a_position;\nin vec2 a_uv;\nin vec4 a_color;\nuniform mat4 u_mvp;\nout vec2 v_uv;\nout vec4 v_color;\nvoid main() { gl_Position = u_mvp * vec4(a_position, 0.0, 1.0); v_uv = a_uv; v_color = a_color; }", "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nin vec2 v_uv;\nin vec4 v_color;\nvoid main() { fragColor = v_color; }");
device.draw(program, [{ name: "a_position", size: 2, values: vertexData.position }, { name: "a_uv", size: 2, values: vertexData.uv }, { name: "a_color", size: 4, values: vertexData.color }], { u_mvp: vertexData.mvp });
console.log("Input: position + uv + vertex color; output: clip-space position + interpolated varyings");
