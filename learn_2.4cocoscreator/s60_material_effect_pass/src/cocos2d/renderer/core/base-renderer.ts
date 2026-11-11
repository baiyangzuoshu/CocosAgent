import { Pass } from "./pass.ts";

export class BaseRenderer {
  constructor(private readonly gl: WebGLRenderingContext) {}

  applyPass(pass: Pass): void {
    const gl = this.gl;
    if (pass.blend.enabled) {
      gl.enable(gl.BLEND);
      gl.blendFunc(pass.blend.src, pass.blend.dst);
    } else {
      gl.disable(gl.BLEND);
    }
    console.log("BaseRenderer applied blend =", pass.blend.enabled);
  }
}
