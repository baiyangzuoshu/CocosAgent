export interface NativeGlobals {
  window: boolean;
  document: boolean;
  jsb: boolean;
  runtime: boolean;
}

export interface SystemIdentity {
  isNative: boolean;
  isBrowser: boolean;
}

/** Mirrors CCSys.js: isNative comes from CC_JSB; DOM globals alone do not imply Web. */
export function resolveSystemIdentity(
  macros: { CC_JSB: boolean; CC_RUNTIME: boolean },
  globals: NativeGlobals,
): SystemIdentity {
  return {
    isNative: macros.CC_JSB,
    isBrowser: globals.window && globals.document && !macros.CC_JSB && !macros.CC_RUNTIME,
  };
}
