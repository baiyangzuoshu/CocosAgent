import { View } from "../core/view.ts";
import type { RenderScene } from "../scene/scene.ts";

export class ForwardRenderer {
  render(scene: RenderScene, width: number, height: number): void {
    const views: View[] = [];
    for (const camera of scene._cameras) {
      const view = new View();
      camera.extractView(view, width, height);
      views.push(view);
    }

    views.sort((a, b) => a.priority - b.priority);
    for (const view of views) {
      console.log(`ForwardRenderer._render(${view.cameraName}, rect=${view.rect.w}x${view.rect.h})`);
    }
  }
}
