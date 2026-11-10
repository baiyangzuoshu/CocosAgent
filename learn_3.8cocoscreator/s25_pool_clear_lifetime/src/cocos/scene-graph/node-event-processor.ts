import type { Node } from "./node.ts";
import { UITransform } from "../2d/framework/ui-transform.ts";
import { NodeEvent } from "../input/types/event/event.ts";

export class NodeEventProcessor {
  private readonly _uiTransform: UITransform;
  private readonly _captureListeners: Array<(event: NodeEvent) => void> = [];
  private readonly _bubbleListeners: Array<(event: NodeEvent) => void> = [];
  constructor(private readonly node: Node) { this._uiTransform = new UITransform(node); }

  onTouchStart(callback: (event: NodeEvent) => void, capture = false): void {
    (capture ? this._captureListeners : this._bubbleListeners).push(callback);
  }

  handleTouchStart(x: number, y: number): boolean {
    if (!this._uiTransform.hitTest(x, y)) return false;
    this.dispatchTouchStart(x, y);
    return true;
  }

  dispatchTouchStart(x: number, y: number): void { this.dispatchEvent(new NodeEvent(this.node, x, y)); }

  dispatchEvent(event: NodeEvent): void {
    const parents: Node[] = [];
    for (let node = this.node.parent; node; node = node.parent) parents.push(node);
    event.phase = "capture";
    for (const node of [...parents].reverse()) {
      event.currentTarget = node;
      for (const callback of node.eventProcessor._captureListeners) callback(event);
      if (event.propagationStopped) return;
    }
    event.phase = "target";
    event.currentTarget = this.node;
    for (const callback of this._captureListeners) callback(event);
    for (const callback of this._bubbleListeners) callback(event);
    if (!event.bubbles || event.propagationStopped) return;
    event.phase = "bubble";
    for (const node of parents) {
      event.currentTarget = node;
      for (const callback of node.eventProcessor._bubbleListeners) callback(event);
      if (event.propagationStopped) return;
    }
  }
}
