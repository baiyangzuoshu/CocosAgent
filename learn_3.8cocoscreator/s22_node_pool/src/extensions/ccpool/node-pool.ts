import type { Node } from "../../cocos/scene-graph/node.ts";

export class NodePool<T extends Node> {
  private _pool: T[] = [];

  size(): number {
    return this._pool.length;
  }

  put(node: T): void {
    if (this._pool.includes(node)) return;
    node.removeFromParent();
    this._pool.push(node);
  }

  get(): T | null {
    return this._pool.pop() ?? null;
  }

  clear(): void {
    const count = this._pool.length;
    for (let i = 0; i < count; i++) this._pool[i].destroy();
    this._pool.length = 0;
  }
}
