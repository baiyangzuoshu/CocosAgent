import { WebGLDevice } from "./cocos2d/renderer/gfx/device.ts";
import { EffectAsset } from "./cocos2d/core/assets/material/CCEffectAsset.ts";
import { Material } from "./cocos2d/core/assets/material/CCMaterial.ts";
import { Sprite } from "./cocos2d/core/components/CCSprite.ts";
import { Renderer } from "./cocos2d/renderer/core/base-renderer.ts";


const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl");
if (!gl) throw new Error("当前浏览器不支持 webgl");
const device = new WebGLDevice(gl);
device.clear();

function makeCheckerTexture() { return { name: "u_texture", width: 2, height: 2, rgba: new Uint8Array([255,80,80,255, 80,255,80,255, 80,80,255,255, 255,255,255,255]) }; }

const sprite = new Sprite({
  position: new Float32Array([-0.75,-0.65, 0.75,-0.65, 0.75,0.65, -0.75,-0.65, 0.75,0.65, -0.75,0.65]),
  uv: new Float32Array([0,0, 1,0, 1,1, 0,0, 1,1, 0,1]),
  color: new Float32Array([1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1]),
  mvp: new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
}, makeCheckerTexture());
const effect = new EffectAsset("attribute vec2 a_position;\nattribute vec2 a_uv;\nattribute vec4 a_color;\nuniform mat4 u_mvp;\nvarying vec2 v_uv;\nvarying vec4 v_color;\nvoid main() { gl_Position = u_mvp * vec4(a_position, 0.0, 1.0); v_uv = a_uv; v_color = a_color; }", "precision mediump float;\nvarying vec2 v_uv;\nvarying vec4 v_color;\nuniform sampler2D u_texture;\nuniform vec4 u_tint;\nvoid main() { gl_FragColor = texture2D(u_texture, v_uv) * v_color * u_tint; }");
const material = new Material(effect, { u_tint: new Float32Array([0.45, 0.9, 1.0, 1.0]) });
const renderer = new Renderer(device);
renderer.draw(sprite, material);
console.log("Debug checkpoints: Sprite data → Effect Pass → linked program → attributes/texture/Uniform → drawArrays.");
