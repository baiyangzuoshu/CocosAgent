import type { AssistantMessage, ModelMessage } from "./types.ts";

/** Deterministic two-step model: request a search, then answer from its result. */
export class FakeLlm {
  readonly requests: ModelMessage[][] = [];

  async complete(messages: readonly ModelMessage[]): Promise<AssistantMessage> {
    this.requests.push(structuredClone([...messages]));
    const lastToolResult = [...messages].reverse().find((message) =>
      message.role === "tool"
    );

    if (lastToolResult === undefined) {
      return {
        role: "assistant",
        content: [{
          type: "tool-call",
          id: "call-1",
          name: "search_notes",
          arguments: JSON.stringify({ query: "cache" }),
        }],
      };
    }

    const resultText = lastToolResult.content.map((block) => block.text).join(
      "\n",
    );
    return {
      role: "assistant",
      content: [{ type: "text", text: `找到相关笔记：${resultText}` }],
    };
  }
}
