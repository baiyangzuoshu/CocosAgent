export interface RenderComponent {
  updateRenderData(): void;
  fillBuffers(batcher: Batcher2D): void;
}

export interface SpriteRenderData {
  vertices: Float32Array;
  indices: Uint16Array;
  color: Float32Array;
}

const VERTEX_SHADER = `
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_center;
void main() {
  vec2 screen = vec2(a_position.x + u_center.x, u_center.y - a_position.y) / u_resolution;
  gl_Position = vec4(screen.x * 2.0 - 1.0, 1.0 - screen.y * 2.0, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }
`;

export class Batcher2D {
  private readonly _gl: WebGLRenderingContext;
  private readonly _program: WebGLProgram;
  private readonly _vertexBuffer: WebGLBuffer;
  private readonly _indexBuffer: WebGLBuffer;
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
    const gl = this._gl;
    gl.useProgram(this._program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._data.vertices, gl.DYNAMIC_DRAW);
    const position = gl.getAttribLocation(this._program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._data.indices, gl.DYNAMIC_DRAW);
    gl.uniform2f(gl.getUniformLocation(this._program, "u_resolution"), this._canvas.width, this._canvas.height);
    gl.uniform2f(gl.getUniformLocation(this._program, "u_center"), this._canvas.width / 2, this._canvas.height / 2);
    gl.uniform4fv(gl.getUniformLocation(this._program, "u_color"), this._data.color);
    gl.drawElements(gl.TRIANGLES, this._data.indices.length, gl.UNSIGNED_SHORT, 0);
    this._drawCallCount = 1;
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
