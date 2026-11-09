import { ApprovalService } from "./approval-service.ts";
import { SessionLog } from "./session-log.ts";
import type {
  ApprovalOutcome,
  PreToolDecision,
  ToolCall,
  ToolExecutionResult,
} from "./types.ts";

export type PreExecute = (
  call: ToolCall,
) => PreToolDecision | Promise<PreToolDecision>;

export type ToolBody = (call: ToolCall) => string | Promise<string>;

export type MonotonicGuard = (call: ToolCall) => string | undefined;

/** Models the pre-execute -> approval -> guard -> tool-body sequence. */
export class ToolExecutionPipeline {
  constructor(
    private readonly session: SessionLog,
    private readonly approval: ApprovalService,
    private readonly preExecute: PreExecute,
    private readonly guard: MonotonicGuard,
    private readonly trace: string[],
  ) {}

  async execute(call: ToolCall, body: ToolBody): Promise<ToolExecutionResult> {
    const callSeq = this.session.appendToolCall(call);
    let result: ToolExecutionResult;

    try {
      const gate = await this.preExecute(call);
      let denialReason = gate.kind === "deny" ? gate.reason : undefined;

      if (gate.kind === "ask") {
        this.trace.push(`ask: ${call.id}`);
        const outcome = await this.approval.request({
          toolName: call.name,
          callId: call.id,
          reason: gate.reason,
        });
        denialReason = denialReasonFor(outcome, call.name);
      }

      if (denialReason === undefined) {
        this.trace.push(`guard: ${call.id}`);
        denialReason = this.guard(call);
      }

      if (denialReason !== undefined) {
        result = failure(denialReason);
      } else {
        this.trace.push(`body: ${call.id}`);
        result = { isError: false, content: await body(call) };
      }
    } catch (error: unknown) {
      result = failure(errorMessage(error));
    }

    this.session.appendToolResult(call, result, callSeq);
    return result;
  }
}

function denialReasonFor(
  outcome: ApprovalOutcome,
  toolName: string,
): string | undefined {
  switch (outcome) {
    case "allowed-once":
      return undefined;
    case "rejected":
      return `the user rejected tool "${toolName}"`;
    case "cancelled":
      return `approval for tool "${toolName}" was cancelled`;
    case "unavailable":
      return `tool "${toolName}" requires approval, but no answerer is available`;
  }
}

function failure(message: string): ToolExecutionResult {
  return { isError: true, content: `Error: ${message}` };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
