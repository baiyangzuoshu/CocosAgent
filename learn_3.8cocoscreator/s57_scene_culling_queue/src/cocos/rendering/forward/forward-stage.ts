import { RenderQueue } from "../render-queue.ts";
import type { Model } from "../../render-scene/scene/model.ts";

export class ForwardStage {
  render(renderObjects: Model[]): void {
    const opaqueQueue = new RenderQueue(false);
    const transparentQueue = new RenderQueue(true);
    for (const model of renderObjects) {
      for (const pass of model.passes) {
        opaqueQueue.insert(model.name, model.priority, pass);
        transparentQueue.insert(model.name, model.priority, pass);
      }
    }
    opaqueQueue.sort();
    transparentQueue.sort();
    console.log(`opaque queue (hash/depth/shader): ${opaqueQueue.names().join(" -> ") || "empty"}`);
    console.log(`transparent queue (priority/hash/back-to-front/shader): ${transparentQueue.names().join(" -> ") || "empty"}`);
  }
}
