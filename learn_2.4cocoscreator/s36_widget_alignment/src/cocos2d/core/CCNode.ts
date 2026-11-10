export interface Size { width: number; height: number; }
export interface Point { x: number; y: number; }

export default class CCNode {
  position: Point = { x: 0, y: 0 };
  contentSize: Size = { width: 0, height: 0 };
  anchorPoint: Point = { x: 0.5, y: 0.5 };

  constructor(readonly name: string, public parent: CCNode | null = null) {}

  setContentSize(size: Size): void {
    this.contentSize = { ...size };
  }

  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }
}
