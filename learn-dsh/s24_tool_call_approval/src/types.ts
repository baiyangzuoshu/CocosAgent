export type ApprovalOutcome =
  | "allowed-once"
  | "rejected"
  | "cancelled"
  | "unavailable";

export type PreToolDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly reason: string }
  | { readonly kind: "ask"; readonly reason: string };

export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, string>>;
}

export interface ApprovalRequest {
  readonly toolName: string;
  readonly callId: string;
  readonly reason: string;
}

export interface ToolExecutionResult {
  readonly isError: boolean;
  readonly content: string;
}

export interface ToolResultMessage {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly isError: boolean;
  readonly content: string;
}

export type SessionEvent =
  | {
    readonly seq: number;
    readonly type: "tool/call";
    readonly data: {
      readonly callId: string;
      readonly name: string;
      readonly arguments: string;
    };
  }
  | {
    readonly seq: number;
    readonly type: "approval/asked";
    readonly data: {
      readonly id: string;
      readonly toolName: string;
      readonly callId: string;
      readonly reason: string;
    };
  }
  | {
    readonly seq: number;
    readonly type: "approval/decided";
    readonly data: {
      readonly id: string;
      readonly outcome: ApprovalOutcome;
    };
  }
  | {
    readonly seq: number;
    readonly type: "tool/result";
    readonly data: {
      readonly message: ToolResultMessage;
    };
    readonly sourceEventSeqs: readonly number[];
  };
