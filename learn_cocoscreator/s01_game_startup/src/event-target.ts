// 启动链所需的事件子集；完整实现见引擎 event/event-target.js。
type Callback = (this: unknown) => void;
type Listener = { callback: Callback; target: unknown; once: boolean };

export class EventTarget {
  private listeners = new Map<string, Listener[]>();

  on(type: string, callback: Callback, target?: unknown, once = false): void {
    const list = this.listeners.get(type) ?? [];
    // 原 EventTarget 对相同 type、callback、target 去重。
    if (
      !list.some((item) => item.callback === callback && item.target === target)
    ) {
      list.push({ callback, target, once });
      this.listeners.set(type, list);
    }
  }

  once(type: string, callback: Callback, target?: unknown): void {
    this.on(type, callback, target, true);
  }

  emit(type: string): void {
    // 本课只需要无参数事件；不实现引擎的事件传播与监听器修改语义。
    for (const item of [...(this.listeners.get(type) ?? [])]) {
      if (item.once) {
        const list = this.listeners.get(type) ?? [];
        this.listeners.set(type, list.filter((listener) => listener !== item));
      }
      item.callback.call(item.target);
    }
  }
}
