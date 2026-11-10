import { cclegacy } from "../core/global-exports.ts";
import { Node } from "./node.ts";

export class Scene extends Node {
  _activate(active = true): void {
    const director = cclegacy.director as DirectorWithNodeActivator;
    director._nodeActivator.activateNode(this, active);
  }
}

interface DirectorWithNodeActivator {
  _nodeActivator: {
    activateNode(node: Scene, active: boolean): void;
  };
}

cclegacy.Scene = Scene;
