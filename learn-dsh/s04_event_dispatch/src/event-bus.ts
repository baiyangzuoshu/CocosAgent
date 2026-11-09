export type DispatchMode = 'emit' | 'parallel' | 'serial';
export type ListenerResult = void | null | false | string;
export type Listener = (mode: DispatchMode) => ListenerResult | Promise<ListenerResult>;

export class EventBus {
  private readonly listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(mode: DispatchMode): void {
    for (const listener of this.listeners) {
      void listener(mode);
    }
  }

  async parallel(mode: DispatchMode): Promise<void> {
    await Promise.all([...this.listeners].map((listener) => listener(mode)));
  }

  async serial(mode: DispatchMode): Promise<ListenerResult> {
    for (const listener of this.listeners) {
      const result = await listener(mode);
      if (result !== undefined && result !== null && result !== false) {
        return result;
      }
    }
    return undefined;
  }
}
