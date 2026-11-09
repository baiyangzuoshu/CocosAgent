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

export interface AssistantMessageEvent {
  readonly type: "assistant/message";
  readonly seq: number;
  readonly data: {
    readonly turn: number;
    readonly attemptId: string;
    readonly text: string;
  };
}

export interface TurnEndEvent {
  readonly type: "turn/end";
  readonly seq: number;
  readonly data: { readonly turn: number; readonly reason: "completed" };
}

export type SessionEvent =
  | UserMessageEvent
  | TurnStartEvent
  | AssistantMessageEvent
  | TurnEndEvent;

export type SessionEventInput =
  | Omit<UserMessageEvent, "seq">
  | Omit<TurnStartEvent, "seq">
  | Omit<AssistantMessageEvent, "seq">
  | Omit<TurnEndEvent, "seq">;

export interface SessionSnapshotFrame {
  readonly type: "snapshot";
  readonly sessionId: string;
  readonly cursor: number;
  readonly events: readonly SessionEvent[];
}

export interface SessionEventFrame {
  readonly type: "event";
  readonly event: SessionEvent;
}

/** Cursorless assistant output, delivered before its durable message event. */
export interface AssistantStreamFrame {
  readonly type: "assistant-stream";
  readonly attemptId: string;
  readonly revision: number;
  readonly text: string;
}

export type SessionFrame =
  | SessionSnapshotFrame
  | SessionEventFrame
  | AssistantStreamFrame;

export interface ConversationRow {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface SessionProjection {
  readonly sessionId: string | undefined;
  readonly cursor: number;
  readonly status: "waiting" | "running" | "completed" | "error";
  readonly rows: readonly ConversationRow[];
  readonly liveText: string;
  readonly revision: number;
}
