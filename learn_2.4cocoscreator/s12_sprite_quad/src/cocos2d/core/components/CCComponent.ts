import CCObject from "../platform/CCObject.ts";
import type BaseNode from "../utils/base-node.ts";
import type { CocosNamespace } from "../../../index.ts";

export default class Component extends CCObject {
  node!: BaseNode;
  private _loaded = false;

  constructor() {
    super();
  }

  onLoad(): void {}
  onEnable(): void {}
  onDisable(): void {}
  start?(): void;
  update?(deltaTime: number): void;
  lateUpdate?(deltaTime: number): void;

  _activate(): void {
    if (!this._loaded) {
      this._loaded = true;
      this.onLoad();
    }
    host.cc?.director?._compScheduler.enableComp(this);
  }

  _deactivate(): void {
    host.cc?.director?._compScheduler.disableComp(this);
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
