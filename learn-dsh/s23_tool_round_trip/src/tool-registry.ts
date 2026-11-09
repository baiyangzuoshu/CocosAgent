import type { TextBlock, ToolCallBlock, ToolResultMessage } from "./types.ts";

export interface ToolDefinition {
  readonly name: string;
  execute(args: Record<string, unknown>): Promise<readonly TextBlock[]>;
}

/** Only the execution seam needed by this turn-round-trip lesson. */
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

  async execute(call: ToolCallBlock): Promise<ToolResultMessage> {
    const tool = this.#definitions.get(call.name);
    if (tool === undefined) {
      return errorResult(call.id, `unknown tool: ${call.name}`);
    }

    try {
      const args = JSON.parse(call.arguments) as Record<string, unknown>;
      const content = await tool.execute(args);
      return { role: "tool", toolCallId: call.id, content, isError: false };
    } catch (error: unknown) {
      return errorResult(
        call.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

function errorResult(callId: string, message: string): ToolResultMessage {
  return {
    role: "tool",
    toolCallId: callId,
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}
