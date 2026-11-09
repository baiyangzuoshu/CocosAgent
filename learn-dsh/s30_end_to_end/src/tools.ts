import type { ToolSchema } from "./types.ts";

export interface ToolResult {
  readonly content: string;
  readonly isError: boolean;
}

export interface ToolDefinition extends ToolSchema {
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

/** Registry shared by model-schema projection and controlled execution. */
export class ToolRegistry {
  readonly #definitions = new Map<string, ToolDefinition>();

  register(definition: ToolDefinition): () => void {
    if (this.#definitions.has(definition.name)) {
      throw new Error(`Duplicate tool: ${definition.name}`);
    }
    this.#definitions.set(definition.name, definition);
    return () => {
      if (this.#definitions.get(definition.name) === definition) {
        this.#definitions.delete(definition.name);
      }
    };
  }

  schemas(): ToolSchema[] {
    return [...this.#definitions.values()].map((
      { name, description, parameters },
    ) => ({
      name,
      description,
      parameters,
    }));
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const definition = this.#definitions.get(name);
    if (!definition) throw new Error(`Unknown tool: ${name}`);
    return await definition.execute(args);
  }
}
