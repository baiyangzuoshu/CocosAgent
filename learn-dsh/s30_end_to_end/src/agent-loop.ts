import { FakeLlm } from "./fake-llm.ts";
import { deriveHistory, SessionLog } from "./session.ts";
import { ToolRegistry, type ToolResult } from "./tools.ts";

/** One short model → tool → model turn, recorded in the Session log. */
export class AgentLoop {
  constructor(
    private readonly llm: FakeLlm,
    private readonly tools: ToolRegistry,
    private readonly session: SessionLog,
  ) {}

  async run(input: string, maxSteps = 3): Promise<void> {
    this.session.append({ type: "user/message", data: { text: input } });
    this.session.append({ type: "turn/start", data: { turn: 1 } });

    for (let step = 1; step <= maxSteps; step += 1) {
      const reply = await this.llm.generate(
        deriveHistory(this.session.snapshot()),
        this.tools.schemas(),
      );
      if (reply.kind === "text") {
        this.session.append({
          type: "assistant/message",
          data: { text: reply.content },
        });
        this.session.append({
          type: "turn/end",
          data: { reason: "completed" },
        });
        return;
      }

      this.session.append({
        type: "assistant/tool-call",
        data: {
          callId: reply.callId,
          name: reply.name,
          arguments: reply.arguments,
        },
      });
      this.session.append({
        type: "tool/call",
        data: {
          callId: reply.callId,
          name: reply.name,
          arguments: reply.arguments,
        },
      });

      let result: ToolResult;
      try {
        result = await this.tools.execute(reply.name, reply.arguments);
      } catch (error) {
        result = {
          content: error instanceof Error ? error.message : String(error),
          isError: true,
        };
      }
      this.session.append({
        type: "tool/result",
        data: { callId: reply.callId, name: reply.name, ...result },
      });
    }

    this.session.append({ type: "turn/end", data: { reason: "max-steps" } });
  }
}
