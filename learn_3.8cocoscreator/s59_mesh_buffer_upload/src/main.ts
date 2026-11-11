import { LinearBufferAccessor } from "./cocos/2d/renderer/linear-buffer-accessor.ts";

const output = document.querySelector<HTMLPreElement>("#log");
const originalLog = console.log;
console.log = (...values: unknown[]): void => {
  if (output) output.textContent += values.join(" ") + "\n";
  originalLog(...values);
};

const canvas = document.querySelector<HTMLCanvasElement>("#surface");
const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
if (!gl) throw new Error("当前浏览器没有 WebGL");

const accessor = new LinearBufferAccessor(gl);
accessor.appendBuffers(
  new Float32Array([0, 0, 80, 0, 0, 40, 80, 40]),
  new Uint16Array([0, 1, 2, 1, 3, 2]),
);
const inputAssembler = accessor.recordBatch();
accessor.uploadBuffers();

console.log("LinearBufferAccessor -> MeshBuffer -> GFX Buffer");
console.log("InputAssembler primitive =", inputAssembler.primitiveMode);
console.log("InputAssembler index count =", inputAssembler.indexCount);
