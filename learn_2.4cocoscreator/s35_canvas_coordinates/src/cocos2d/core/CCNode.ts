import type { Point, Size } from "./CCView.ts";

export default class CCNode {
  position: Point = { x: 0, y: 0 };
  contentSize: Size = { width: 0, height: 0 };

  constructor(readonly name: string) {}

  setPosition(x: number, y: number): void {
    this.position = { x, y };
  }

  setContentSize(size: Size): void {
    this.contentSize = { ...size };
  }
}
