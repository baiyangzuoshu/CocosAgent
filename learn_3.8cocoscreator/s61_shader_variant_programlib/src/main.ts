import { ProgramLib } from "./cocos/render-scene/core/program-lib.ts";
import { WebGL2Device } from "./cocos/gfx/webgl2/webgl2-device.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const canvas = document.querySelector<HTMLCanvasElement>("#surface");
const gl = canvas?.getContext("webgl2");
if (!gl) throw new Error("当前浏览器没有 WebGL 2");

const device = new WebGL2Device(gl);
const programLib = new ProgramLib();
programLib.define({
  name: "sprite-color",
  hash: "sprite-color-v1",
  defines: ["USE_TINT"],
  attributes: [{ name: "a_position", location: 0 }],
  uniforms: ["u_tint"],
  glsl3: {
    vert: "in vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }",
    frag: "precision mediump float;\nuniform vec4 u_tint;\nout vec4 fragColor;\n#if USE_TINT\nvoid main() { fragColor = u_tint; }\n#else\nvoid main() { fragColor = vec4(1.0, 0.2, 0.1, 1.0); }\n#endif",
  },
});

const tinted = programLib.getGFXShader(device, "sprite-color", { USE_TINT: true });
const tintedGpu = tinted.gpuShader;
gl.useProgram(tintedGpu.program);
const tintLocation = tintedGpu.uniforms.get("u_tint");
if (tintLocation) gl.uniform4fv(tintLocation, new Float32Array([0.2, 0.7, 1.0, 1.0]));
console.log("u_tint location =", tintLocation === null ? "optimized out" : "reflected");

const plain = programLib.getGFXShader(device, "sprite-color", { USE_TINT: false });
plain.gpuShader;
const tintedAgain = programLib.getGFXShader(device, "sprite-color", { USE_TINT: true });
console.log("same macro variant reused =", tinted === tintedAgain);
