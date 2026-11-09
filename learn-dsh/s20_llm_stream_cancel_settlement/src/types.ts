export interface LlmFailure {
  readonly message: string;
  readonly code: string;
}

export type FinishReason =
  | { readonly kind: "stop" }
  | { readonly kind: "error"; readonly failure: LlmFailure }
  | { readonly kind: "aborted"; readonly failure: LlmFailure };

export interface TextBlock {
  readonly type: "text";
  readonly text: string;
}

export type StreamChunk =
  | {
    readonly type: "block-start";
    readonly index: number;
    readonly blockType: "text";
  }
  | {
    readonly type: "text-delta";
    readonly index: number;
    readonly text: string;
  }
  | {
    readonly type: "block-end";
    readonly index: number;
    readonly block: TextBlock;
  }
  | { readonly type: "finish"; readonly reason: FinishReason };

export interface GenerateOptions {
  readonly provider: string;
  readonly model: string;
  readonly prompt: string;
  readonly signal: AbortSignal;
}

export interface LlmAdapter {
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

export type TurnEndReason =
  | { readonly kind: "completed" }
  | { readonly kind: "aborted"; readonly reason: { readonly kind: "user" } }
  | { readonly kind: "error"; readonly error: LlmFailure };
