export interface VertexAttribute {
  name: string;
  size: number;
  values: Float32Array;
}
export interface TexturePixels {
  name: string;
  width: number;
  height: number;
  rgba: Uint8Array;
}
export type UniformValue = number | Float32Array;

/** Minimal WebGL2 browser GPU boundary; it is not Creator's GFX Device. */
export class WebGLDevice {
  constructor(readonly gl: WebGL2RenderingContext) {}

  createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertex = this.compile(this.gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compile(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();
    if (!program) throw new Error("WebGL could not create a program");
    this.gl.attachShader(program, vertex);
    this.gl.attachShader(program, fragment);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(this.gl.getProgramInfoLog(program) || "Program link failed");
    }
    console.log("Program linked: vertex + fragment");
    return program;
  }

  draw(
    program: WebGLProgram,
    attributes: VertexAttribute[],
    uniforms: Record<string, UniformValue> = {},
    texture?: TexturePixels,
  ): void {
    this.gl.useProgram(program);
    const position = attributes.find((attribute) => attribute.name === "a_position");
    if (!position) throw new Error("a_position is required to determine vertex count");
    for (const attribute of attributes) {
      const location = this.gl.getAttribLocation(program, attribute.name);
      if (location < 0) continue;
      const buffer = this.gl.createBuffer();
      if (!buffer) throw new Error("WebGL could not create a vertex buffer");
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, attribute.values, this.gl.STATIC_DRAW);
      this.gl.enableVertexAttribArray(location);
      this.gl.vertexAttribPointer(location, attribute.size, this.gl.FLOAT, false, 0, 0);
    }
    for (const [name, value] of Object.entries(uniforms)) {
      const location = this.gl.getUniformLocation(program, name);
      if (location === null) continue;
      if (typeof value === "number") this.gl.uniform1f(location, value);
      else if (value.length === 16) this.gl.uniformMatrix4fv(location, false, value);
      else if (value.length === 4) this.gl.uniform4fv(location, value);
      else if (value.length === 2) this.gl.uniform2fv(location, value);
      else this.gl.uniform1fv(location, value);
    }
    if (texture) this.bindTexture(program, texture);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, position.values.length / position.size);
    for (const attribute of attributes) {
      const location = this.gl.getAttribLocation(program, attribute.name);
      if (location >= 0) this.gl.disableVertexAttribArray(location);
    }
  }

  clear(red = 0.06, green = 0.09, blue = 0.13): void {
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(red, green, blue, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private compile(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) throw new Error("WebGL could not create a shader");
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(this.gl.getShaderInfoLog(shader) || "Shader compile failed");
    }
    return shader;
  }

  private bindTexture(program: WebGLProgram, texture: TexturePixels): void {
    const gl = this.gl;
    const gpuTexture = gl.createTexture();
    if (!gpuTexture) throw new Error("WebGL could not create a texture");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gpuTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texture.width, texture.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, texture.rgba);
    const location = gl.getUniformLocation(program, texture.name);
    if (location !== null) gl.uniform1i(location, 0);
  }
}
