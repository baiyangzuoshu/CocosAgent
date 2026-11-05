import type { Component } from "./component.ts";
import type { Node } from "./node.ts";

export default class NodeActivator {
  activateNode(node: Node, active: boolean): void {
    if (active) {
      this._activateNodeRecursively(node);
    } else {
      this._deactivateNodeRecursively(node);
    }
  }

  private _activateNodeRecursively(node: Node): void {
    node._setActiveInHierarchy(true);
    for (const component of node.components) {
      this.activateComp(component);
    }
    for (const child of node.children) {
      if (child.active) {
        this._activateNodeRecursively(child);
      }
    }
  }

  activateComp(component: Component): void {
    component._activate();
  }

  private _deactivateNodeRecursively(node: Node): void {
    node._setActiveInHierarchy(false);
    for (const component of node.components) {
      component._deactivate();
    }
    for (const child of node.children) {
      if (child.activeInHierarchy) {
        this._deactivateNodeRecursively(child);
      }
    }
  }
}
