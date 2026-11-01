import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";

export class Node extends CCObject {
  protected _parent: Node | null = null;
  protected _children: Node[] = [];
  protected _activeInHierarchy = false;

  constructor(public name = "New Node") {
    super();
  }

  get children(): readonly Node[] {
    return this._children;
  }

  get parent(): Node | null {
    return this._parent;
  }

  set parent(value: Node | null) {
    this.setParent(value);
  }

  setParent(value: Node | null): void {
    if (this._parent === value) {
      return;
    }

    const oldParent = this._parent;
    this._parent = value;

    if (oldParent) {
      const index = oldParent._children.indexOf(this);
      if (index >= 0) {
        oldParent._children.splice(index, 1);
      }
    }

    if (value) {
      value._children.push(this);
    }
  }

  addChild(child: Node): void {
    child.setParent(this);
  }
}

cclegacy.Node = Node;
