import type { AgentLifecycleEvent, AgentLifecycleHookRegistry, AgentLifecycleInputs, AgentLifecycleResults } from './contracts.js';

/** Run-scoped, composable hooks. Registration order is preserved. */
export class AgentHookRegistry implements AgentLifecycleHookRegistry {
    private readonly handlers = new Map<AgentLifecycleEvent, Array<(input: never) => unknown | Promise<unknown>>>([
        ['UserPromptSubmit', []], ['PreToolUse', []], ['PostToolUse', []], ['Stop', []],
    ]);

    register<E extends AgentLifecycleEvent>(event: E,
        handler: (input: AgentLifecycleInputs[E]) => AgentLifecycleResults[E] | Promise<AgentLifecycleResults[E]>): () => void {
        const list = this.handlers.get(event);
        if (!list) throw new TypeError(`Unknown Agent lifecycle event: ${event}`);
        list.push(handler as (input: never) => unknown | Promise<unknown>);
        return () => {
            const index = list.indexOf(handler);
            if (index >= 0) list.splice(index, 1);
        };
    }

    async dispatch<E extends AgentLifecycleEvent>(event: E, input: AgentLifecycleInputs[E], stopOnResult = false): Promise<Array<AgentLifecycleResults[E]>> {
        const results: unknown[] = [];
        for (const handler of this.handlers.get(event) || []) {
            const result = await handler(input as never);
            results.push(result);
            if (stopOnResult && result !== undefined && result !== null && result !== false && result !== '') break;
        }
        return results as Array<AgentLifecycleResults[E]>;
    }
}
