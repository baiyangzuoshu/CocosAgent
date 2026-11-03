import CCObject from "../platform/CCObject.ts";
import type BaseNode from "../utils/base-node.ts";
import type { CocosNamespace } from "../../../index.ts";

export default class Component extends CCObject {
  node!: BaseNode;
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

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;
if (!host.cc) {
  throw new Error("cc must be initialized before CCComponent");
}
host.cc.Component = Component;
