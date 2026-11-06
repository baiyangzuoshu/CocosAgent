export interface Context {
  log(source: string, message: string): void;
}

export interface Plugin {
  readonly name: string;
  apply(ctx: Context): void | Promise<void>;
}
