export interface SpriteVertex {
  x: number;
  y: number;
  u: number;
  v: number;
  color: string;
}

export class RenderData {
  vDatas: SpriteVertex[] = [];
  iDatas = [0, 1, 2, 1, 3, 2];
  meshCount = 0;

  updateMesh(vertices: SpriteVertex[]): void {
    this.vDatas = vertices;
    this.meshCount = 1;
  }
}
