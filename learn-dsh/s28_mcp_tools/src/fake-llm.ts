import type { ModelMessage, ModelReply, ModelToolSchema } from "./types.ts";

export class FakeLlm {
  readonly requests: Array<{
    readonly messages: readonly ModelMessage[];
    readonly tools: readonly ModelToolSchema[];
  }> = [];

  async generate(
    messages: readonly ModelMessage[],
    tools: readonly ModelToolSchema[],
  ): Promise<ModelReply> {
    this.requests.push({
      messages: structuredClone(messages),
      tools: structuredClone(tools),
    });
    const toolResult = [...messages].reverse().find((message) =>
      message.role === "tool"
    );
    if (toolResult?.role === "tool") {
      return {
        kind: "final",
        content: `MCP 搜索结果：${toolResult.content}`,
      };
    }

    const search = tools.find((tool) =>
      tool.name === "mcp__local_notes__search_notes"
    );
    if (!search) {
      throw new Error(
        "The MCP bridge did not expose search_notes to the model.",
      );
    }
    return {
      kind: "tool-call",
      id: "call-1",
      name: search.name,
      arguments: { query: "cache" },
    };
  }
}
