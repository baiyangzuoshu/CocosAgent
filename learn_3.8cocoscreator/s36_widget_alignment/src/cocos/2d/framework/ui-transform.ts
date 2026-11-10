export interface Size { width: number; height: number; }
export interface Point { x: number; y: number; }

export default class UITransform {
  contentSize: Size = { width: 0, height: 0 };
  anchorPoint: Point = { x: 0.5, y: 0.5 };

  setContentSize(size: Size): void {
    this.contentSize = { ...size };
  }
}
