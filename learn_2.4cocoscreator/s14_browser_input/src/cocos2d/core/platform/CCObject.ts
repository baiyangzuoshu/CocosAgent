import type { CocosNamespace } from "../../../index.ts";

export default class CCObject {}

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const host = window as CocosWindow;

if (!host.cc) {
  throw new Error("cc must be initialized before CCObject");
}

host.cc.Object = CCObject;
