export class VertexBuffer {
  private readonly handle: WebGLBuffer;
  private byteLength = 0;

  constructor(
    private readonly gl: WebGLRenderingContext,
    private readonly bytesPerVertex: number,
  ) {
    const handle = gl.createBuffer();
    if (!handle) throw new Error("无法创建 WebGL 顶点缓冲");
    this.handle = handle;
  }

  get count(): number {
    return this.byteLength / this.bytesPerVertex;
  }

  update(byteOffset: number, data: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.handle);
    if (byteOffset + data.byteLength > this.byteLength) {
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      this.byteLength = byteOffset + data.byteLength;
      console.log("VertexBuffer.update -> gl.bufferData", data.byteLength, "bytes");
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, byteOffset, data);
      console.log("VertexBuffer.update -> gl.bufferSubData", byteOffset, "bytes offset");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
}
