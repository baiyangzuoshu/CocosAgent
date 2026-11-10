import type { Node } from "../../cocos/scene-graph/node.ts";
import type { Component } from "../../cocos/scene-graph/component.ts";

type Constructor<T> = new (...args: any[]) => T;
type PoolHandlerComponent = Component & {
  unuse?: () => void;
  reuse?: (args: IArguments) => void;
};

export class NodePool<T extends Node> {
  private _pool: T[] = [];

  constructor(private poolHandlerComp?: Constructor<PoolHandlerComponent>) {}

  size(): number {
    return this._pool.length;
  }

  put(node: T): void {
    if (this._pool.includes(node)) return;
    node.removeFromParent();
    const handler = this.poolHandlerComp ? node.getComponent(this.poolHandlerComp) : null;
    if (handler?.unuse) handler.unuse();
    this._pool.push(node);
  }

  get(...args: any[]): T | null {
    const node = this._pool.pop();
    if (!node) return null;
    const handler = this.poolHandlerComp ? node.getComponent(this.poolHandlerComp) : null;
    if (handler?.reuse) handler.reuse(arguments);
    return node;
  }

  clear(): void {
    const count = this._pool.length;
    for (let i = 0; i < count; i++) this._pool[i].destroy();
    this._pool.length = 0;
  }
}
