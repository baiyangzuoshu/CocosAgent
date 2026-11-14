import { WebGLDevice } from "./cocos/gfx/webgl2/webgl2-device.ts";
import { checkerTexture, quad } from "./cocos/render-scene/core/texture-sampler.ts";



const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("当前浏览器不支持 WebGL 2");
const device = new WebGLDevice(gl);
device.clear();



const program = device.createProgram("#version 300 es\nin vec2 a_position;\nin vec2 a_uv;\nout vec2 v_uv;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); v_uv = a_uv; }", "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nin vec2 v_uv;\nuniform sampler2D u_texture;\nvoid main() { fragColor = texture(u_texture, v_uv); }");
device.draw(program, [{ name: "a_position", size: 2, values: quad.position }, { name: "a_uv", size: 2, values: quad.uv }], {}, checkerTexture);
console.log("Texture coordinates are interpolated across the triangle; the fragment stage samples the 2x2 texture.");
