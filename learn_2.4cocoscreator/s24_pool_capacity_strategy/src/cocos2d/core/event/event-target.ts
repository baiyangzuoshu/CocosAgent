type Listener = (...args: any[]) => void;

interface ListenerInfo {
  callback: Listener;
  target?: unknown;
  once: boolean;
}

export default class EventTarget {
  _listeners = new Map<string, ListenerInfo[]>();

  on(type: string, callback: Listener, target?: unknown, once = false): Listener {
    const listeners = this._listeners.get(type) ?? [];
    listeners.push({ callback, target, once });
    this._listeners.set(type, listeners);
    return callback;
  }

  once(type: string, callback: Listener, target?: unknown): Listener {
    return this.on(type, callback, target, true);
  }

  emit(type: string, ...args: unknown[]): void {
    for (const listener of [...(this._listeners.get(type) ?? [])]) {
      if (listener.once) {
        const remaining = this._listeners.get(type)?.filter((item) => item !== listener) ?? [];
        this._listeners.set(type, remaining);
      }
      listener.callback.apply(listener.target, args);
    }
  }
}

interface CocosWindow extends Window {
  cc?: { EventTarget?: typeof EventTarget };
}

const _global = window as CocosWindow;

if (_global.cc) {
  _global.cc.EventTarget = EventTarget;
}
