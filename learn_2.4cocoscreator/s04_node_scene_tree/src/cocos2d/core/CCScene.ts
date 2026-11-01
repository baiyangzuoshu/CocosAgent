import Node from "./CCNode.ts";
import type { CocosNamespace } from "../../index.ts";

export default class Scene extends Node {}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCScene");
}

host.cc.Scene = Scene;
