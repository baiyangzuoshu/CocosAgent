import BaseNode from "./utils/base-node.ts";
import Component from "./components/CCComponent.ts";
import { cloneGraph } from "./platform/instantiate.ts";
import type { CocosNamespace } from "../../index.ts";

/** Detached-node clone model; scene activation and rendering are outside this lesson. */
export default class Node extends BaseNode {
  private _position = { x: 0, y: 0 };
  readonly _components: Component[] = [];

  setPosition(x: number, y: number): void {
    this._position.x = x;
    this._position.y = y;
  }

  getPosition(): { x: number; y: number } {
    return { ...this._position };
  }

  addComponent<T extends Component>(component: T): T {
    component.node = this;
    this._components.push(component);
    return component;
  }

  _instantiate(): Node {
    return cloneGraph(this);
  }
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCNode");
}

host.cc.Node = Node;
