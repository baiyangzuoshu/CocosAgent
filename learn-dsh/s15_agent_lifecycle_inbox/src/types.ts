export type InboxTarget = 'next-turn' | 'next-step';
export type AgentStatus = 'idle' | 'running';

export interface UserMessage {
  readonly id: string;
  readonly text: string;
  readonly source: string;
}

export interface InboxState {
  readonly nextTurn: readonly UserMessage[];
  readonly nextStep: readonly UserMessage[];
}

export interface InboxSpliceEvent {
  readonly seq: number;
  readonly type: 'agent/inbox/spliced';
  readonly data: {
    readonly target: InboxTarget;
    readonly start: number;
    readonly removedCount?: number;
    readonly inserted: readonly UserMessage[];
    readonly outcome?: 'canceled';
  };
}

export interface SessionView {
  readonly id: string;
  snapshot(): readonly InboxSpliceEvent[];
}

export interface Inbox {
  readonly nextTurn: readonly UserMessage[];
  readonly nextStep: readonly UserMessage[];
  clear(): void;
}

export interface Agent {
  readonly id: string;
  readonly session: SessionView;
  readonly inbox: Inbox;
  readonly status: AgentStatus;
  followup(message: UserMessage): void;
  steer(message: UserMessage): void;
  inject(message: UserMessage): void;
  whenIdle(): Promise<void>;
}

export interface AgentHandle {
  readonly agent: Agent;
  dispose(): Promise<void>;
}
