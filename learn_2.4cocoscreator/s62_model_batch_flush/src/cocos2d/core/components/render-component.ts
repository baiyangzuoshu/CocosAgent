import type { ModelBatcher } from "../renderer/webgl/model-batcher.ts";

export class Material {
  constructor(readonly name: string, private readonly hash: number) {}

  getHash(): number {
    return this.hash;
  }
}

export interface RenderItem {
  name: string;
  material: Material;
  cullingMask: number;
}

export class RenderComponent {
  constructor(readonly item: RenderItem) {}

  _checkBacth(renderer: ModelBatcher, cullingMask: number): void {
    const material = this.item.material;
    if (
      !renderer.material ||
      material.getHash() !== renderer.material.getHash() ||
      renderer.cullingMask !== cullingMask
    ) {
      if (renderer.material) {
        const reason = material.getHash() !== renderer.material.getHash()
          ? "material hash changed"
          : "culling mask changed";
        console.log("RenderComponent flush boundary:", reason);
      }
      renderer._flush();
      renderer.material = material;
      renderer.cullingMask = cullingMask;
    }
  }
}
