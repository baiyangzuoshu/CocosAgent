import type { GpuShader, ShaderInfo } from "./webgl2-shader.ts";

function compileStage(
  gl: WebGL2RenderingContext,
  stage: ShaderInfo["stages"][number],
): WebGLShader {
  const type = stage.stage === "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, "#version 300 es\n" + stage.source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

export function WebGL2CmdFuncCreateShader(
  gl: WebGL2RenderingContext,
  info: ShaderInfo,
): GpuShader {
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");

  for (const stage of info.stages) {
    gl.attachShader(program, compileStage(gl, stage));
  }
  for (const attribute of info.attributes) {
    gl.bindAttribLocation(program, attribute.location, attribute.name);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }

  const uniforms = new Map<string, WebGLUniformLocation | null>();
  for (const name of info.uniforms) {
    uniforms.set(name, gl.getUniformLocation(program, name));
  }
  console.log("WebGL2CmdFuncCreateShader linked and reflected:", info.name);
  return { name: info.name, program, uniforms };
}
