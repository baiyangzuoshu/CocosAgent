import { EventTarget } from "./event-target.ts";

export interface GameConfig {
  frameRate?: number;
  showFPS?: boolean;
}

export interface FrameDriver {
  // 本课只接入 30/60 FPS 的 requestAnimFrame；平台适配及 fallback 不在本课内。
  requestAnimFrame(callback: (now: number) => void): number;
  now(): number;
}

export interface GameDependencies {
  frame: FrameDriver;
  initRenderer(): void;
  initEvents(): void;
  initBuiltins(done: () => void): void;
  setDisplayStats(show: boolean): void;
}

export interface DirectorEntry {
  _maxParticleDeltaTime: number;
  mainLoop(now: number): void;
  _resetDeltaTime(): void;
}

// 对照 CCGame.js 的 Web 非预览路径；下划线字段和关键步骤沿用原名。
export class Game extends EventTarget {
  readonly EVENT_ENGINE_INITED = "engine_inited";
  readonly EVENT_GAME_INITED = "game_inited";
  readonly EVENT_SHOW = "game_on_show";
  _prepared = false;
  _paused = true;
  _rendererInitialized = false;
  _intervalId: number | null = null;
  _lastTime = 0;
  _frameTime = 0;
  config!: { frameRate: number; showFPS: boolean };
  onStart: (() => void) | null = null;
  director!: DirectorEntry;

  constructor(private deps: GameDependencies) {
    super();
  }

  override on(
    type: string,
    callback: (this: unknown) => void,
    target?: unknown,
    once = false,
  ): void {
    // 初始化事件已发生时，晚注册的监听直接执行，不再等待下一次事件。
    if (
      (this._prepared && type === this.EVENT_ENGINE_INITED) ||
      (!this._paused && type === this.EVENT_GAME_INITED)
    ) {
      callback.call(target);
    } else {
      super.on(type, callback, target, once);
    }
  }

  override once(
    type: string,
    callback: (this: unknown) => void,
    target?: unknown,
  ): void {
    if (
      (this._prepared && type === this.EVENT_ENGINE_INITED) ||
      (!this._paused && type === this.EVENT_GAME_INITED)
    ) {
      callback.call(target);
    } else {
      super.once(type, callback, target);
    }
  }

  run(config: GameConfig, onStart?: () => void): void {
    // 2. 保存配置与启动回调，进入引擎准备流程。
    // 仅保留本课使用的配置；原版还处理 renderMode 等字段。
    this.config = {
      frameRate: typeof config.frameRate === "number" ? config.frameRate : 60,
      showFPS: !!config.showFPS,
    };
    this.onStart = onStart ?? null;
    this.prepare(this.onStart?.bind(this));
  }

  prepare(cb?: () => void): void {
    if (this._prepared) {
      cb?.();
      return;
    }
    // Web 非预览分支：_loadPreviewScript 直接调用回调。
    this._prepareFinished(cb);
  }

  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    // 音频恢复属于外部职责。
    this.director._resetDeltaTime();
    this._runMainLoop();
  }

  private _initEngine(): void {
    if (this._rendererInitialized) return;
    // 3. 初始化渲染器和系统事件，并通过事件触发 Director 初始化。
    this.deps.initRenderer();
    // 原版由 _initRenderer 设置；本课把渲染器初始化作为边界注入。
    this._rendererInitialized = true;
    this.deps.initEvents();
    this.emit(this.EVENT_ENGINE_INITED);
  }

  private _prepareFinished(cb?: () => void): void {
    this._initEngine();
    this._setAnimFrame();
    this.deps.initBuiltins(() => {
      // 5. 内置资源准备完成，标记引擎已准备。
      this._prepared = true;
      // 6. 注册首次帧回调；此处仅安排回调，还未执行第一帧。
      this._runMainLoop();
      this.emit(this.EVENT_GAME_INITED);
      // 7. 调用 onStart；本示例在回调中同步运行首场景。
      cb?.();
    });
  }

  private _setAnimFrame(): void {
    this._lastTime = this.deps.frame.now();
    this._frameTime = 1000 / this.config.frameRate;
    this.director._maxParticleDeltaTime = this._frameTime / 1000 * 2;
    // 不模拟原版的其他帧率、前缀 API 和 setTimeout 回退。
    if (this.config.frameRate !== 30 && this.config.frameRate !== 60) {
      throw new Error("本课仅提炼 Web 30/60 FPS 路径");
    }
  }

  private _runMainLoop(): void {
    if (!this._prepared) return;
    const director = this.director;
    const frameRate = this.config.frameRate;
    let skip = true;
    this.deps.setDisplayStats(this.config.showFPS);

    const callback = (now: number) => {
      if (!this._paused) {
        // 15. 本示例场景已激活；收到帧回调，先安排下一帧再调用 Director。
        this._intervalId = this.deps.frame.requestAnimFrame(callback);
        // Web 30 FPS 路径交替跳过回调；跳过时也已安排下一帧。
        if (frameRate === 30 && (skip = !skip)) return;
        director.mainLoop(now);
      }
    };
    // 首次注册只安排回调，不会同步执行第一帧。
    this._intervalId = this.deps.frame.requestAnimFrame(callback);
    this._paused = false;
  }
}
