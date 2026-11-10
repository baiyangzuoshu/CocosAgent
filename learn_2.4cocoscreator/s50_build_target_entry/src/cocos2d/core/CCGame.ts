export interface GameConfig {
  frameRate: number;
  renderMode: 0 | 1 | 2;
  showFPS: boolean;
}

export function normalizeGameConfig(input: Partial<GameConfig>): GameConfig {
  const rawMode = input.renderMode;
  const renderMode = typeof rawMode === "number" && rawMode >= 0 && rawMode <= 2
    ? rawMode as GameConfig["renderMode"]
    : 0;
  return {
    frameRate: typeof input.frameRate === "number" ? input.frameRate : 60,
    renderMode,
    showFPS: renderMode === 1 ? false : !!input.showFPS,
  };
}
