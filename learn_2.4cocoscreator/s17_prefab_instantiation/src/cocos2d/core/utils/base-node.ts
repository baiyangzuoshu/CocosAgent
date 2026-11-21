/** Minimal parent/children relationship for detached Prefab tree cloning. */
export default class BaseNode {
  _parent: BaseNode | null = null;
  _children: BaseNode[] = [];

  constructor(public name = "New Node") {}

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
}
