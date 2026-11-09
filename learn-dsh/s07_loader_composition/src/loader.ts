import type { Config, ConfigEntry, Disposer, PluginDefinition, PluginRegistry } from './types.ts';

interface MountedPlugin {
  readonly name: string;
  readonly signature: string;
  readonly dispose: Disposer;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntries(raw: unknown): ConfigEntry[] {
  if (!Array.isArray(raw)) throw new Error('plugin config must be an array');

  const entries: ConfigEntry[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const value: unknown = raw[index];
    if (!isRecord(value)) throw new Error(`plugin entry ${index} must be an object`);
    if (typeof value.id !== 'string' || value.id.length === 0) {
      throw new Error(`plugin entry ${index} requires a non-empty id`);
    }
    if (typeof value.name !== 'string' || value.name.length === 0) {
      throw new Error(`plugin entry ${index} requires a non-empty name`);
    }
    if (ids.has(value.id)) throw new Error(`duplicate plugin id: ${value.id}`);
    ids.add(value.id);

    if (value.disabled !== undefined && typeof value.disabled !== 'boolean') {
      throw new Error(`plugin ${value.id} disabled must be boolean`);
    }
    const configValue = value.config === undefined ? {} : value.config;
    if (!isRecord(configValue)) throw new Error(`plugin ${value.id} config must be an object`);

    entries.push({
      id: value.id,
      name: value.name,
      disabled: value.disabled === true,
      config: configValue as Config,
    });
  }
  return entries;
}

export class Loader {
  private readonly mounted = new Map<string, MountedPlugin>();

  constructor(private readonly registry: PluginRegistry) {}

  async applyConfig(raw: unknown): Promise<void> {
    const entries = parseEntries(raw);
    const enabled = entries.filter((entry) => !entry.disabled);
    const desired = new Map(enabled.map((entry) => [entry.id, entry]));

    for (const [id, current] of this.mounted) {
      const next = desired.get(id);
      if (!next || this.signature(next) !== current.signature) {
        await this.unmount(id, current);
        this.mounted.delete(id);
      }
    }

    for (const entry of entries) {
      if (entry.disabled) {
        console.log(`[loader] skip id=${entry.id} (disabled)`);
        continue;
      }

      const current = this.mounted.get(entry.id);
      if (current) {
        console.log(`[loader] keep id=${entry.id}`);
        continue;
      }

      const definition = this.registry.get(entry.name);
      if (!definition) throw new Error(`unknown plugin: ${entry.name}`);
      const mounted = await this.mount(entry, definition);
      this.mounted.set(entry.id, mounted);
    }
  }

  async disposeAll(): Promise<void> {
    for (const [id, plugin] of [...this.mounted].reverse()) {
      await this.unmount(id, plugin);
      this.mounted.delete(id);
    }
  }

  private signature(entry: ConfigEntry): string {
    return JSON.stringify([entry.name, entry.config]);
  }

  private async mount(entry: ConfigEntry, definition: PluginDefinition): Promise<MountedPlugin> {
    console.log(`[loader] mount id=${entry.id} name=${entry.name}`);
    const dispose = await definition.start(entry.config);
    return { name: entry.name, signature: this.signature(entry), dispose };
  }

  private async unmount(id: string, plugin: MountedPlugin): Promise<void> {
    console.log(`[loader] unmount id=${id}`);
    await plugin.dispose();
  }
}
