export interface RenderVertex {
  x: number;
  y: number;
  u: number;
  v: number;
  color: string;
}

export class RenderData {
  vertDirty = true;
  vertices: RenderVertex[] = [];
  indices = [0, 1, 2, 1, 3, 2];

  updateRenderData(): void {
    console.log("RenderData.updateRenderData -> frame/material metadata ready");
  }
}
