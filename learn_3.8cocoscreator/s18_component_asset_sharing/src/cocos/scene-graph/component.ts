import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";
import type { Node } from "./node.ts";

export class Component extends CCObject {
  node!: Node;
  private _loaded = false;

  constructor() {
    super();
  }

  _instantiate(node: Node): Component {
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
  start?(): void;
  update?(deltaTime: number): void;
  lateUpdate?(deltaTime: number): void;

  _activate(): void {
    if (!this._loaded) {
      this._loaded = true;
      this.onLoad();
    }
    (cclegacy.director as DirectorWithComponentScheduler)._compScheduler.enableComp(this);
  }

  _deactivate(): void {
    (cclegacy.director as DirectorWithComponentScheduler)._compScheduler.disableComp(this);
  }
}

interface DirectorWithComponentScheduler {
  _compScheduler: {
    enableComp(component: Component): void;
    disableComp(component: Component): void;
  };
}

cclegacy.Component = Component;
