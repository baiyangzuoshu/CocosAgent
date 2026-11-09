import type { ModelMessage, ModelReply, ToolSchema } from "./types.ts";

/** Deterministic model: call one tool, then answer from its result. */
export class FakeLlm {
  readonly requests: Array<{
    readonly messages: readonly ModelMessage[];
    readonly tools: readonly ToolSchema[];
  }> = [];

  async generate(
    messages: readonly ModelMessage[],
    tools: readonly ToolSchema[],
  ): Promise<ModelReply> {
    this.requests.push({
      messages: structuredClone(messages),
      tools: structuredClone(tools),
    });
    const result = [...messages].reverse().find((message) =>
      message.role === "tool"
    );
    if (result?.role === "tool") {
      return {
        kind: "text",
        content:
          `根据搜索结果 ${result.content}，cache 相关实现记录在 cache-design.md。`,
      };
    }

    if (!tools.some(({ name }) => name === "search_notes")) {
      throw new Error("FakeLlm did not receive the search_notes schema.");
    }
    return {
      kind: "tool-call",
      callId: "call-30-1",
      name: "search_notes",
      arguments: { query: "cache" },
    };
  }
}
