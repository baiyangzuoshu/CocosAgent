export interface Context {
  log(source: string, message: string): void;
}

export interface Schema<T> {
  parse(input: unknown): T;
}

export interface Plugin<TConfig> {
  readonly name: string;
  readonly Config: Schema<TConfig>;
  apply(ctx: Context, config: TConfig): void | Promise<void>;
}
