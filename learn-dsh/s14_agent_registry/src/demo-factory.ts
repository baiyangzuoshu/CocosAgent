import type { Agent, AgentFactory, AgentHandle, CreateAgentOptions } from './types.ts';
import { AgentRegistry } from './registry.ts';

class DemoAgent implements Agent {
  readonly session: { readonly id: string };

  constructor(readonly id: string) {
    this.session = { id };
  }
}

/** Simulates a replaceable loop provider that constructs and publishes Agents. */
export class DemoAgentFactory implements AgentFactory {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly name: string,
  ) {}

  async createAgent({ sessionId }: CreateAgentOptions): Promise<AgentHandle> {
    const agent = new DemoAgent(sessionId);
    const detach = this.registry.enter(agent);
    let disposed = false;
    console.log(`factory(${this.name}) constructed ${sessionId}`);

    return {
      agent,
      async dispose() {
        if (disposed) return;
        disposed = true;
        detach();
      },
    };
  }
}
