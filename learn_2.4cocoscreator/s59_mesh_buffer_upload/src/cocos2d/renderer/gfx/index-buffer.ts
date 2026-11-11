export class IndexBuffer {
  private readonly handle: WebGLBuffer;
  private byteLength = 0;

  constructor(private readonly gl: WebGLRenderingContext) {
    const handle = gl.createBuffer();
    if (!handle) throw new Error("无法创建 WebGL 索引缓冲");
    this.handle = handle;
  }

  get count(): number {
    return this.byteLength / Uint16Array.BYTES_PER_ELEMENT;
  }

  update(byteOffset: number, data: Uint16Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.handle);
    if (byteOffset + data.byteLength > this.byteLength) {
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
      this.byteLength = byteOffset + data.byteLength;
      console.log("IndexBuffer.update -> gl.bufferData", data.length, "indices");
    } else {
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, byteOffset, data);
      console.log("IndexBuffer.update -> gl.bufferSubData", byteOffset, "bytes offset");
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
}
