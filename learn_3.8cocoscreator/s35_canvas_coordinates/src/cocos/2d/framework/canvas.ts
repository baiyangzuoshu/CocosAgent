import RenderRoot2D from "./render-root-2d.ts";
import Node from "../../scene-graph/node.ts";
import View from "../../ui/view.ts";
import Camera from "../../misc/camera-component.ts";

export default class Canvas extends RenderRoot2D {
  alignCanvasWithScreen = true;

  constructor(
    readonly node: Node,
    private readonly view: View,
    private readonly cameraComponent: Camera,
  ) {
    super();
  }

  override onEnable(): void {
    super.onEnable();
    this._onResizeCamera();
  }

  private _onResizeCamera(): void {
    if (!this.alignCanvasWithScreen) return;
    this.cameraComponent.orthoHeight =
      this.view.frameSize.height / this.view.scaleY / 2;
    this.cameraComponent.node.setWorldPosition(
      this.node.position.x,
      this.node.position.y,
      1000,
    );
  }
}
