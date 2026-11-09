export interface TextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface ToolCallBlock {
  readonly type: "tool-call";
  readonly id: string;
  readonly name: string;
  /** Kept as the raw JSON string emitted by the model. */
  readonly arguments: string;
}

export type AssistantContent = TextBlock | ToolCallBlock;

export interface UserMessage {
  readonly role: "user";
  readonly content: readonly TextBlock[];
}

export interface AssistantMessage {
  readonly role: "assistant";
  readonly content: readonly AssistantContent[];
}

export interface ToolResultMessage {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly content: readonly TextBlock[];
  readonly isError: boolean;
}

export type ModelMessage = UserMessage | AssistantMessage | ToolResultMessage;

export type EventInput =
  | { readonly type: "turn/start"; readonly data: { readonly turn: number } }
  | {
    readonly type: "turn/end";
    readonly data: {
      readonly turn: number;
      readonly reason: "completed" | "max-steps";
    };
  }
  | {
    readonly type: "step/start" | "step/end";
    readonly data: { readonly turn: number; readonly step: number };
  }
  | {
    readonly type: "user/message";
    readonly data: { readonly message: UserMessage };
  }
  | {
    readonly type: "assistant/message";
    readonly data: {
      readonly turn: number;
      readonly step: number;
      readonly message: AssistantMessage;
    };
  }
  | {
    readonly type: "tool/call";
    readonly data: {
      readonly turn: number;
      readonly step: number;
      readonly callId: string;
      readonly name: string;
      readonly arguments: string;
    };
  }
  | {
    readonly type: "tool/result";
    readonly data: {
      readonly turn: number;
      readonly step: number;
      readonly message: ToolResultMessage;
    };
  };

export type SessionEvent = EventInput & {
  readonly seq: number;
  readonly sourceEventSeqs?: readonly number[];
};
