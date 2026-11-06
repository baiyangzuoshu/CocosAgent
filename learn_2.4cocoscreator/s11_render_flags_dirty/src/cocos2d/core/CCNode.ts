import BaseNode from "./utils/base-node.ts";
import type { CocosNamespace } from "../../index.ts";

const WORLD_TRANSFORM = 1 << 0;

export default class Node extends BaseNode {
  private _position = { x: 0, y: 0 };
  private _worldPosition = { x: 0, y: 0 };
  private _renderFlag = WORLD_TRANSFORM;
  private _worldTransformUpdateCount = 0;

  setPosition(x: number, y: number): void {
    if (this._position.x === x && this._position.y === y) return;
    this._position.x = x;
    this._position.y = y;
    this._renderFlag |= WORLD_TRANSFORM;
  }

  getPosition(): { x: number; y: number } {
    return { ...this._position };
  }

  getWorldPosition(): { x: number; y: number } {
    return { ...this._worldPosition };
  }

  _updateWorldTransform(parentPosition: { x: number; y: number }, parentDirty: boolean): boolean {
    if (parentDirty) this._renderFlag |= WORLD_TRANSFORM;
    if ((this._renderFlag & WORLD_TRANSFORM) === 0) return false;

    this._worldPosition.x = parentPosition.x + this._position.x;
    this._worldPosition.y = parentPosition.y + this._position.y;
    this._renderFlag &= ~WORLD_TRANSFORM;
    this._worldTransformUpdateCount++;
    return true;
  }

  get worldTransformUpdateCount(): number {
    return this._worldTransformUpdateCount;
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
