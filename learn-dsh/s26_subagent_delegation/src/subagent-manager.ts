import { Agent, AgentFactory } from "./agent.ts";
import type {
  SubagentActivation,
  SubagentResult,
  ToolCallBlock,
  UserMessage,
} from "./types.ts";

/** Starts a fresh child Agent and routes its settled answer to the parent. */
export class SubagentManager {
  #nextChild = 1;

  constructor(
    private readonly factory: AgentFactory,
    private readonly trace: string[],
  ) {}

  start(
    parent: Agent,
    request: { readonly description: string; readonly prompt: string },
  ): SubagentActivation {
    const childNumber = this.#nextChild++;
    const name = `agent-${childNumber}`;
    const childId = `child-session-${childNumber}`;
    const callId = `delegate-${childNumber}`;
    const call: ToolCallBlock = {
      type: "tool-call",
      id: callId,
      name: "subagent",
      arguments: request,
    };

    parent.session.append({ role: "assistant", content: [call] });
    this.trace.push(`parent delegates ${name}`);

    // Spawn starts a blank child Session; only the task prompt is added below.
    const child = this.factory.create(childId);
    this.trace.push(`create ${childId} with empty seed`);
    const result = child.run(request.prompt).then((output): SubagentResult => {
      const notice: UserMessage = {
        role: "user",
        content: [{
          type: "text",
          text: `Subagent ${name} completed: ${output}`,
        }],
      };
      parent.inbox.push(notice);
      this.trace.push(`deliver ${name} result to parent inbox`);
      return { output, stopReason: "completed" };
    });

    parent.session.append({
      role: "tool",
      toolCallId: callId,
      content: [{ type: "text", text: `started subagent ${name}` }],
    });

    return { childId, name, result };
  }
}
