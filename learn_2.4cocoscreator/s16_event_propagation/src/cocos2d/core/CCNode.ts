import { NodeEvent } from "./event/event.ts";
import BaseNode from "./utils/base-node.ts";
import type { RenderComponent } from "./renderer/webgl/assembler-2d.ts";
import type { CocosNamespace } from "../../index.ts";

const WORLD_TRANSFORM = 1 << 0;

export default class Node extends BaseNode {
  private readonly _captureListeners: Array<(event: NodeEvent) => void> = [];
  private readonly _bubbleListeners: Array<(event: NodeEvent) => void> = [];

  onTouchStart(callback: (event: NodeEvent) => void, capture = false): void {
    (capture ? this._captureListeners : this._bubbleListeners).push(callback);
  }

  _hitTest(x: number, y: number): boolean {
    const pos = this.getWorldPosition();
    return this.activeInHierarchy && Math.abs(x - pos.x) <= 28 && Math.abs(y - pos.y) <= 28;
  }

  dispatchTouchStart(x: number, y: number): void { this.dispatchEvent(new NodeEvent(this, x, y)); }

  dispatchEvent(event: NodeEvent): void {
    const parents: Node[] = [];
    for (let node = this.getParent() as Node | null; node; node = node.getParent() as Node | null) parents.push(node);
    event.phase = "capture";
    for (const node of [...parents].reverse()) {
      event.currentTarget = node;
      for (const callback of node._captureListeners) callback(event);
      if (event.propagationStopped) return;
    }
    event.phase = "target";
    event.currentTarget = this;
    for (const callback of this._captureListeners) callback(event);
    for (const callback of this._bubbleListeners) callback(event);
    if (!event.bubbles || event.propagationStopped) return;
    event.phase = "bubble";
    for (const node of parents) {
      event.currentTarget = node;
      for (const callback of node._bubbleListeners) callback(event);
      if (event.propagationStopped) return;
    }
  }

  private _position = { x: 0, y: 0 };
  private _worldPosition = { x: 0, y: 0 };
  private _renderFlag = WORLD_TRANSFORM;
  private _worldTransformUpdateCount = 0;
  private _renderComponent: RenderComponent | null = null;

  setRenderComponent(component: RenderComponent): void {
    this._renderComponent = component;
  }

  get renderComponent(): RenderComponent | null {
    return this._renderComponent;
  }

  setPosition(x: number, y: number): void {
    if (this._position.x === x && this._position.y === y) return;
    this._position.x = x;
    this._position.y = y;
    this._renderFlag |= WORLD_TRANSFORM;
  }

  getPosition(): { x: number; y: number } {
    return { ...this._position };
  }

  getWorldPosition(): { x: number; y: number } {
    return { ...this._worldPosition };
  }

  _updateWorldTransform(parentPosition: { x: number; y: number }, parentDirty: boolean): boolean {
    if (parentDirty) this._renderFlag |= WORLD_TRANSFORM;
    if ((this._renderFlag & WORLD_TRANSFORM) === 0) return false;

    this._worldPosition.x = parentPosition.x + this._position.x;
    this._worldPosition.y = parentPosition.y + this._position.y;
    this._renderFlag &= ~WORLD_TRANSFORM;
    this._worldTransformUpdateCount++;
    return true;
  }

  get worldTransformUpdateCount(): number {
    return this._worldTransformUpdateCount;
  }
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCNode");
}

host.cc.Node = Node;
