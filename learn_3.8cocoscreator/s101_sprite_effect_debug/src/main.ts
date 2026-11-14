import { WebGLDevice } from "./cocos/gfx/webgl2/webgl2-device.ts";
import { EffectAsset } from "./cocos/asset/assets/effect-asset.ts";
import { Material } from "./cocos/asset/assets/material.ts";
import { Sprite } from "./cocos/2d/components/sprite.ts";
import { Renderer } from "./cocos/misc/renderer.ts";



const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl2");
if (!gl) throw new Error("当前浏览器不支持 WebGL 2");
const device = new WebGLDevice(gl);
device.clear();

function makeCheckerTexture() { return { name: "u_texture", width: 2, height: 2, rgba: new Uint8Array([255,80,80,255, 80,255,80,255, 80,80,255,255, 255,255,255,255]) }; }

const sprite = new Sprite({
  position: new Float32Array([-0.75,-0.65, 0.75,-0.65, 0.75,0.65, -0.75,-0.65, 0.75,0.65, -0.75,0.65]),
  uv: new Float32Array([0,0, 1,0, 1,1, 0,0, 1,1, 0,1]),
  color: new Float32Array([1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]),
  mvp: new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
}, makeCheckerTexture());
const effect = new EffectAsset("#version 300 es\nin vec2 a_position;\nin vec2 a_uv;\nin vec4 a_color;\nuniform mat4 u_mvp;\nout vec2 v_uv;\nout vec4 v_color;\nvoid main() { gl_Position = u_mvp * vec4(a_position, 0.0, 1.0); v_uv = a_uv; v_color = a_color; }", "#version 300 es\nprecision mediump float;\nout vec4 fragColor;\nin vec2 v_uv;\nin vec4 v_color;\nuniform sampler2D u_texture;\nuniform vec4 u_tint;\nvoid main() { fragColor = texture(u_texture, v_uv) * v_color * u_tint; }");
const material = new Material(effect, { u_tint: new Float32Array([0.45, 0.9, 1.0, 1.0]) });
const renderer = new Renderer(device);
renderer.draw(sprite, material);
console.log("Debug checkpoints: Sprite data → Effect Pass → linked program → attributes/texture/Uniform → drawArrays.");
