import type { CocosNamespace } from "../../../index.ts";

interface CocosWindow extends Window {
  cc?: CocosNamespace;
}

const _global = window as CocosWindow;
const cc = _global.cc;

if (!cc) {
  throw new Error("cc must be initialized before CCMacro");
}

// Reduced from cocos2d/core/platform/CCMacro.js to constants used by the course.
cc.macro = {
  RAD: Math.PI / 180,
  DEG: 180 / Math.PI,
};
