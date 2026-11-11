import type { WebGLDevice } from "./device.ts";

export class Program {
  private _handle: WebGLProgram | null = null;
  readonly attributes = new Map<string, number>();
  readonly uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private readonly device: WebGLDevice,
    readonly key: string,
    private readonly vertexSource: string,
    private readonly fragmentSource: string,
    private readonly uniformNames: string[],
  ) {}

  get handle(): WebGLProgram {
    if (!this._handle) throw new Error("Program has not been linked");
    return this._handle;
  }

  link(): void {
    const gl = this.device.gl;
    const vertex = this.compile(gl.VERTEX_SHADER, this.vertexSource);
    const fragment = this.compile(gl.FRAGMENT_SHADER, this.fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }

    this._handle = program;
    const attributeCount = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES) as number;
    for (let index = 0; index < attributeCount; index += 1) {
      const info = gl.getActiveAttrib(program, index);
      if (info) this.attributes.set(info.name, gl.getAttribLocation(program, info.name));
    }
    for (const name of this.uniformNames) {
      this.uniforms.set(name, gl.getUniformLocation(program, name));
    }
    console.log("GFX Program linked:", this.key);
    console.log("attribute a_position =", this.attributes.get("a_position"));
  }

  private compile(type: number, source: string): WebGLShader {
    const gl = this.device.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error("createShader failed");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
    }
    return shader;
  }
}
