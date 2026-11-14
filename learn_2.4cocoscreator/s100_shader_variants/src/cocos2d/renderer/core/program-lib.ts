import { WebGLDevice } from "../gfx/device.ts";

export class ProgramLib {
  private readonly cache = new Map<string, WebGLProgram>();
  constructor(private readonly device: WebGLDevice) {}
  getProgram(name: string, defines: Record<string, number>, vertex: string, fragment: string): WebGLProgram {
    const key = name + ":" + Object.entries(defines).sort().map(([k, v]) => `${k}=${v}`).join(",");
    const old = this.cache.get(key);
    if (old) { console.log("Program cache hit:", key); return old; }
    const prefix = Object.entries(defines).map(([k, v]) => `#define ${k} ${v}\n`).join("");
    const withMacros = (source: string) => source.startsWith("#version")
      ? source.replace(/^(#version[^\n]*\n)/, `$1${prefix}`) : prefix + source;
    const program = this.device.createProgram(withMacros(vertex), withMacros(fragment));
    this.cache.set(key, program);
    console.log("Program variant compiled:", key);
    return program;
  }
}
