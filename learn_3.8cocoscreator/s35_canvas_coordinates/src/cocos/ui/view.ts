export type ResolutionPolicy = "SHOW_ALL";
export interface Size { width: number; height: number; }
export interface Point { x: number; y: number; }
export interface Rect extends Point { width: number; height: number; }

export default class View {
  readonly frameSize: Size;
  designSize: Size = { width: 0, height: 0 };
  scaleX = 1;
  scaleY = 1;
  viewport: Rect = { x: 0, y: 0, width: 0, height: 0 };
  visibleSize: Size = { width: 0, height: 0 };

  constructor(frameSize: Size) {
    this.frameSize = { ...frameSize };
  }

  setDesignResolutionSize(width: number, height: number, policy: ResolutionPolicy): void {
    if (width <= 0 || height <= 0) throw new Error("设计分辨率必须大于 0");
    if (policy !== "SHOW_ALL") throw new Error("本课只实现 SHOW_ALL");
    this.designSize = { width, height };

    const scale = Math.min(
      this.frameSize.width / width,
      this.frameSize.height / height,
    );
    this.scaleX = scale;
    this.scaleY = scale;

    this.viewport.width = width * this.scaleX;
    this.viewport.height = height * this.scaleY;
    this.viewport.x = (this.frameSize.width - this.viewport.width) / 2;
    this.viewport.y = (this.frameSize.height - this.viewport.height) / 2;
    this.visibleSize = { ...this.designSize };
  }

  designToScreen(point: Point): Point {
    return {
      x: this.viewport.x + point.x * this.scaleX,
      y: this.frameSize.height - this.viewport.y - point.y * this.scaleY,
    };
  }
}
