import { Pass } from "./pass.ts";
import { ProgramLib } from "./program-lib.ts";
import { WebGLDevice } from "../gfx/device.ts";

export class BaseRenderer {
  constructor(
    private readonly device: WebGLDevice,
    private readonly programLib: ProgramLib,
  ) {}

  applyPass(pass: Pass): void {
    const program = this.programLib.getProgram(pass.programName, pass.defines, Object.keys(pass.properties));
    this.device.setProgram(program);
    for (const [name, value] of Object.entries(pass.properties)) {
      this.device.setUniform4fv(program, name, value);
    }
  }
}
