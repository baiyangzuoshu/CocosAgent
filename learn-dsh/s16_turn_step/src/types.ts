export interface ToolCall {
  readonly id: string;
  readonly name: string;
  /** Raw JSON text, as it is recorded from a model response. */
  readonly arguments: string;
}

export interface UserMessage {
  readonly id: string;
  readonly text: string;
}

export interface RequestMessage {
  readonly role: 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly toolCalls?: readonly ToolCall[];
  readonly toolName?: string;
}

export interface FakeModelResponse {
  readonly text: string;
  readonly toolCalls?: readonly ToolCall[];
}

export interface LlmRequest {
  readonly turn: number;
  readonly step: number;
  readonly messages: readonly RequestMessage[];
}

export type SessionEventDraft =
  | { type: 'turn/start'; data: { turn: number } }
  | { type: 'turn/end'; data: { turn: number; reason: { kind: 'completed' | 'error'; message?: string } } }
  | { type: 'step/start'; data: { turn: number; step: number } }
  | { type: 'step/end'; data: { turn: number; step: number } }
  | { type: 'user/message'; data: { turn: number; step: number; id: string; text: string } }
  | { type: 'assistant/message'; data: { turn: number; step: number; text: string; toolCalls: readonly ToolCall[] } }
  | { type: 'tool/call'; data: { turn: number; step: number; callId: string; name: string; arguments: string } }
  | { type: 'tool/result'; data: { turn: number; step: number; callId: string; name: string; text: string } };

export type SessionEvent = SessionEventDraft & { readonly seq: number };
