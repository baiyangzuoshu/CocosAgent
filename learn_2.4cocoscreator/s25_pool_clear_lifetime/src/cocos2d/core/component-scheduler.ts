import type Component from "./components/CCComponent.ts";

export default class ComponentScheduler {
  private _enabled = new Set<Component>();
  private _started = new Set<Component>();
  private _startQueue: Component[] = [];
  private _updateQueue: Component[] = [];
  private _lateUpdateQueue: Component[] = [];

  enableComp(component: Component): void {
    if (this._enabled.has(component)) return;

    this._enabled.add(component);
    component.onEnable();
    if (component.start && !this._started.has(component)) {
      this._startQueue.push(component);
    }
    if (component.update) this._updateQueue.push(component);
    if (component.lateUpdate) this._lateUpdateQueue.push(component);
  }

  disableComp(component: Component): void {
    if (!this._enabled.delete(component)) return;

    component.onDisable();
    this._startQueue = this._startQueue.filter((item) => item !== component);
    this._updateQueue = this._updateQueue.filter((item) => item !== component);
    this._lateUpdateQueue = this._lateUpdateQueue.filter((item) => item !== component);
  }

  startPhase(): void {
    const queue = this._startQueue;
    this._startQueue = [];
    for (const component of queue) {
      if (!this._enabled.has(component) || this._started.has(component)) continue;
      this._started.add(component);
      component.start?.();
    }
  }

  updatePhase(deltaTime: number): void {
    for (const component of [...this._updateQueue]) {
      if (this._enabled.has(component)) component.update?.(deltaTime);
    }
  }

  lateUpdatePhase(deltaTime: number): void {
    for (const component of [...this._lateUpdateQueue]) {
      if (this._enabled.has(component)) component.lateUpdate?.(deltaTime);
    }
  }
}
