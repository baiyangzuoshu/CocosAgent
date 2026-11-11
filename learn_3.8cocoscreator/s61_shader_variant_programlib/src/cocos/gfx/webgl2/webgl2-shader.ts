import { WebGL2CmdFuncCreateShader } from "./webgl2-commands.ts";

export interface ShaderInfo {
  name: string;
  stages: Array<{ stage: "vertex" | "fragment"; source: string }>;
  attributes: Array<{ name: string; location: number }>;
  uniforms: string[];
}

export interface GpuShader {
  name: string;
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export class WebGL2Shader {
  private info!: ShaderInfo;
  private _gpuShader: GpuShader | null = null;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  initialize(info: ShaderInfo): void {
    this.info = info;
  }

  get gpuShader(): GpuShader {
    if (!this._gpuShader) {
      this._gpuShader = WebGL2CmdFuncCreateShader(this.gl, this.info);
    }
    return this._gpuShader;
  }
}
