import type { Node } from "../../cocos/scene-graph/node.ts";
import type { Component } from "../../cocos/scene-graph/component.ts";

type Constructor<T> = new (...args: any[]) => T;
type PoolHandlerComponent = Component & {
  unuse?: () => void;
  reuse?: (args: IArguments) => void;
};

// NodePool 实例共享此表，记录仍由池持有的节点。
const poolOwners = new WeakMap<Node, object>();

export class NodePool<T extends Node> {
  private _pool: T[] = [];
  private readonly _ownerToken = {};
  private _disposed = false;

  constructor(private poolHandlerComp?: Constructor<PoolHandlerComponent>) {}

  size(): number {
    return this._pool.length;
  }

  isDisposed(): boolean {
    return this._disposed;
  }

  put(node: T): void {
    // 本池数组防重复；共享表阻止其他 NodePool 同时接收。
    if (this._disposed || this._pool.indexOf(node) !== -1 || poolOwners.has(node)) return;
    poolOwners.set(node, this._ownerToken);
    try {
      node.removeFromParent();
      const handler = this.poolHandlerComp ? node.getComponent(this.poolHandlerComp) : null;
      if (handler?.unuse) handler.unuse();
      this._pool.push(node);
    } catch (error) {
      poolOwners.delete(node);
      throw error;
    }
  }

  get(...args: any[]): T | null {
    if (this._disposed) return null;
    const last = this._pool.length - 1;
    if (last < 0) return null;
    // 读取并缩短数组尾部，与引擎 NodePool 的取出方式一致。
    const node = this._pool[last];
    this._pool.length = last;
    if (poolOwners.get(node) === this._ownerToken) poolOwners.delete(node);
    const handler = this.poolHandlerComp ? node.getComponent(this.poolHandlerComp) : null;
    if (handler?.reuse) handler.reuse(arguments);
    return node;
  }

  clear(): void {
    const count = this._pool.length;
    for (let i = 0; i < count; i++) {
      const node = this._pool[i];
      if (poolOwners.get(node) === this._ownerToken) poolOwners.delete(node);
      node.destroy();
    }
    this._pool.length = 0;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.clear();
  }
}
