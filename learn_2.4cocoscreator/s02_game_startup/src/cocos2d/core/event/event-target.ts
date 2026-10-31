type Listener = () => void;

export default class EventTarget {
  _listeners = new Map<string, Listener[]>();

  on(type: string, callback: Listener): Listener {
    const listeners = this._listeners.get(type) ?? [];
    listeners.push(callback);
    this._listeners.set(type, listeners);
    return callback;
  }

  emit(type: string): void {
    for (const callback of [...(this._listeners.get(type) ?? [])]) {
      callback();
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
