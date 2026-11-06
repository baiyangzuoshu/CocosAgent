import type Scene from "../CCScene.ts";
import type Node from "../CCNode.ts";

interface Position {
  x: number;
  y: number;
}

export class RenderFlow {
  private _lastRenderedSceneName = "等待场景";
  private _frame = 0;
  private _transformHistory: string[] = [];

  get lastRenderedSceneName(): string {
    return this._lastRenderedSceneName;
  }

  get transformHistory(): readonly string[] {
    return this._transformHistory;
  }

  render(scene: Scene, _deltaTime: number): void {
    this._lastRenderedSceneName = scene.name;
    const updated: string[] = [];
    this._visit(scene as Node, { x: 0, y: 0 }, false, updated);
    this._frame++;
    this._transformHistory.push(`第 ${this._frame} 帧：${updated.length ? updated.join("、") : "无变换重算"}`);
    if (this._transformHistory.length > 3) this._transformHistory.shift();
  }

  private _visit(node: Node, parentPosition: Position, parentDirty: boolean, updated: string[]): void {
    if (!node.activeInHierarchy) return;

    const changed = node._updateWorldTransform(parentPosition, parentDirty);
    if (changed) updated.push(node.name);

    const worldPosition = node.getWorldPosition();
    for (const child of node.children as readonly Node[]) {
      this._visit(child, worldPosition, changed, updated);
    }
  }
}
