export interface Size { width: number; height: number; }
export interface Point { x: number; y: number; }

export default class CCNode {
  readonly children: CCNode[] = [];
  readonly position: Point = { x: 0, y: 0 };
  readonly contentSize: Size = { width: 0, height: 0 };
  readonly anchorPoint: Point = { x: 0.5, y: 0.5 };
  activeInHierarchy = true;
  private readonly childAddedListeners: Array<(child: CCNode) => void> = [];

  constructor(readonly name: string) {}

  setContentSize(size: Size): void {
    this.contentSize.width = size.width;
    this.contentSize.height = size.height;
  }

  setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  addChild(child: CCNode): void {
    this.children.push(child);
    for (const listener of this.childAddedListeners) listener(child);
  }

  onChildAdded(listener: (child: CCNode) => void): void {
    this.childAddedListeners.push(listener);
  }
}
