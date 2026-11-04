import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";
import { Component } from "./component.ts";

export class Node extends CCObject {
  protected _parent: Node | null = null;
  protected _children: Node[] = [];
  protected _active = true;
  protected _activeInHierarchy = false;
  protected _lpos = { x: 0, y: 0, z: 0 };
  protected _components: Component[] = [];

  constructor(public name = "New Node") {
    super();
  }

  get children(): readonly Node[] {
    return this._children;
  }

  get components(): readonly Component[] {
    return this._components;
  }

  get parent(): Node | null {
    return this._parent;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    value = !!value;
    if (this._active === value) {
      return;
    }
    this._active = value;
    if (this._parent?._activeInHierarchy) {
      (cclegacy.director as DirectorWithNodeActivator)._nodeActivator.activateNode(this, value);
    }
  }

  get activeInHierarchy(): boolean {
    return this._activeInHierarchy;
  }

  _setActiveInHierarchy(value: boolean): void {
    this._activeInHierarchy = value;
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

    const shouldBeActive = this._active && !!(value && value._activeInHierarchy);
    if (this._activeInHierarchy !== shouldBeActive) {
      (cclegacy.director as DirectorWithNodeActivator)._nodeActivator.activateNode(this, shouldBeActive);
    }
  }

  addChild(child: Node): void {
    child.setParent(this);
  }

  addComponent<T extends Component>(ComponentClass: new () => T): T {
    const component = new ComponentClass();
    component.node = this;
    this._components.push(component);
    if (this._activeInHierarchy) {
      (cclegacy.director as DirectorWithNodeActivator)._nodeActivator.activateComp(component);
    }
    return component;
  }
}

interface DirectorWithNodeActivator {
  _nodeActivator: {
    activateNode(node: Node, active: boolean): void;
    activateComp(component: Component): void;
  };
}

cclegacy.Node = Node;
