export interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface RequestMessage {
  readonly role: 'system' | 'user';
  readonly content: readonly TextBlock[];
}

export interface GenerateOptions {
  /** Provider route selects the registered adapter. */
  readonly provider: string;
  readonly model: string;
  readonly messages: readonly RequestMessage[];
}

export interface ProviderInfo {
  readonly id: string;
  readonly name: string;
}

export interface LlmFailure {
  readonly code: string;
  readonly message: string;
}

export type StreamChunk =
  | { readonly type: 'block-start'; readonly index: number; readonly blockType: 'text' }
  | { readonly type: 'text-delta'; readonly index: number; readonly text: string }
  | { readonly type: 'block-end'; readonly index: number; readonly block: TextBlock }
  | { readonly type: 'usage'; readonly inputTokens: number; readonly outputTokens: number }
  | { readonly type: 'finish'; readonly reason: { readonly kind: 'stop' | 'error'; readonly failure?: LlmFailure } };

export interface LlmAdapter {
  providerInfo(provider: string): ProviderInfo;
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}
