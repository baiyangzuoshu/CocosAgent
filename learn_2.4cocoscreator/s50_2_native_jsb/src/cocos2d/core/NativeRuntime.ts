export interface NativeMacros {
  CC_JSB: boolean;
  CC_NATIVERENDERER: boolean;
  CC_RUNTIME: boolean;
}

export interface NativeHost {
  setPreferredFramesPerSecond?: (fps: number) => void;
  requestAnimationFrame?: (callback: (time: number) => void) => number;
  canvas?: unknown;
  gfx?: unknown;
}

export interface NativeRuntimeRoute {
  frameScheduler: "jsb-host" | "browser-rAF";
  preferredFrameRateCall: "jsb.setPreferredFramesPerSecond" | "not-used";
  rendererContainer: "host-canvas" | "dom-canvas";
  graphicsDevice: "window.gfx" | "javascript-gfx";
}

/** Captures CCGame and renderer/gfx branch conditions without calling a native host. */
export function resolveNativeRuntime(
  macros: NativeMacros,
  host: NativeHost,
): NativeRuntimeRoute {
  const nativeOrRuntime = macros.CC_JSB || macros.CC_RUNTIME;
  const nativeRenderer = macros.CC_JSB && macros.CC_NATIVERENDERER;
  return {
    frameScheduler: nativeOrRuntime && host.requestAnimationFrame ? "jsb-host" : "browser-rAF",
    preferredFrameRateCall: nativeOrRuntime && host.setPreferredFramesPerSecond
      ? "jsb.setPreferredFramesPerSecond"
      : "not-used",
    rendererContainer: nativeOrRuntime && host.canvas ? "host-canvas" : "dom-canvas",
    graphicsDevice: nativeRenderer && host.gfx ? "window.gfx" : "javascript-gfx",
  };
}
