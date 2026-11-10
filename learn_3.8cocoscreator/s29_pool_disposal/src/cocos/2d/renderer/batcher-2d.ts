import type { Texture2D } from "../../asset/assets/texture-2d.ts";

export interface RenderComponent {
  updateRenderData(): void;
  fillBuffers(batcher: Batcher2D): void;
}

export interface SpriteRenderData {
  vertices: Float32Array;
  indices: Uint16Array;
  texture: Texture2D | null;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_uv;
uniform vec2 u_resolution;
uniform vec2 u_center;
varying vec2 v_uv;
void main() {
  vec2 screen = vec2(a_position.x + u_center.x, u_center.y - a_position.y) / u_resolution;
  gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
  v_uv = a_uv;
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_texture;
varying vec2 v_uv;
void main() { gl_FragColor = texture2D(u_texture, v_uv); }
`;

export class Batcher2D {
  private readonly _gl: WebGLRenderingContext;
  private readonly _program: WebGLProgram;
  private readonly _vertexBuffer: WebGLBuffer;
  private readonly _indexBuffer: WebGLBuffer;
  private readonly _textures = new WeakMap<Texture2D, WebGLTexture>();
  private _data: SpriteRenderData | null = null;
  private _drawCallCount = 0;

  constructor(private readonly _canvas: HTMLCanvasElement) {
    const gl = _canvas.getContext("webgl");
    if (!gl) throw new Error("当前浏览器无法创建 WebGL context");
    this._gl = gl;
    this._program = this._createProgram();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !indexBuffer) throw new Error("WebGL 缓冲区创建失败");
    this._vertexBuffer = vertexBuffer;
    this._indexBuffer = indexBuffer;
  }

  get drawCallCount(): number { return this._drawCallCount; }

  beginFrame(): void {
    this._data = null;
    this._drawCallCount = 0;
    this._gl.viewport(0, 0, this._canvas.width, this._canvas.height);
    this._gl.clearColor(0.08, 0.1, 0.16, 1);
    this._gl.clear(this._gl.COLOR_BUFFER_BIT);
  }

  commit(data: SpriteRenderData): void {
    this._data = data;
  }

  endFrame(): void {
    if (!this._data) return;
    if (!this._data.texture) return;
    const gl = this._gl;
    gl.useProgram(this._program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data.vertices, gl.DYNAMIC_DRAW);
    const position = gl.getAttribLocation(this._program, "a_position");
    const uv = gl.getAttribLocation(this._program, "a_uv");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._data.indices, gl.DYNAMIC_DRAW);
    gl.uniform2f(gl.getUniformLocation(this._program, "u_resolution"), this._canvas.width, this._canvas.height);
    gl.uniform2f(gl.getUniformLocation(this._program, "u_center"), this._canvas.width / 2, this._canvas.height / 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._getTexture(this._data.texture));
    gl.uniform1i(gl.getUniformLocation(this._program, "u_texture"), 0);
    gl.drawElements(gl.TRIANGLES, this._data.indices.length, gl.UNSIGNED_SHORT, 0);
    this._drawCallCount = 1;
  }

  private _getTexture(texture: Texture2D): WebGLTexture {
    const cached = this._textures.get(texture);
    if (cached) return cached;
    const glTexture = this._gl.createTexture();
    if (!glTexture) throw new Error("WebGL 贴图创建失败");
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this._textures.set(texture, glTexture);
    return glTexture;
  }

  private _createProgram(): WebGLProgram {
    const gl = this._gl;
    const vertex = this._compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = this._compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("WebGL program 创建失败");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "WebGL program 链接失败");
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return program;
  }

  private _compileShader(type: number, source: string): WebGLShader {
    const gl = this._gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("WebGL shader 创建失败");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "WebGL shader 编译失败");
    return shader;
  }
}
