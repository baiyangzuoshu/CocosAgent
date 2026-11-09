export interface UserMessage {
  readonly id: string;
  readonly text: string;
  readonly source: string;
}

export interface PreStepPayload {
  /** Candidate batch already claimed from Inbox for this boundary. */
  readonly messages: readonly UserMessage[];
  readonly turn: number;
  readonly step: number;
}

export type PreStepDecision =
  | { readonly kind: 'reject' }
  | {
    readonly kind: 'enter';
    readonly messages: UserMessage[];
    readonly startsRequestSeries?: true;
  };

export type PreStepNext = () => Promise<PreStepDecision>;
export type PreStepListener = (payload: PreStepPayload, next: PreStepNext) => Promise<PreStepDecision>;

export type SessionEventDraft =
  | { type: 'turn/start'; data: { turn: number } }
  | { type: 'turn/end'; data: { turn: number; reason: { kind: 'completed' | 'blocked' | 'error'; message?: string } } }
  | { type: 'step/start'; data: { turn: number; step: number } }
  | { type: 'step/end'; data: { turn: number; step: number } }
  | { type: 'user/message'; data: { turn: number; step: number; message: UserMessage } }
  | { type: 'assistant/message'; data: { turn: number; step: number; text: string } };

export type SessionEvent = SessionEventDraft & { readonly seq: number };
