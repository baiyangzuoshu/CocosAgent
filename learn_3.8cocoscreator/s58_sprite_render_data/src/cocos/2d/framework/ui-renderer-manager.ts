import type { UIRenderer } from "./ui-renderer.ts";

class UIRendererManager {
  private dirtyRenderers: UIRenderer[] = [];

  markDirtyRenderer(renderer: UIRenderer): void {
    if (!this.dirtyRenderers.includes(renderer)) this.dirtyRenderers.push(renderer);
  }

  updateAllDirtyRenderers(): void {
    for (const renderer of this.dirtyRenderers) renderer.updateRenderer();
    this.dirtyRenderers.length = 0;
  }
}

export const uiRendererManager = new UIRendererManager();
