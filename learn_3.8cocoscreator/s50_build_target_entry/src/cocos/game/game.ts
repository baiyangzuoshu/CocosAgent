export interface GameConfig {
  overrideSettings?: {
    profiling?: Record<string, unknown>;
    screen?: Record<string, unknown>;
    rendering?: Record<string, unknown>;
  };
  showFPS?: boolean;
  frameRate?: number;
  renderMode?: 0 | 1 | 2 | 3 | 4;
}

export function compatibleWithOldParams(config: GameConfig): NonNullable<GameConfig["overrideSettings"]> {
  const settings = config.overrideSettings ?? (config.overrideSettings = {});
  if ("showFPS" in config) {
    settings.profiling ??= {};
    settings.profiling.showFPS = config.showFPS;
  }
  if ("frameRate" in config) {
    settings.screen ??= {};
    settings.screen.frameRate = config.frameRate;
  }
  if ("renderMode" in config) {
    settings.rendering ??= {};
    settings.rendering.renderMode = config.renderMode;
  }
  return settings;
}
