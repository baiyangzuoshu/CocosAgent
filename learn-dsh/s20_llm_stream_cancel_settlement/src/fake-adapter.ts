import type { GenerateOptions, LlmAdapter, StreamChunk } from "./types.ts";

export type FakeBehavior = "success" | "failure" | "cancel";

/** Emits deterministic chunks, then completes, throws, or observes cancellation. */
export class FakeAdapter implements LlmAdapter {
  constructor(private readonly behavior: FakeBehavior) {}

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    yield { type: "block-start", index: 0, blockType: "text" };

    if (this.behavior === "success") {
      yield { type: "text-delta", index: 0, text: `答复：${options.prompt}` };
      yield {
        type: "block-end",
        index: 0,
        block: { type: "text", text: `答复：${options.prompt}` },
      };
      yield { type: "finish", reason: { kind: "stop" } };
      return;
    }

    yield {
      type: "text-delta",
      index: 0,
      text: this.behavior === "cancel"
        ? "已收到请求；当前可见前缀。"
        : "未完成的片段。",
    };

    if (this.behavior === "failure") throw new Error("模拟 Provider 连接中断");

    await new Promise((resolve) => setTimeout(resolve, 40));
    if (options.signal.aborted) throw options.signal.reason;

    yield {
      type: "block-end",
      index: 0,
      block: { type: "text", text: "不应到达此处" },
    };
    yield { type: "finish", reason: { kind: "stop" } };
  }
}
