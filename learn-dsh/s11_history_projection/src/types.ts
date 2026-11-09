export interface TextBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface UserMessage {
  readonly role: 'user';
  readonly id: string;
  readonly content: readonly TextBlock[];
  readonly source: { readonly kind: 'user' | 'compact-checkpoint'; readonly compactionId?: string };
}

export interface AssistantMessage {
  readonly role: 'assistant';
  readonly id: string;
  readonly content: readonly TextBlock[];
  readonly source: { readonly kind: 'model'; readonly provider: string; readonly model: string };
}

export type SurfaceOp = 'append' | {
  readonly op: 'replace';
  readonly startSeq: number;
  readonly endSeq: number;
};

export interface EventInput {
  readonly type: string;
  readonly data: unknown;
  readonly surfaceOp?: SurfaceOp;
  readonly sourceEventSeqs?: readonly number[];
}

export interface SessionEvent extends EventInput {
  readonly seq: number;
  readonly time: number;
}

export interface DerivedHistory {
  /** Active event nodes in conversation order. */
  readonly nodes: readonly number[];
  /** Messages projected from those nodes for the model request. */
  readonly messages: readonly (UserMessage | AssistantMessage)[];
}
