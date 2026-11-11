import type { GFXBuffer } from "../base/buffer.ts";

export class WebGLGfxBuffer implements GFXBuffer {
  private readonly handle: WebGLBuffer;
  private _size = 0;

  constructor(
    private readonly gl: WebGLRenderingContext,
    private readonly target: number,
  ) {
    const handle = gl.createBuffer();
    if (!handle) throw new Error("无法创建 WebGL Buffer");
    this.handle = handle;
  }

  get size(): number {
    return this._size;
  }

  resize(size: number): void {
    const gl = this.gl;
    gl.bindBuffer(this.target, this.handle);
    gl.bufferData(this.target, size, gl.DYNAMIC_DRAW);
    gl.bindBuffer(this.target, null);
    this._size = size;
    console.log("GFX Buffer.resize -> gl.bufferData", size, "bytes");
  }

  update(data: Float32Array | Uint16Array): void {
    const gl = this.gl;
    gl.bindBuffer(this.target, this.handle);
    gl.bufferSubData(this.target, 0, data);
    gl.bindBuffer(this.target, null);
    console.log("GFX Buffer.update -> gl.bufferSubData", data.byteLength, "bytes");
  }
}
