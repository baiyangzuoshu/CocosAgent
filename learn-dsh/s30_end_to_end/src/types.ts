export interface UserMessageEvent {
  readonly type: "user/message";
  readonly seq: number;
  readonly data: { readonly text: string };
}

export interface TurnStartEvent {
  readonly type: "turn/start";
  readonly seq: number;
  readonly data: { readonly turn: number };
}

export interface AssistantToolCallEvent {
  readonly type: "assistant/tool-call";
  readonly seq: number;
  readonly data: {
    readonly callId: string;
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  };
}

export interface ToolCallEvent {
  readonly type: "tool/call";
  readonly seq: number;
  readonly data: {
    readonly callId: string;
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  };
}

export interface ToolResultEvent {
  readonly type: "tool/result";
  readonly seq: number;
  readonly data: {
    readonly callId: string;
    readonly name: string;
    readonly content: string;
    readonly isError: boolean;
  };
}

export interface AssistantMessageEvent {
  readonly type: "assistant/message";
  readonly seq: number;
  readonly data: { readonly text: string };
}

export interface TurnEndEvent {
  readonly type: "turn/end";
  readonly seq: number;
  readonly data: { readonly reason: "completed" | "max-steps" };
}

export type SessionEvent =
  | UserMessageEvent
  | TurnStartEvent
  | AssistantToolCallEvent
  | ToolCallEvent
  | ToolResultEvent
  | AssistantMessageEvent
  | TurnEndEvent;

export type SessionEventInput =
  | Omit<UserMessageEvent, "seq">
  | Omit<TurnStartEvent, "seq">
  | Omit<AssistantToolCallEvent, "seq">
  | Omit<ToolCallEvent, "seq">
  | Omit<ToolResultEvent, "seq">
  | Omit<AssistantMessageEvent, "seq">
  | Omit<TurnEndEvent, "seq">;

export type SessionFrame =
  | {
    readonly type: "snapshot";
    readonly sessionId: string;
    readonly cursor: number;
    readonly events: readonly SessionEvent[];
  }
  | { readonly type: "event"; readonly event: SessionEvent };

export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export type ModelMessage =
  | { readonly role: "user"; readonly content: string }
  | {
    readonly role: "assistant";
    readonly toolCall: {
      readonly callId: string;
      readonly name: string;
      readonly arguments: Record<string, unknown>;
    };
  }
  | {
    readonly role: "tool";
    readonly callId: string;
    readonly name: string;
    readonly content: string;
    readonly isError: boolean;
  }
  | { readonly role: "assistant"; readonly content: string };

export type ModelReply =
  | {
    readonly kind: "tool-call";
    readonly callId: string;
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  }
  | { readonly kind: "text"; readonly content: string };
