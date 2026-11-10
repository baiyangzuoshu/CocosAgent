import { NodeEventProcessor } from "./node-event-processor.ts";
import type { NodeEvent } from "../input/types/event/event.ts";
import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";
import { Component } from "./component.ts";
import { Sprite } from "../2d/components/sprite.ts";
import type { RenderComponent } from "../2d/renderer/batcher-2d.ts";

export class Node extends CCObject {
  readonly eventProcessor = new NodeEventProcessor(this);

  onTouchStart(callback: (event: NodeEvent) => void, capture = false): void {
    this.eventProcessor.onTouchStart(callback, capture);
  }
  dispatchTouchStart(x: number, y: number): void { this.eventProcessor.dispatchTouchStart(x, y); }

  protected _parent: Node | null = null;
  protected _children: Node[] = [];
  protected _active = true;
  protected _activeInHierarchy = false;
  protected _lpos = { x: 0, y: 0, z: 0 };
  protected _worldPosition = { x: 0, y: 0, z: 0 };
  protected _worldTransformDirty = true;
  protected _worldTransformUpdateCount = 0;
  protected _components: Component[] = [];
  _renderComponent: RenderComponent | null = null;

  constructor(public name = "New Node") {
    super();
  }

  get children(): readonly Node[] {
    return this._children;
  }

  get components(): readonly Component[] {
    return this._components;
  }

  getComponent<T extends Component>(ComponentClass: new (...args: any[]) => T): T | null {
    for (const component of this._components) {
      if (component instanceof ComponentClass) return component as T;
    }
    return null;
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
    this.invalidateWorldTransform();
  }

  getPosition(): { x: number; y: number; z: number } {
    return { ...this._lpos };
  }

  _instantiate(): Node {
    const clone = new Node(this.name);
    clone.setPosition(this._lpos.x, this._lpos.y, this._lpos.z);
    for (const component of this._components) {
      clone._components.push(component._instantiate(clone));
    }
    if (this._renderComponent instanceof Sprite) {
      const sprite = new Sprite(clone);
      if (this._renderComponent.spriteFrame) {
        sprite.setSpriteFrame(this._renderComponent.spriteFrame);
      }
      clone.setRenderComponent(sprite);
    }
    for (const child of this._children) {
      clone.addChild(child._instantiate());
    }
    return clone;
  }

  get worldPosition(): { x: number; y: number; z: number } {
    this.updateWorldTransform();
    return { ...this._worldPosition };
  }

  get worldTransformUpdateCount(): number {
    return this._worldTransformUpdateCount;
  }

  updateWorldTransform(): void {
    if (!this._worldTransformDirty) return;

    const parentPosition = this._parent?.worldPosition ?? { x: 0, y: 0, z: 0 };
    this._worldPosition = {
      x: parentPosition.x + this._lpos.x,
      y: parentPosition.y + this._lpos.y,
      z: parentPosition.z + this._lpos.z,
    };
    this._worldTransformDirty = false;
    this._worldTransformUpdateCount++;
  }

  private invalidateWorldTransform(): void {
    this._worldTransformDirty = true;
    for (const child of this._children) child.invalidateWorldTransform();
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
    this.invalidateWorldTransform();

    const shouldBeActive = this._active && !!(value && value._activeInHierarchy);
    if (this._activeInHierarchy !== shouldBeActive) {
      (cclegacy.director as DirectorWithNodeActivator)._nodeActivator.activateNode(this, shouldBeActive);
    }
  }

  addChild(child: Node): void {
    child.setParent(this);
  }

  removeChild(child: Node): void {
    if (this._children.includes(child)) child.parent = null;
  }

  removeFromParent(): void {
    this._parent?.removeChild(this);
  }

  setRenderComponent(component: RenderComponent): void {
    this._renderComponent = component;
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

  override destroy(): boolean {
    if (!super.destroy()) return false;
    this.active = false;
    return true;
  }

  protected override _onPreDestroy(): void {
    this.setParent(null);
    for (const child of [...this._children]) child._destroyImmediate();
    for (const component of [...this._components]) component._destroyImmediate();
    this._children.length = 0;
    this._components.length = 0;
  }
}

interface DirectorWithNodeActivator {
  _nodeActivator: {
    activateNode(node: Node, active: boolean): void;
    activateComp(component: Component): void;
  };
}

cclegacy.Node = Node;
