type GameEvent = "engine-inited" | "game-inited";
type GameConfig = { frameRate?: number; showFPS?: boolean; debugMode?: boolean };
type Listener = { callback: () => void; once: boolean };
class EventTarget {
  private readonly listeners = new Map<GameEvent, Listener[]>();
  on(type: GameEvent, callback: () => void, once = false): void {
    const list = this.listeners.get(type) ?? [];
    if (!list.some((listener) => listener.callback === callback)) list.push({ callback, once });
    this.listeners.set(type, list);
  }
  off(type: GameEvent, callback: () => void): void { this.listeners.set(type, (this.listeners.get(type) ?? []).filter((listener) => listener.callback !== callback)); }
  emit(type: GameEvent): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.callback();
      if (listener.once) this.off(type, listener.callback);
    }
  }
}
type StartupPhase = "idle" | "config" | "engine" | "builtins" | "main-loop" | "ready";
export class CCGame extends EventTarget {
  phase: StartupPhase = "idle";
  config: Required<GameConfig> = { frameRate: 60, showFPS: false, debugMode: false };
  private runRequested = false;
  constructor(private readonly write: (message: string) => void, private readonly directorStart: (scene: string) => void) { super(); }
  run(config: GameConfig, onStart?: () => void): void {
    if (this.runRequested) throw new Error("CCGame.run can only prepare the runtime once");
    this.runRequested = true;
    this.phase = "config";
    this.config = { ...this.config, ...config };
    this.write(`CCGame.run: config frameRate=${this.config.frameRate}; showFPS=${this.config.showFPS}; debug=${this.config.debugMode}`);
    if (onStart) this.on("game-inited", onStart, true);
    this.prepare();
  }
  private prepare(): void {
    this.phase = "engine"; this.write("_initEngine: platform, view, renderer and core systems");
    this.emit("engine-inited");
    this.phase = "builtins"; this.write("assetManager.builtins.init(callback)");
    this.phase = "main-loop"; this.write("_runMainLoop: schedule Director frame updates");
    this.phase = "ready"; this.write("emit EVENT_GAME_INITED");
    this.emit("game-inited");
  }
  loadLaunchScene(name: string): void {
    if (this.phase !== "ready") throw new Error("launch scene cannot load before game-inited");
    this.directorStart(name);
  }
}
