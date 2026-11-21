import type BaseNode from "./utils/base-node.ts";

export default class NodeActivator {
  activateNode(node: BaseNode, active: boolean): void {
    if (active) {
      this._activateNodeRecursively(node);
    } else {
      this._deactivateNodeRecursively(node);
    }
  }

  private _activateNodeRecursively(node: BaseNode): void {
    node._setActiveInHierarchy(true);
    for (const child of node.children) {
      if (child.active) {
        this._activateNodeRecursively(child);
      }
    }
  }

  private _deactivateNodeRecursively(node: BaseNode): void {
    node._setActiveInHierarchy(false);
    for (const child of node.children) {
      if (child.activeInHierarchy) {
        this._deactivateNodeRecursively(child);
      }
    }
  }
}
