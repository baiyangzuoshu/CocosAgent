export type TouchName = "touch-start" | "touch-move" | "touch-end" | "touch-cancel" | "click";
export interface TouchPayload { inside: boolean; }
type TouchListener = (event: TouchPayload) => void;

/** 只保留 Button 依赖的 Node 触摸事件订阅。 */
export default class CCNode {
  private readonly _listeners = new Map<TouchName, Set<TouchListener>>();

  on(type: TouchName, listener: TouchListener): void {
    let listeners = this._listeners.get(type);
    if (!listeners) this._listeners.set(type, listeners = new Set());
    listeners.add(listener);
  }

  off(type: TouchName, listener: TouchListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  emit(type: TouchName, event: TouchPayload): void {
    for (const listener of this._listeners.get(type) ?? []) listener(event);
  }
}
