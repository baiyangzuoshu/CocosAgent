import { RenderData } from "./cocos2d/core/renderer/render-data.ts";
import { MeshBuffer } from "./cocos2d/core/renderer/webgl/mesh-buffer.ts";
import { InputAssembler } from "./cocos2d/renderer/core/input-assembler.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const canvas = document.querySelector<HTMLCanvasElement>("#surface");
const gl = canvas?.getContext("webgl");
if (!gl) throw new Error("当前浏览器没有 WebGL 1");

const renderData = new RenderData(
  new Float32Array([0, 0, 80, 0, 0, 40, 80, 40]),
  new Uint16Array([0, 1, 2, 1, 3, 2]),
);
const meshBuffer = new MeshBuffer(gl);
meshBuffer.append(renderData);
meshBuffer.uploadData();

const inputAssembler = new InputAssembler(meshBuffer.vertexBuffer, meshBuffer.indexBuffer);
console.log("InputAssembler: primitive =", inputAssembler.primitiveType);
console.log("InputAssembler: index count =", inputAssembler.count);
console.log("GPU buffers created =", Boolean(inputAssembler.vertexBuffer && inputAssembler.indexBuffer));
