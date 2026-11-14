import { WebGLDevice } from "./cocos/gfx/webgl2/webgl2-device.ts";
import { applyBlendState, overlap, premultipliedBlendState } from "./cocos/render-scene/core/blend-state.ts";



const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("当前浏览器不支持 WebGL 2");
const device = new WebGLDevice(gl);
device.clear();

console.log("Pass blend state:", JSON.stringify(premultipliedBlendState));


applyBlendState(gl, premultipliedBlendState);
const program = device.createProgram("#version 300 es\nin vec2 a_position;\nin vec4 a_color;\nout vec4 v_color;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); v_color = a_color; }", "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nin vec4 v_color;\nvoid main() { fragColor = vec4(v_color.rgb * v_color.a, v_color.a); }");
device.draw(program, [{ name: "a_position", size: 2, values: overlap.position }, { name: "a_color", size: 4, values: overlap.color }]);
console.log("Source color was premultiplied in the fragment Shader; blend factors are ONE / ONE_MINUS_SRC_ALPHA.");
