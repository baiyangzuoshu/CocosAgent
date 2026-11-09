import { DemoAgentFactory } from './demo-factory.ts';
import { AgentRegistry } from './registry.ts';

const registry = new AgentRegistry();

// This consumer only knows AgentRegistry. It does not import a concrete driver.
async function useRegistry(sessionId: string): Promise<void> {
  const handle = await registry.create({ sessionId });
  const found = registry.get(sessionId);
  console.log(`consumer: handle=${handle.agent.id}, get returns same Agent=${found === handle.agent}`);
  console.log(`consumer: live Agents=[${registry.list().map((agent) => agent.id).join(', ')}]`);
  await handle.dispose();
  console.log(`consumer: after owner dispose, get=${registry.get(sessionId) ?? 'undefined'}`);
}

const stopFirstFactory = registry.setFactory(new DemoAgentFactory(registry, 'loop-A'));
await useRegistry('session-14-a');
stopFirstFactory();

// Swap the provider; the consumer function and registry calls remain unchanged.
registry.setFactory(new DemoAgentFactory(registry, 'loop-B'));
await useRegistry('session-14-b');
