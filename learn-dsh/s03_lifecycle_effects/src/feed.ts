import type { Disposer, MessageSource } from './types.ts';

export class MessageFeed implements MessageSource {
  private readonly listeners = new Set<(message: string) => void>();

  subscribe(listener: (message: string) => void): Disposer {
    this.listeners.add(listener);
    let active = true;

    return () => {
      if (!active) return;
      active = false;
      this.listeners.delete(listener);
    };
  }

  publish(message: string): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}
