import { type ShaderInfo, WebGL2Shader } from "./webgl2-shader.ts";

export class WebGL2Device {
  constructor(private readonly gl: WebGL2RenderingContext) {}

  createShader(info: ShaderInfo): WebGL2Shader {
    const shader = new WebGL2Shader(this.gl);
    shader.initialize(info);
    console.log("WebGL2Device created Shader wrapper:", info.name);
    return shader;
  }
}
