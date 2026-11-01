import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";

export class Node extends CCObject {
  protected _parent: Node | null = null;
  protected _children: Node[] = [];
  protected _activeInHierarchy = false;
  protected _lpos = { x: 0, y: 0, z: 0 };

  constructor(public name = "New Node") {
    super();
  }

  get children(): readonly Node[] {
    return this._children;
  }

  get parent(): Node | null {
    return this._parent;
  }

  setPosition(x: number, y: number, z = 0): void {
    this._lpos = { x, y, z };
  }

  getPosition(): { x: number; y: number; z: number } {
    return { ...this._lpos };
  }

  get worldPosition(): { x: number; y: number; z: number } {
    if (!this._parent) {
      return this.getPosition();
    }

    const parentPosition = this._parent.worldPosition;
    return {
      x: parentPosition.x + this._lpos.x,
      y: parentPosition.y + this._lpos.y,
      z: parentPosition.z + this._lpos.z,
    };
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
