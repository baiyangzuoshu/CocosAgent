import { WebGLDevice } from "./cocos2d/renderer/gfx/device.ts";
import { ProgramLib } from "./cocos2d/renderer/core/program-lib.ts";


const log = document.querySelector<HTMLPreElement>("#log");
const canvas = document.querySelector<HTMLCanvasElement>("#surface");
if (!log || !canvas) throw new Error("课程页面缺少 #log 或 #surface");
console.log = (...values: unknown[]) => { log.textContent += values.join(" ") + "\n"; };
const gl = canvas.getContext("webgl");
if (!gl) throw new Error("当前浏览器不支持 webgl");
const device = new WebGLDevice(gl);
device.clear();

const leftQuad = new Float32Array([-0.9,-0.6, -0.05,-0.6, -0.05,0.6, -0.9,-0.6, -0.05,0.6, -0.9,0.6]);
const rightQuad = new Float32Array([0.05,-0.6, 0.9,-0.6, 0.9,0.6, 0.05,-0.6, 0.9,0.6, 0.05,0.6]);


const library = new ProgramLib(device);
const tinted = library.getProgram("sprite", { USE_TINT: 1 }, "attribute vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }", "precision mediump float;\nuniform vec4 u_tint;\n#if USE_TINT\nvoid main() { gl_FragColor = u_tint; }\n#else\nvoid main() { gl_FragColor = vec4(0.95, 0.35, 0.1, 1.0); }\n#endif");
device.draw(tinted, [{ name: "a_position", size: 2, values: leftQuad }], { u_tint: new Float32Array([0.2, 0.75, 1.0, 1.0]) });
const plain = library.getProgram("sprite", { USE_TINT: 0 }, "attribute vec2 a_position;\nvoid main() { gl_Position = vec4(a_position, 0.0, 1.0); }", "precision mediump float;\nuniform vec4 u_tint;\n#if USE_TINT\nvoid main() { gl_FragColor = u_tint; }\n#else\nvoid main() { gl_FragColor = vec4(0.95, 0.35, 0.1, 1.0); }\n#endif");
device.draw(plain, [{ name: "a_position", size: 2, values: rightQuad }]);
console.log("WebGL version: 1. Shader language version: " + gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
