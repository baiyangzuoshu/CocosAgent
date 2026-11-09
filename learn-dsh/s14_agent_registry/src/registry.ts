import type { Agent, AgentFactory, AgentHandle, CreateAgentOptions, SessionId } from './types.ts';

/** A small stand-in for Harness's ctx.agents service. */
export class AgentRegistry {
  #agents = new Map<SessionId, Agent>();
  #factory: AgentFactory | undefined;

  setFactory(factory: AgentFactory): () => void {
    if (this.#factory !== undefined) throw new Error('an agent factory is already registered');
    this.#factory = factory;
    let active = true;

    return () => {
      if (!active) return;
      active = false;
      // A stale provider disposer must not clear a newer registration.
      if (this.#factory === factory) this.#factory = undefined;
    };
  }

  async create(options: CreateAgentOptions): Promise<AgentHandle> {
    if (this.#factory === undefined) throw new Error('no agent factory registered');
    return this.#factory.createAgent(options);
  }

  /** Publish a constructed Agent and return authority to remove that exact entry. */
  enter(agent: Agent): () => void {
    if (agent.id !== agent.session.id) {
      throw new Error(`agent id "${agent.id}" does not match session id "${agent.session.id}"`);
    }
    if (this.#agents.has(agent.id)) throw new Error(`agent "${agent.id}" is already registered`);

    this.#agents.set(agent.id, agent);
    let entered = true;
    return () => {
      if (!entered) return;
      entered = false;
      // Check identity so an old disposer can never remove a later lifecycle.
      if (this.#agents.get(agent.id) === agent) this.#agents.delete(agent.id);
    };
  }

  get(id: SessionId): Agent | undefined {
    return this.#agents.get(id);
  }

  list(): Agent[] {
    return [...this.#agents.values()];
  }
}
