import { RenderComponent, type RenderItem } from "../components/render-component.ts";
import { ModelBatcher } from "./webgl/model-batcher.ts";

export class RenderFlow {
  constructor(readonly batcher: ModelBatcher) {}

  render(items: RenderItem[]): void {
    this.batcher.reset();
    this.batcher.walking = true;
    for (const item of items) {
      const component = new RenderComponent(item);
      component._checkBacth(this.batcher, item.cullingMask);
      this.batcher.buffer.requestQuad();
      console.log("fillBuffers:", item.name);
    }
    this.batcher.terminate();
  }
}
