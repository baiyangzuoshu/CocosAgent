import type { Program } from "./program.ts";

export class WebGLDevice {
  private currentProgram: Program | null = null;

  constructor(readonly gl: WebGLRenderingContext) {}

  setProgram(program: Program): void {
    if (this.currentProgram === program) return;
    this.currentProgram = program;
    this.gl.useProgram(program.handle);
    console.log("Device setProgram:", program.key);
  }

  setUniform4fv(program: Program, name: string, value: Float32Array): void {
    const location = program.uniforms.get(name);
    if (!location) return;
    this.gl.uniform4fv(location, value);
    console.log("Device set uniform:", name, Array.from(value).join(","));
  }
}
