export type Disposer = () => void | Promise<void>;

export interface MessageSource {
  subscribe(listener: (message: string) => void): Disposer;
  publish(message: string): void;
}

export interface Context {
  readonly messages: MessageSource;
  effect(setup: () => void | Disposer): Disposer;
  disposeEffects(): Promise<void>;
  log(source: string, message: string): void;
}

export interface Plugin {
  readonly name: string;
  apply(ctx: Context): void | Promise<void>;
}
