import type { RenderScene } from "../core/render-scene.ts";
import type { RenderWindow } from "../core/render-window.ts";

export interface CameraInfo {
  name: string;
  node: string;
  projection: "perspective" | "orthographic";
  window: RenderWindow;
  priority: number;
}

export class Camera {
  scene: RenderScene | null = null;
  window: RenderWindow | null = null;
  enabled = true;
  priority = 0;
  viewport = { x: 0, y: 0, width: 1, height: 1 };
  name = "";

  initialize(info: CameraInfo): void {
    this.name = info.name;
    this.priority = info.priority;
    this.changeTargetWindow(info.window);
    console.log(`RenderScene.Camera.initialize(${this.name}, ${info.projection})`);
  }

  changeTargetWindow(window: RenderWindow): void {
    window.attachCamera(this);
    this.window = window;
  }

  setViewportInOrientedSpace(rect: { x: number; y: number; width: number; height: number }): void {
    this.viewport = { ...rect };
    console.log(`${this.name}.setViewportInOrientedSpace(${rect.width}x${rect.height})`);
  }

  update(): void {
    console.log(`${this.name}.update -> camera matrices`);
  }

  attachToScene(scene: RenderScene): void {
    this.scene = scene;
  }
}
