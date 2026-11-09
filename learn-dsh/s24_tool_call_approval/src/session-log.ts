import type {
  ApprovalOutcome,
  ApprovalRequest,
  SessionEvent,
  ToolCall,
  ToolExecutionResult,
  ToolResultMessage,
} from "./types.ts";

/** Keeps approval audit facts separate from model-facing tool results. */
export class SessionLog {
  #events: SessionEvent[] = [];

  appendToolCall(call: ToolCall): number {
    const seq = this.nextSeq();
    this.#events.push({
      seq,
      type: "tool/call",
      data: {
        callId: call.id,
        name: call.name,
        arguments: JSON.stringify(call.arguments),
      },
    });
    return seq;
  }

  appendApprovalAsked(
    id: string,
    request: ApprovalRequest,
  ): void {
    this.#events.push({
      seq: this.nextSeq(),
      type: "approval/asked",
      data: { id, ...request },
    });
  }

  appendApprovalDecided(id: string, outcome: ApprovalOutcome): void {
    this.#events.push({
      seq: this.nextSeq(),
      type: "approval/decided",
      data: { id, outcome },
    });
  }

  appendToolResult(
    call: ToolCall,
    result: ToolExecutionResult,
    callSeq: number,
  ): ToolResultMessage {
    const message: ToolResultMessage = {
      role: "tool",
      toolCallId: call.id,
      isError: result.isError,
      content: result.content,
    };
    this.#events.push({
      seq: this.nextSeq(),
      type: "tool/result",
      data: { message },
      sourceEventSeqs: [callSeq],
    });
    return message;
  }

  snapshot(): SessionEvent[] {
    return structuredClone(this.#events);
  }

  /** Approval audit events are log-only; tool results are model-facing. */
  visibleToolResults(): ToolResultMessage[] {
    return this.#events.flatMap((event) =>
      event.type === "tool/result" ? [event.data.message] : []
    );
  }

  private nextSeq(): number {
    return this.#events.length + 1;
  }
}
