import { Mesh } from "./CCMesh.ts";
import { MeshRendererAssembler } from "./mesh-renderer.ts";
import type { Material, Renderer } from "../renderer/renderer.ts";

export class MeshRenderer {
  readonly _assembler = new MeshRendererAssembler();

  constructor(
    readonly nodeName: string,
    readonly mesh: Mesh | null,
    readonly materials: Material[],
    readonly cullingMask: number,
    readonly enableAutoBatch: boolean,
  ) {}

  _checkBacth(): void {
    // Creator 2.4 MeshRenderer leaves this hook empty; the assembler checks each submesh.
  }

  render(renderer: Renderer): void {
    this._checkBacth();
    this._assembler.fillBuffers(this, renderer);
  }
}
