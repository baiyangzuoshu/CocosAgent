export interface Material {
  name: string;
}

export interface BatchState {
  material: Material;
  texture: string;
  sampler: string;
  stencilStage: number;
  layer: number;
  indexCount: number;
}

export class DrawBatch2D {
  constructor(readonly state: BatchState) {}
}
