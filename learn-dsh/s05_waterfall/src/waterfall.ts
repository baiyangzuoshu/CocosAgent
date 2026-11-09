export type Next = () => Promise<string>;
export type WaterfallListener = (input: string, next: Next) => string | Promise<string>;
export type Fallback = () => string | Promise<string>;

export class Waterfall {
  private readonly listeners: WaterfallListener[] = [];

  on(listener: WaterfallListener): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  async run(input: string, fallback: Fallback): Promise<string> {
    const listeners = [...this.listeners];

    const dispatch = (index: number): Promise<string> => {
      const listener = listeners[index];
      if (!listener) return Promise.resolve(fallback());

      let called = false;
      const next: Next = () => {
        if (called) throw new Error('next() called multiple times');
        called = true;
        return dispatch(index + 1);
      };

      return Promise.resolve(listener(input, next));
    };

    return dispatch(0);
  }
}
