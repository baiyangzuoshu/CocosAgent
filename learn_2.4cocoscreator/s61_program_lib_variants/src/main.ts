import { BaseRenderer } from "./cocos2d/renderer/core/base-renderer.ts";
import { Pass } from "./cocos2d/renderer/core/pass.ts";
import { ProgramLib } from "./cocos2d/renderer/core/program-lib.ts";
import { WebGLDevice } from "./cocos2d/renderer/gfx/device.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const canvas = document.querySelector<HTMLCanvasElement>("#surface");
const gl = canvas?.getContext("webgl");
if (!gl) throw new Error("当前浏览器没有 WebGL 1");

const device = new WebGLDevice(gl);
const programLib = new ProgramLib(device);
programLib.define({
  name: "sprite-color",
  attributes: { a_position: 0 },
  vertex: `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`,
  fragment: `precision mediump float;
#if USE_TINT
uniform vec4 u_tint;
void main() { gl_FragColor = u_tint; }
#else
void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }
#endif`,
});

const renderer = new BaseRenderer(device, programLib);
renderer.applyPass(new Pass("tinted", "sprite-color", { USE_TINT: true }, {
  u_tint: new Float32Array([0.2, 0.7, 1.0, 1.0]),
}));
renderer.applyPass(new Pass("plain", "sprite-color", { USE_TINT: false }, {}));
renderer.applyPass(new Pass("tinted-again", "sprite-color", { USE_TINT: true }, {
  u_tint: new Float32Array([1.0, 0.5, 0.2, 1.0]),
}));
