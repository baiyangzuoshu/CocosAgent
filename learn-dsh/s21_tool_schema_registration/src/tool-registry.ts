import type { ToolDefinition, ToolSchema } from "./types.ts";

/** Stores runtime definitions and exposes only detached, model-safe schemas. */
export class ToolRegistry {
  #definitions = new Map<string, ToolDefinition>();

  register(definition: ToolDefinition): () => void {
    if (this.#definitions.has(definition.name)) {
      throw new Error(`tool already registered: ${definition.name}`);
    }
    this.#definitions.set(definition.name, definition);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (this.#definitions.get(definition.name) === definition) {
        this.#definitions.delete(definition.name);
      }
    };
  }

  definitions(): readonly ToolDefinition[] {
    return [...this.#definitions.values()];
  }

  schemas(): ToolSchema[] {
    return [...this.definitions()]
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
      )
      .map(({ name, description, parameters, deferLoading }) => ({
        name,
        description,
        parameters: structuredClone(parameters),
        ...(deferLoading === true ? { deferLoading: true as const } : {}),
      }));
  }
}
