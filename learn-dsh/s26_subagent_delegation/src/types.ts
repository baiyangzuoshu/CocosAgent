export interface TextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface ToolCallBlock {
  readonly type: "tool-call";
  readonly id: string;
  readonly name: string;
  readonly arguments: {
    readonly description: string;
    readonly prompt: string;
  };
}

export type AssistantBlock = TextBlock | ToolCallBlock;

export interface UserMessage {
  readonly role: "user";
  readonly content: readonly TextBlock[];
}

export interface AssistantMessage {
  readonly role: "assistant";
  readonly content: readonly AssistantBlock[];
}

export interface ToolResultMessage {
  readonly role: "tool";
  readonly toolCallId: string;
  readonly content: readonly TextBlock[];
}

export type ModelMessage = UserMessage | AssistantMessage | ToolResultMessage;

export interface ModelRequest {
  readonly sessionId: string;
  readonly messages: readonly ModelMessage[];
}

export interface SubagentResult {
  readonly output: string;
  readonly stopReason: "completed";
}

export interface SubagentActivation {
  readonly childId: string;
  readonly name: string;
  readonly result: Promise<SubagentResult>;
}
