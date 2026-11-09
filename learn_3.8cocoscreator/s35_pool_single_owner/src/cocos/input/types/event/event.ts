import type { Node } from "../../../scene-graph/node.ts";

export class NodeEvent {
  currentTarget: Node;
  phase: "capture" | "target" | "bubble" = "target";
  propagationStopped = false;
  constructor(readonly target: Node, readonly x: number, readonly y: number, readonly bubbles = true) {
    this.currentTarget = target;
  }
  stopPropagation(): void { this.propagationStopped = true; }
}
