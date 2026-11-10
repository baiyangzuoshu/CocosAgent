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
    // 同一节点只允许占用一个池槽。
    if (this._pool.indexOf(node) !== -1) return;
    node.removeFromParent();
    const handler = this.poolHandlerComp ? node.getComponent(this.poolHandlerComp) : null;
    if (handler?.unuse) handler.unuse();
    this._pool.push(node);
  }

  get(...args: any[]): T | null {
    const last = this._pool.length - 1;
    if (last < 0) return null;
    // 读取并缩短数组尾部，与引擎 NodePool 的取出方式一致。
    const node = this._pool[last];
    this._pool.length = last;
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
