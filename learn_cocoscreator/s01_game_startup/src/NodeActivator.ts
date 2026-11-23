// 对照 2.4.15 node-activator.js 的非编辑器路径。队列与组件调度器由外部提供。
export const Deactivating = 1 << 8;
export const IsPreloadStarted = 1 << 13;
export const IsOnLoadCalled = 1 << 14;
export const IsOnLoadStarted = 1 << 15;

export interface ActivationComponent {
  node: ActivationNode;
  _objFlags: number;
  _enabled: boolean;
  __preload?(): void;
  onLoad?(): void;
  onEnable?(): void;
  onDisable?(): void;
  start?(): void;
  update?(dt: number): void;
  lateUpdate?(dt: number): void;
  onDestroy?(): void;
}

export interface ActivationNode {
  name: string;
  _objFlags: number;
  _active: boolean;
  _activeInHierarchy: boolean;
  _components: ActivationComponent[];
  _children: ActivationNode[];
  _childArrivalOrder: number;
  _localZOrder: number;
  _opacity: number;
  _onPostActivated(active: boolean): void;
  emit(type: string, node: ActivationNode): void;
}

export interface Invoker {
  add(comp: ActivationComponent): void;
  invoke(): void;
  cancelInactive(flagToClear?: number): void;
}

export interface ActivationTask {
  preload: Invoker;
  onLoad: Invoker;
  onEnable: Invoker;
}

export interface ActivatorDependencies {
  acquireTask(): ActivationTask;
  releaseTask(task: ActivationTask): void;
  isValid(comp: ActivationComponent): boolean;
  enableComp(comp: ActivationComponent, invoker?: Invoker): void;
  disableComp(comp: ActivationComponent): void;
  reportReactivation(node: ActivationNode): void;
}

export class NodeActivator {
  private _activatingStack: ActivationTask[] = [];

  constructor(private deps: ActivatorDependencies) {}

  reset(): void {
    this._activatingStack = [];
  }

  activateNode(node: ActivationNode, active: boolean): void {
    if (active) {
      const task = this.deps.acquireTask();
      this._activatingStack.push(task);
      // 10. 从当前节点开始递归，并为组件准备生命周期调用队列。
      // 先递归收集组件，再按阶段调用，避免逐节点交错执行各生命周期。
      this._activateNodeRecursively(node, task);
      task.preload.invoke();
      task.onLoad.invoke();
      task.onEnable.invoke();
      this._activatingStack.pop();
      this.deps.releaseTask(task);
    } else {
      this._deactivateNodeRecursively(node);
      // 激活过程中发生停用时，通知尚在栈中的任务取消未执行的失活组件。
      for (const task of this._activatingStack) {
        task.preload.cancelInactive(IsPreloadStarted);
        task.onLoad.cancelInactive(IsOnLoadStarted);
        task.onEnable.cancelInactive();
      }
    }
    node.emit("active-in-hierarchy-changed", node);
  }

  private _activateNodeRecursively(
    node: ActivationNode,
    task: ActivationTask,
  ): void {
    if (node._objFlags & Deactivating) {
      // 同一节点正在停用时拒绝直接重入激活，防止反复切换。
      this.deps.reportReactivation(node);
      return;
    }
    node._activeInHierarchy = true;
    // 11. 处理当前节点组件，再递归自身处于启用状态的子节点。
    // 固定当前组件数，避免处理过程中新增组件导致重复激活。
    const originCount = node._components.length;
    for (let i = 0; i < originCount; i++) {
      this.activateComp(
        node._components[i],
        task.preload,
        task.onLoad,
        task.onEnable,
      );
    }
    node._childArrivalOrder = node._children.length;
    for (let i = 0, len = node._children.length; i < len; i++) {
      const child = node._children[i];
      child._localZOrder = (child._localZOrder & 0xffff0000) | (i + 1);
      // 父节点已处于激活流程时，仅继续激活自身 _active 为真的子节点。
      if (child._active) this._activateNodeRecursively(child, task);
    }
    node._onPostActivated(true);
  }

  private _deactivateNodeRecursively(node: ActivationNode): void {
    node._objFlags |= Deactivating;
    node._activeInHierarchy = false;
    const originCount = node._components.length;
    for (let i = 0; i < originCount; i++) {
      const comp = node._components[i];
      if (comp._enabled) {
        this.deps.disableComp(comp);
        // 停用回调可能从根部重新激活节点，此时停止本次递归。
        if (node._activeInHierarchy) {
          node._objFlags &= ~Deactivating;
          return;
        }
      }
    }
    for (let i = 0, len = node._children.length; i < len; i++) {
      const child = node._children[i];
      if (child._activeInHierarchy) {
        this._deactivateNodeRecursively(child);
        if (node._activeInHierarchy) {
          node._objFlags &= ~Deactivating;
          return;
        }
      }
    }
    node._onPostActivated(false);
    node._objFlags &= ~Deactivating;
  }

  activateComp(
    comp: ActivationComponent,
    preload?: Invoker,
    onLoad?: Invoker,
    onEnable?: Invoker,
  ): void {
    // 12. 处理组件的预加载、onLoad 与启用调度。
    if (!this.deps.isValid(comp)) return;
    // 标记防止重复安排预加载和 onLoad；未执行的任务被取消时可能清除标记。
    if (!(comp._objFlags & IsPreloadStarted)) {
      comp._objFlags |= IsPreloadStarted;
      if (comp.__preload) {
        if (preload) preload.add(comp);
        else comp.__preload();
      }
    }
    if (!(comp._objFlags & IsOnLoadStarted)) {
      comp._objFlags |= IsOnLoadStarted;
      if (comp.onLoad) {
        if (onLoad) onLoad.add(comp);
        else {
          comp.onLoad();
          comp._objFlags |= IsOnLoadCalled;
        }
      } else comp._objFlags |= IsOnLoadCalled;
    }
    // 仅启用且节点仍处于层级激活状态的组件进入调度流程。
    if (comp._enabled && comp.node._activeInHierarchy) {
      this.deps.enableComp(comp, onEnable);
    }
  }

  destroyComp(comp: ActivationComponent): void {
    this.deps.disableComp(comp);
    if (comp.onDestroy && (comp._objFlags & IsOnLoadCalled)) comp.onDestroy();
  }
}
