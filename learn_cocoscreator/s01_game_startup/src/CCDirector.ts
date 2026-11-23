import { type DirectorEntry, Game } from "./CCGame.ts";
import { type ActivationNode, NodeActivator } from "./NodeActivator.ts";
import { ComponentScheduler } from "./component-scheduler.ts";
import { Scene } from "./CCScene.ts";
import { Renderer } from "./render-flow.ts";

export interface DirectorDependencies {
  now(): number;
  createScheduler(): { update(dt: number): void };
  enableEventManager(): void;
  visitRenderNode(node: ActivationNode): void;
  debug: boolean;
}

// 对照 CCDirector.js 构造器、init 与 sharedInit 的启动职责。
export class Director implements DirectorEntry {
  _scene: Scene | null = null;
  _totalFrames = 0;
  _deltaTime = 0;
  _lastUpdate = 0;
  _startTime = 0;
  _paused = false;
  _purgeDirectorInNextLoop = false;
  _maxParticleDeltaTime = 0;
  _winSizeInPoints: { width: number; height: number } | null = null;
  _scheduler!: { update(dt: number): void };
  _compScheduler!: ComponentScheduler;
  _nodeActivator: NodeActivator | null = null;
  private renderer: Renderer;

  constructor(private game: Game, private deps: DirectorDependencies) {
    this.renderer = new Renderer(deps.visitRenderNode);
    game.on(game.EVENT_SHOW, () => {
      this._lastUpdate = this.deps.now();
    });
    // Game 发出引擎初始化事件时，才创建 Director 的调度器等对象。
    game.once(game.EVENT_ENGINE_INITED, this.init, this);
  }

  init(): boolean {
    // 4. 收到引擎初始化事件后，初始化 Director 及其调度器。
    this._totalFrames = 0;
    this._lastUpdate = this.deps.now();
    this._startTime = this._lastUpdate;
    this._paused = false;
    this._purgeDirectorInNextLoop = false;
    this._winSizeInPoints = { width: 0, height: 0 };
    this._scheduler = this.deps.createScheduler();
    this.sharedInit();
    return true;
  }

  private sharedInit(): void {
    this._compScheduler = new ComponentScheduler();
    // 节点激活器通过组件调度器提供的接口启用和停用组件。
    this._nodeActivator = new NodeActivator(
      this._compScheduler.createActivatorDependencies(),
    );
    this.deps.enableEventManager();
    // 原版还会按模块可用性注册 Action、动画、碰撞、物理和 Widget。
  }

  mainLoop(now: number): void {
    if (this._purgeDirectorInNextLoop) {
      this._purgeDirectorInNextLoop = false;
      this.purgeDirector();
      return;
    }
    // 16. 计算 dt，然后进入组件更新、其他调度和渲染阶段。
    // 事件、销毁及设备提交保留调用位置但不实现。
    this.calculateDeltaTime(now);
    if (!this._paused) {
      this.emitFrameEvent("before-update");
      // 17. 先执行 start 阶段，再让已注册组件执行 update。
      this._compScheduler.startPhase();
      this._compScheduler.updatePhase(this._deltaTime);
      this._scheduler.update(this._deltaTime);
      this._compScheduler.lateUpdatePhase(this._deltaTime);
      this.emitFrameEvent("after-update");
      this.deferredDestroy();
    }
    // 21. 更新完成后进入渲染；Director 暂停时正常路径仍会渲染。
    this.emitFrameEvent("before-draw");
    this.renderer.render(this._scene, this._deltaTime);
    this.emitFrameEvent("after-draw");
    this.frameUpdateListeners();
    this._totalFrames++;
  }

  runSceneImmediate(
    scene: Scene,
    onBeforeLoadScene?: () => void,
    onLaunched?: (error: null, scene: Scene) => void,
  ): void {
    // 8. 场景加载完成后，进入场景切换与激活流程。
    scene._load();
    this.attachPersistNodes(scene);
    this.releaseOldScene(this._scene, scene);
    this.destroyOldScene(this._scene);
    this._scene = null;
    this.deferredDestroy();
    onBeforeLoadScene?.();
    this.emitFrameEvent("before-scene-launch");
    // 设置当前场景后激活节点树，组件随后进入调度器。
    this._scene = scene;
    scene._activate(this._nodeActivator!);
    this.game.resume();
    onLaunched?.(null, scene);
    this.emitFrameEvent("after-scene-launch");
  }

  _resetDeltaTime(): void {
    this._lastUpdate = this.deps.now();
    this._deltaTime = 0;
  }

  // 以下方法保留原流程中的调用位置，具体子系统尚未实现。
  private emitFrameEvent(_name: string): void {}
  private deferredDestroy(): void {}
  private frameUpdateListeners(): void {}
  private purgeDirector(): void {}
  private attachPersistNodes(_scene: Scene): void {}
  private releaseOldScene(_oldScene: Scene | null, _scene: Scene): void {}
  private destroyOldScene(_oldScene: Scene | null): void {}

  calculateDeltaTime(now: number): void {
    if (!now) now = this.deps.now();
    // 帧时间戳以毫秒计；dt 使用秒，时间倒退时归零。
    this._deltaTime = now > this._lastUpdate
      ? (now - this._lastUpdate) / 1000
      : 0;
    // 对照 2.4.15 的 Debug 分支：过长的单帧间隔取 1/60 秒。
    if (this.deps.debug && this._deltaTime > 1) this._deltaTime = 1 / 60;
    this._lastUpdate = now;
  }
}
