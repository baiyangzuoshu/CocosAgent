import type { Camera } from "../render-scene/scene/camera.ts";
import type { Model } from "../render-scene/scene/model.ts";

export function sceneCulling(camera: Camera, models: Model[]): Model[] {
  const renderObjects: Model[] = [];
  for (const model of models) {
    if (!model.enabled) continue;
    const visibleByLayer = (camera.visibility & model.nodeLayer) === model.nodeLayer;
    const visibleByFlag = (camera.visibility & model.visFlags) !== 0;
    if (!visibleByLayer && !visibleByFlag) continue;
    if (!model.inFrustum) continue;
    renderObjects.push(model);
  }
  console.log(`sceneCulling(${camera.name}) -> ${renderObjects.map((model) => model.name).join(", ")}`);
  return renderObjects;
}
