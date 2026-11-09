export type EventHandler = (...args: unknown[]) => void;

export default class EventTarget {
  private _listeners = new Map<string, EventHandler[]>();

  on(event: string, callback: EventHandler): void {
    const listeners = this._listeners.get(event) ?? [];
    listeners.push(callback);
    this._listeners.set(event, listeners);
  }

  emit(event: string, ...args: unknown[]): void {
    for (const callback of this._listeners.get(event) ?? []) {
      callback(...args);
    }
  }
}
