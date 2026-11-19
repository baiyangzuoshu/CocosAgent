import BaseNode from "./utils/base-node.ts";
import Sprite from "./components/CCSprite.ts";
import type { CocosNamespace } from "../../index.ts";

/** 本课只保留 Prefab 树复制与 SpriteFrame 引用共享，不包含输入或渲染状态。 */
export default class Node extends BaseNode {
  private _sprite: Sprite | null = null;

  setSprite(sprite: Sprite): void {
    this._sprite = sprite;
  }

  get sprite(): Sprite | null {
    return this._sprite;
  }

  _instantiate(): Node {
    const clone = new Node(this.name);
    for (const component of this._components) {
      clone._components.push(component._instantiate(clone));
    }
    if (this._sprite) {
      const sprite = new Sprite(clone);
      if (this._sprite.spriteFrame) sprite.setSpriteFrame(this._sprite.spriteFrame);
      clone.setSprite(sprite);
    }
    for (const child of this.children) {
      clone.addChild((child as Node)._instantiate());
    }
    return clone;
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
