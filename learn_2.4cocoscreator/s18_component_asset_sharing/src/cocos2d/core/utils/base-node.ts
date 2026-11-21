import CCObject from "../platform/CCObject.ts";
import type Component from "../components/CCComponent.ts";

/** Minimal tree and component storage for the detached Prefab sharing example. */
export default class BaseNode extends CCObject {
  _parent: BaseNode | null = null;
  _children: BaseNode[] = [];
  _components: Component[] = [];

  constructor(public name = "New Node") {
    super();
  }

  get children(): readonly BaseNode[] {
    return this._children;
  }

  getParent(): BaseNode | null {
    return this._parent;
  }

  setParent(value: BaseNode | null): void {
    if (this._parent === value) return;

    const oldParent = this._parent;
    this._parent = value;
    if (value) value._children.push(this);
    if (oldParent) {
      const index = oldParent._children.indexOf(this);
      if (index >= 0) oldParent._children.splice(index, 1);
    }
  }

  addChild(child: BaseNode): void {
    if (child._parent) throw new Error("子节点已经有父节点");
    child.setParent(this);
  }

  addComponent<T extends Component>(ComponentClass: new () => T): T {
    const component = new ComponentClass();
    component.node = this;
    this._components.push(component);
    return component;
  }
}
