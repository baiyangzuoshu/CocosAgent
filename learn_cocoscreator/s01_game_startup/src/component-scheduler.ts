import {
  type ActivationComponent,
  type ActivationTask,
  type ActivatorDependencies,
  type Invoker,
  IsOnLoadCalled,
} from "./NodeActivator.ts";

const IsOnEnableCalled = 1 << 11;
const IsStartCalled = 1 << 16;

type Component = ActivationComponent;

// 保留阶段队列与停用时取消待处理项；排序和引擎的池实现留作边界。
class OneOffInvoker implements Invoker {
  private components: Component[] = [];
  private index = -1;
  constructor(private callback: (component: Component) => void) {}
  add(component: Component): void {
    this.components.push(component);
  }
  remove(component: Component): void {
    const i = this.components.indexOf(component);
    if (i >= 0) {
      this.components.splice(i, 1);
      if (i <= this.index) this.index--;
    }
  }
  invoke(): void {
    for (this.index = 0; this.index < this.components.length; this.index++) {
      this.callback(this.components[this.index]);
    }
    this.components.length = 0;
    this.index = -1;
  }
  cancelInactive(flagToClear = 0): void {
    // 只检查尚未调用的队列项；需要时清除标记，允许以后重新调度。
    let next = this.index + 1;
    while (next < this.components.length) {
      const comp = this.components[next];
      if (comp._enabled && comp.node._activeInHierarchy) next++;
      else {
        this.components.splice(next, 1);
        comp._objFlags &= ~flagToClear;
      }
    }
  }
}

class ReusableInvoker {
  private components: Component[] = [];
  constructor(private callback: (component: Component, dt: number) => void) {}
  add(component: Component): void {
    if (!this.components.includes(component)) this.components.push(component);
  }
  remove(component: Component): void {
    const i = this.components.indexOf(component);
    if (i >= 0) this.components.splice(i, 1);
  }
  invoke(dt: number): void {
    // 快照简化遍历中增删；不等同于原版 MutableForwardIterator。
    for (const component of [...this.components]) {
      if (this.components.includes(component)) this.callback(component, dt);
    }
  }
}

export class ComponentScheduler {
  private startInvoker = new OneOffInvoker((comp) => {
    comp.start?.();
    comp._objFlags |= IsStartCalled;
  });
  // 20. updateInvoker 遍历组件队列时，通过此回调执行组件的 update(dt)。
  readonly updateInvoker = new ReusableInvoker((comp, dt) => comp.update?.(dt));
  private lateUpdateInvoker = new ReusableInvoker((comp, dt) =>
    comp.lateUpdate?.(dt)
  );
  private _updating = false;
  private _deferredComps: Component[] = [];

  // 真实引擎使用激活任务池；这里创建任务但保留 preload/onLoad/onEnable 的顺序。
  createActivatorDependencies(): ActivatorDependencies {
    return {
      acquireTask: (): ActivationTask => ({
        preload: new OneOffInvoker((comp) => comp.__preload?.()),
        onLoad: new OneOffInvoker((comp) => {
          comp.onLoad?.();
          comp._objFlags |= IsOnLoadCalled;
        }),
        onEnable: new OneOffInvoker((comp) => {
          if (comp._enabled) {
            comp.onEnable?.();
            // onEnable 可能导致节点停用，只有仍激活时才继续注册。
            if (comp.node._activeInHierarchy) this._onEnabled(comp);
          }
        }),
      }),
      releaseTask() {},
      isValid: () => true, // 原版还检查组件是否已销毁。
      enableComp: (comp, invoker) => this.enableComp(comp, invoker),
      disableComp: (comp) => this.disableComp(comp),
      reportReactivation(node) {
        console.error(`节点正在停用：${node.name}`);
      },
    };
  }

  enableComp(comp: Component, invoker?: Invoker): void {
    if (comp._objFlags & IsOnEnableCalled) return;
    if (comp.onEnable) {
      if (invoker) {
        invoker.add(comp);
        return;
      }
      comp.onEnable();
      if (!comp.node._activeInHierarchy) return;
    }
    this._onEnabled(comp);
  }

  private _onEnabled(comp: Component): void {
    // 13. 组件完成启用后，进入调度注册流程。
    // Scheduler.resumeTarget 在此保留为外部职责。
    comp._objFlags |= IsOnEnableCalled;
    // 帧更新中启用的组件先进入延迟队列，避免直接改变当前调度阶段。
    if (this._updating) this._deferredComps.push(comp);
    else this._scheduleImmediate(comp);
  }

  disableComp(comp: Component): void {
    if (!(comp._objFlags & IsOnEnableCalled)) return;
    comp.onDisable?.();
    comp._objFlags &= ~IsOnEnableCalled;
    this._deferredComps = this._deferredComps.filter((item) => item !== comp);
    if (comp.start && !(comp._objFlags & IsStartCalled)) {
      this.startInvoker.remove(comp);
    }
    this.updateInvoker.remove(comp);
    this.lateUpdateInvoker.remove(comp);
    // Scheduler.pauseTarget 尚未实现。
  }

  private _scheduleImmediate(comp: Component): void {
    if (comp.start && !(comp._objFlags & IsStartCalled)) {
      this.startInvoker.add(comp);
    }
    // 14. 把带 update 的组件加入可重复调用队列，供后续每帧使用。
    if (comp.update) this.updateInvoker.add(comp);
    if (comp.lateUpdate) this.lateUpdateInvoker.add(comp);
  }
  private _startForNewComps(): void {
    const pending = this._deferredComps;
    this._deferredComps = [];
    for (const comp of pending) this._scheduleImmediate(comp);
    if (pending.length) this.startInvoker.invoke();
  }
  startPhase(): void {
    this._updating = true;
    this.startInvoker.invoke();
    this._startForNewComps();
  }
  updatePhase(dt: number): void {
    // 18. Director 将 dt 交给 update 阶段。
    // 19. 调用 updateInvoker，遍历组件队列而不是场景树。
    this.updateInvoker.invoke(dt);
  }
  lateUpdatePhase(dt: number): void {
    this.lateUpdateInvoker.invoke(dt);
    this._updating = false;
    this._startForNewComps();
  }
}
