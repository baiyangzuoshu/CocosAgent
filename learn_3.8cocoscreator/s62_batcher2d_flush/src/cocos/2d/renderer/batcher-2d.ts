import { DrawBatch2D, type Material } from "./draw-batch.ts";

export interface RenderData {
  dataHash: number;
  indexCount: number;
  valid: boolean;
}

export interface RenderItem {
  name: string;
  renderData: RenderData;
  material: Material;
  texture: string;
  sampler: string;
  stencilStage: number;
  layer: number;
}

export class Batcher2D {
  readonly batches: DrawBatch2D[] = [];
  private currentHash = 0;
  private currentMaterial: Material | null = null;
  private currentTexture = "";
  private currentSampler = "";
  private currentStencilStage = 0;
  private currentLayer = 0;
  private currentIndexCount = 0;

  commitComp(item: RenderItem): void {
    const dataHash = item.renderData.dataHash;
    if (!item.renderData.valid) return;

    if (
      this.currentHash !== dataHash ||
      dataHash === 0 ||
      this.currentMaterial !== item.material ||
      this.currentStencilStage !== item.stencilStage
    ) {
      this.autoMergeBatches();
      this.currentHash = dataHash;
      this.currentMaterial = item.material;
      this.currentTexture = item.texture;
      this.currentSampler = item.sampler;
      this.currentStencilStage = item.stencilStage;
      this.currentLayer = item.layer;
    }

    this.currentIndexCount += item.renderData.indexCount;
    console.log("Batcher2D commitComp:", item.name, "indices", item.renderData.indexCount);
  }

  autoMergeBatches(): void {
    if (!this.currentMaterial || !this.currentTexture || this.currentIndexCount === 0) return;

    this.batches.push(new DrawBatch2D({
      material: this.currentMaterial,
      texture: this.currentTexture,
      sampler: this.currentSampler,
      stencilStage: this.currentStencilStage,
      layer: this.currentLayer,
      indexCount: this.currentIndexCount,
    }));
    console.log(
      "Batcher2D autoMergeBatches:",
      this.currentMaterial.name,
      "indices",
      this.currentIndexCount,
      "stencil",
      this.currentStencilStage,
    );
    this.currentIndexCount = 0;
  }

  finishMergeBatches(): void {
    this.autoMergeBatches();
    this.currentHash = 0;
    this.currentMaterial = null;
  }
}
