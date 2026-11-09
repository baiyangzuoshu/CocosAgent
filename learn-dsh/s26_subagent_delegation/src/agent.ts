import { FakeLLM } from "./fake-llm.ts";
import { SessionLog } from "./session-log.ts";
import type { ModelMessage, UserMessage } from "./types.ts";

export class Agent {
  readonly inbox: UserMessage[] = [];

  constructor(
    readonly id: string,
    readonly session: SessionLog,
    private readonly llm: FakeLLM,
  ) {}

  async run(prompt: string): Promise<string> {
    const taskMessage: UserMessage = {
      role: "user",
      content: [{ type: "text", text: prompt }],
    };
    this.session.append(taskMessage);

    const answer = await this.llm.complete({
      sessionId: this.session.sessionId,
      messages: this.session.snapshot(),
    });
    this.session.append({
      role: "assistant",
      content: [{ type: "text", text: answer }],
    });
    return answer;
  }

  /** Deliver queued parent notices into this Agent's next model history. */
  receivePending(): UserMessage[] {
    const pending = this.inbox.splice(0);
    for (const message of pending) this.session.append(message);
    return structuredClone(pending);
  }
}

/** Mirrors ctx.agents.create(): a new identity creates a new Session. */
export class AgentFactory {
  constructor(private readonly llm: FakeLLM) {}

  create(sessionId: string, seed: readonly ModelMessage[] = []): Agent {
    return new Agent(sessionId, new SessionLog(sessionId, seed), this.llm);
  }
}
