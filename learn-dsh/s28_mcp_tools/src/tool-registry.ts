import type {
  HarnessToolDefinition,
  HarnessToolResult,
  JsonRecord,
  ModelToolSchema,
} from "./types.ts";

/** Small model-facing registry, reduced to the operations needed in this lesson. */
export class ToolRegistry {
  readonly #tools = new Map<string, HarnessToolDefinition>();

  register(definition: HarnessToolDefinition): () => void {
    if (this.#tools.has(definition.name)) {
      throw new Error(`Tool already registered: ${definition.name}`);
    }
    this.#tools.set(definition.name, definition);

    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      if (this.#tools.get(definition.name) === definition) {
        this.#tools.delete(definition.name);
      }
    };
  }

  schemas(): ModelToolSchema[] {
    return [...this.#tools.values()].map((
      { name, description, parameters },
    ) => ({
      name,
      description,
      parameters,
    }));
  }

  async execute(name: string, args: JsonRecord): Promise<HarnessToolResult> {
    const definition = this.#tools.get(name);
    if (!definition) throw new Error(`Unknown Harness tool: ${name}`);
    return await definition.execute(args);
  }

  get size(): number {
    return this.#tools.size;
  }
}
