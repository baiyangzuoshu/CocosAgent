import CCObject from "../core/data/object.ts";
import { cclegacy } from "../core/global-exports.ts";
import type { Node } from "./node.ts";

export class Component extends CCObject {
  node!: Node;
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
