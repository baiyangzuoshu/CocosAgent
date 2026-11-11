import type { MeshRenderer } from "../mesh/CCMeshRenderer.ts";
import { Renderer } from "./renderer.ts";

export class RenderFlow {
  render(comp: MeshRenderer): void {
    console.log(`RenderFlow renders ${comp.nodeName}`);
    const renderer = new Renderer();
    comp.render(renderer);
    renderer._flush();
  }
}
