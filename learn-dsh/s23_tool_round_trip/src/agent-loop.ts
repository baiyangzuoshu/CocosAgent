import { FakeLlm } from "./fake-llm.ts";
import { SessionLog } from "./session-log.ts";
import { ToolRegistry } from "./tool-registry.ts";
import type { AssistantMessage, ToolCallBlock } from "./types.ts";

/** One turn may span several model/tool steps before the assistant finishes. */
export class AgentLoop {
  constructor(
    private readonly llm: FakeLlm,
    private readonly tools: ToolRegistry,
    private readonly session: SessionLog,
    private readonly maxSteps = 4,
  ) {}

  async run(userText: string): Promise<void> {
    const turn = 1;
    this.session.append({ type: "turn/start", data: { turn } });
    this.session.append({
      type: "user/message",
      data: {
        message: { role: "user", content: [{ type: "text", text: userText }] },
      },
    });

    for (let step = 1; step <= this.maxSteps; step++) {
      this.session.append({ type: "step/start", data: { turn, step } });
      const requestHistory = this.session.deriveMessages();
      const assistant = await this.llm.complete(requestHistory);
      this.session.append({
        type: "assistant/message",
        data: { turn, step, message: assistant },
      });

      const toolCalls = assistant.content.filter(isToolCall);
      if (toolCalls.length === 0) {
        this.session.append({ type: "step/end", data: { turn, step } });
        this.session.append({
          type: "turn/end",
          data: { turn, reason: "completed" },
        });
        return;
      }

      for (const call of toolCalls) {
        const callSeq = this.session.append({
          type: "tool/call",
          data: {
            turn,
            step,
            callId: call.id,
            name: call.name,
            arguments: call.arguments,
          },
        });
        const result = await this.tools.execute(call);
        this.session.append({
          type: "tool/result",
          data: { turn, step, message: result },
        }, [callSeq]);
      }

      this.session.append({ type: "step/end", data: { turn, step } });
      // No turn end yet: the next step derives history including tool/result.
    }

    this.session.append({
      type: "turn/end",
      data: { turn, reason: "max-steps" },
    });
  }
}

function isToolCall(
  block: AssistantMessage["content"][number],
): block is ToolCallBlock {
  return block.type === "tool-call";
}
