import type { ToolDefinition } from "./types.ts";

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

  get(name: string): ToolDefinition | undefined {
    return this.#definitions.get(name);
  }
}
