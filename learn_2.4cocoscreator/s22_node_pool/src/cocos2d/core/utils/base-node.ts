import CCObject from "../platform/CCObject.ts";
import type Component from "../components/CCComponent.ts";
import type { CocosNamespace } from "../../../index.ts";

export default class BaseNode extends CCObject {
  _parent: BaseNode | null = null;
  _children: BaseNode[] = [];
  _active = true;
  _activeInHierarchy = false;
  _components: Component[] = [];

  constructor(public name = "New Node") {
    super();
  }

  get children(): readonly BaseNode[] {
    return this._children;
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
      host.cc?.director?._nodeActivator.activateNode(this, value);
    }
  }

  get activeInHierarchy(): boolean {
    return this._activeInHierarchy;
  }

  _setActiveInHierarchy(value: boolean): void {
    this._activeInHierarchy = value;
  }

  getParent(): BaseNode | null {
    return this._parent;
  }

  setParent(value: BaseNode | null): void {
    if (this._parent === value) {
      return;
    }

    const oldParent = this._parent;
    this._parent = value;

    if (value) {
      value._children.push(this);
    }

    if (oldParent) {
      const index = oldParent._children.indexOf(this);
      if (index >= 0) {
        oldParent._children.splice(index, 1);
      }
    }

    const shouldBeActive = this._active && !!(value && value._activeInHierarchy);
    if (this._activeInHierarchy !== shouldBeActive) {
      host.cc?.director?._nodeActivator.activateNode(this, shouldBeActive);
    }
  }

  addChild(child: BaseNode): void {
    if (child._parent) {
      throw new Error("子节点已经有父节点");
    }
    child.setParent(this);
  }

  // 只演示 cleanup=false；动作和事件清理不在本课范围。
  removeChild(child: BaseNode, _cleanup: false): void {
    if (this._children.includes(child)) child.setParent(null);
  }

  removeFromParent(cleanup: false): void {
    this._parent?.removeChild(this, cleanup);
  }

  addComponent<T extends Component>(ComponentClass: new () => T): T {
    const component = new ComponentClass();
    component.node = this;
    this._components.push(component);
    if (this._activeInHierarchy) {
      host.cc?.director?._nodeActivator.activateComp(component);
    }
    return component;
  }

  protected override _onPreDestroy(): void {
    const parent = this._parent;
    if (parent) {
      const index = parent._children.indexOf(this);
      if (index >= 0) parent._children.splice(index, 1);
      this._parent = null;
    }
    for (const child of [...this._children]) child._destroyImmediate();
    for (const component of [...this._components]) component._destroyImmediate();
    this._children.length = 0;
    this._components.length = 0;
  }
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before BaseNode");
}

host.cc._BaseNode = BaseNode;
