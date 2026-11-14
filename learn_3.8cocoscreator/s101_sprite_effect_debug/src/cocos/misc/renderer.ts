import { Material } from "../asset/assets/material.ts";
import { Sprite } from "../2d/components/sprite.ts";
import { WebGLDevice } from "../gfx/webgl2/webgl2-device.ts";
export class Renderer {
  constructor(private readonly device: WebGLDevice) {}
  draw(sprite: Sprite, material: Material): void {
    const program = this.device.createProgram(material.effect.vertex, material.effect.fragment);
    this.device.draw(program, [
      { name: "a_position", size: 2, values: sprite.vertex.position },
      { name: "a_uv", size: 2, values: sprite.vertex.uv },
      { name: "a_color", size: 4, values: sprite.vertex.color },
    ], { u_mvp: sprite.vertex.mvp, ...material.uniforms }, sprite.texture);
  }
}
