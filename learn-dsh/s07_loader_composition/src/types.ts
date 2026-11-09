export type Config = Record<string, unknown>;
export type Disposer = () => void | Promise<void>;

export interface ConfigEntry {
  readonly id: string;
  readonly name: string;
  readonly disabled: boolean;
  readonly config: Config;
}

export interface PluginDefinition {
  start(config: Config): Disposer | Promise<Disposer>;
}

export type PluginRegistry = ReadonlyMap<string, PluginDefinition>;
