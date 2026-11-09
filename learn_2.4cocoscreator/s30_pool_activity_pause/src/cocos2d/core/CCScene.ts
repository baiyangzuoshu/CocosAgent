import Node from "./CCNode.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Scene extends Node {
  _activate(active = true): void {
    const director = host.cc?.director;
    if (!director) {
      throw new Error("cc.director must be initialized before scene activation");
    }
    director._nodeActivator.activateNode(this, active);
  }
}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCScene");
}

host.cc.Scene = Scene;
