import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";
import type { Node } from "./node.ts";

export class Component extends CCObject {
  node!: Node;
  private _loaded = false;
  private _enabledInHierarchy = false;

  constructor() {
    super();
  }

  onLoad(): void {}
  onEnable(): void {}
  onDisable(): void {}

  _activate(): void {
    if (!this._loaded) {
      this._loaded = true;
      this.onLoad();
    }
    if (!this._enabledInHierarchy) {
      this._enabledInHierarchy = true;
      this.onEnable();
    }
  }

  _deactivate(): void {
    if (this._enabledInHierarchy) {
      this._enabledInHierarchy = false;
      this.onDisable();
    }
  }
}

cclegacy.Component = Component;
