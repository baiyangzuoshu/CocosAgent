import type { WebGLDevice } from "../gfx/device.ts";
import { Program } from "../gfx/program.ts";

export interface ShaderTemplate {
  name: string;
  vertex: string;
  fragment: string;
  attributes: Record<string, number>;
}

export class ProgramLib {
  private readonly templates = new Map<string, ShaderTemplate>();
  private readonly cache = new Map<string, Program>();

  constructor(private readonly device: WebGLDevice) {}

  define(template: ShaderTemplate): void {
    this.templates.set(template.name, template);
  }

  getProgram(
    name: string,
    defines: Record<string, boolean | number>,
    uniformNames: string[],
  ): Program {
    const template = this.templates.get(name);
    if (!template) throw new Error("Unknown shader template: " + name);

    const macroLines = Object.entries(defines)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([macro, value]) => "#define " + macro + " " + Number(value));
    const key = name + "|" + macroLines.join(";");
    const cached = this.cache.get(key);
    if (cached) {
      console.log("ProgramLib cache hit:", key);
      return cached;
    }

    const prefix = macroLines.join("\n") + "\n";
    const program = new Program(
      this.device,
      key,
      prefix + template.vertex,
      prefix + template.fragment,
      uniformNames,
    );
    program.link();
    this.cache.set(key, program);
    return program;
  }
}
