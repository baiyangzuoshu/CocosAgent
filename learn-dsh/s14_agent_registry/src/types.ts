export type SessionId = string;

/** Harness Agent is session-backed; its runtime API is larger than this base contract. */
export interface Agent {
  readonly id: SessionId;
  readonly session: { readonly id: SessionId };
}

/** Only the creator receives this lifecycle capability. */
export interface AgentHandle {
  readonly agent: Agent;
  dispose(): Promise<void>;
}

export interface CreateAgentOptions {
  /** The caller chooses the shared Session and Agent identity. */
  readonly sessionId: SessionId;
}

/** A concrete driver implements creation behind the stable registry API. */
export interface AgentFactory {
  createAgent(options: CreateAgentOptions): Promise<AgentHandle>;
}
