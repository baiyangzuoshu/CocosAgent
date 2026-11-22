export type RequestedRenderMode = number;
export type RenderBackend = "canvas" | "webgl";

export interface GameConfig {
  debugMode: number;
  exposeClassName: boolean;
  frameRate: number;
  renderMode: RequestedRenderMode;
  registerSystemEvent: boolean;
  showFPS: boolean;
  collisionMatrix: number[];
  groupList: string[];
}

export interface RenderCapabilities {
  canvas: boolean;
  opengl: boolean;
}

/** Mirrors the normalization decisions in CCGame._initConfig (2.4.15). */
export function normalizeGameConfig(input: Partial<GameConfig>): GameConfig {
  const rawMode = input.renderMode;
  const renderMode: RequestedRenderMode = typeof rawMode === "number" && rawMode >= 0 && rawMode <= 2
    ? rawMode
    : 0;

  return {
    debugMode: typeof input.debugMode === "number" ? input.debugMode : 0,
    exposeClassName: Boolean(input.exposeClassName),
    frameRate: typeof input.frameRate === "number" ? input.frameRate : 60,
    renderMode,
    registerSystemEvent: typeof input.registerSystemEvent === "boolean"
      ? input.registerSystemEvent
      : true,
    showFPS: renderMode === 1 ? false : Boolean(input.showFPS),
    collisionMatrix: input.collisionMatrix ?? [],
    groupList: input.groupList ?? [],
  };
}

/** CCGame._determineRenderType resolves the requested mode against capabilities. */
export function determineRenderBackend(
  config: GameConfig,
  capabilities: RenderCapabilities,
): RenderBackend {
  const mode = Number.parseInt(String(config.renderMode), 10) || 0;
  if (mode === 0) {
    if (capabilities.opengl) return "webgl";
    if (capabilities.canvas) return "canvas";
  } else if (mode === 1 && capabilities.canvas) {
    return "canvas";
  } else if (mode === 2 && capabilities.opengl) {
    return "webgl";
  }
  throw new Error(`renderMode ${mode} is unsupported by this environment`);
}
