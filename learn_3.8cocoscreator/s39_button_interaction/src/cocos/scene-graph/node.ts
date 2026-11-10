export interface TouchPayload { inside: boolean; }
type Listener = (payload: TouchPayload | unknown) => void;
export const NodeEventType = {
  TOUCH_START: "touch-start", TOUCH_MOVE: "touch-move",
  TOUCH_END: "touch-end", TOUCH_CANCEL: "touch-cancel",
} as const;
export const ButtonEventType = { CLICK: "click" } as const;

/** Only the event subscription used by Button is retained. */
export default class Node {
  private readonly _listeners = new Map<string, Set<Listener>>();
  on(type: string, listener: Listener): void {
    let listeners = this._listeners.get(type);
    if (!listeners) this._listeners.set(type, listeners = new Set());
    listeners.add(listener);
  }
  off(type: string, listener: Listener): void { this._listeners.get(type)?.delete(listener); }
  emit(type: string, payload: TouchPayload | unknown): void {
    for (const listener of this._listeners.get(type) ?? []) listener(payload);
  }
}
