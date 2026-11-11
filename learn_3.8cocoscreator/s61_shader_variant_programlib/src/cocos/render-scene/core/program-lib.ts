import type { WebGL2Device } from "../../gfx/webgl2/webgl2-device.ts";
import type { ShaderInfo, WebGL2Shader } from "../../gfx/webgl2/webgl2-shader.ts";

export interface ShaderTemplate {
  name: string;
  hash: string;
  glsl3: { vert: string; frag: string };
  defines: string[];
  attributes: Array<{ name: string; location: number }>;
  uniforms: string[];
}

export class ProgramLib {
  private readonly templates = new Map<string, ShaderTemplate>();
  private readonly cache = new Map<string, WebGL2Shader>();

  define(template: ShaderTemplate): void {
    this.templates.set(template.name, template);
  }

  getGFXShader(
    device: WebGL2Device,
    name: string,
    defines: Record<string, boolean | number>,
  ): WebGL2Shader {
    const template = this.templates.get(name);
    if (!template) throw new Error("Unknown shader template: " + name);

    const macroLines = template.defines
      .filter((macro) => defines[macro] !== undefined)
      .map((macro) => "#define " + macro + " " + Number(defines[macro]));
    const key = template.hash + "|" + macroLines.join(";");
    const cached = this.cache.get(key);
    if (cached) {
      console.log("ProgramLib cache hit:", key);
      return cached;
    }

    const macroPrefix = macroLines.join("\n") + "\n";
    const shaderInfo: ShaderInfo = {
      name: name + (macroLines.length ? "-" + macroLines.join("-").replace(/ /g, "") : ""),
      stages: [
        { stage: "vertex", source: macroPrefix + template.glsl3.vert },
        { stage: "fragment", source: macroPrefix + template.glsl3.frag },
      ],
      attributes: template.attributes,
      uniforms: template.uniforms,
    };
    const shader = device.createShader(shaderInfo);
    this.cache.set(key, shader);
    console.log("ProgramLib cached ShaderInfo:", key);
    return shader;
  }
}
