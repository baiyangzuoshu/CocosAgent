import CCObject from "../platform/CCObject.ts";
import type BaseNode from "../utils/base-node.ts";
import type { CocosNamespace } from "../../../index.ts";

export default class Component extends CCObject {
  node!: BaseNode;
  private _loaded = false;

  constructor() {
    super();
  }

  _instantiate(node: BaseNode): Component {
    const Constructor = this.constructor as new () => Component;
    const clone = new Constructor();
    const source = this as unknown as Record<string, unknown>;
    const target = clone as unknown as Record<string, unknown>;
    for (const key of Object.keys(source)) {
      if (key !== "node" && key !== "_loaded") target[key] = source[key];
    }
    clone.node = node;
    return clone;
  }

  onLoad(): void {}
  onEnable(): void {}
  onDisable(): void {}
  onDestroy(): void {}
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

  protected override _onPreDestroy(): void {
    this._deactivate();
    if (this._loaded) this.onDestroy();
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
