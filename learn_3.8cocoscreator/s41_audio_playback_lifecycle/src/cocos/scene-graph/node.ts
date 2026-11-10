type Listener = (event: unknown) => void;

export default class Node {
  private readonly listeners = new Map<string, Listener[]>();

  on(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}
