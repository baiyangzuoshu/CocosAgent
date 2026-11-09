import { defineTool } from "./schema.ts";
import { ToolExecutionPipeline } from "./tool-pipeline.ts";
import { ToolRegistry } from "./tool-registry.ts";
import type { ToolRunContext } from "./types.ts";

const registry = new ToolRegistry();
let searchBodyCalls = 0;
let timeoutBodyCalls = 0;
let timeoutObservedAbort = false;

const releaseSearch = registry.register(defineTool({
  name: "search_notes",
  description: "Search note titles and return matching titles.",
  parameters: {
    query: {
      type: "string",
      required: true,
      description: "Text to search for.",
    },
    limit: { type: "integer", description: "Maximum number of matches." },
  },
  output: {
    schema: { type: "array", items: { type: "string" } },
    render: (_args, value) => JSON.stringify(value),
  },
  async execute(args) {
    searchBodyCalls++;
    const { query, limit = 5 } = args as { query: string; limit?: number };
    const matches = ["tool-schema.md", "session-flow.md", "agent-loop.md"]
      .filter((name) => name.includes(query));
    return matches.slice(0, limit);
  },
}));

const releaseSlow = registry.register(defineTool({
  name: "slow_index",
  description: "Wait for a slow index operation.",
  parameters: { waitMs: { type: "integer", required: true } },
  output: {
    schema: { type: "string" },
    render: (_args, value) => String(value),
  },
  timeoutMs: 10,
  async execute(_args, context) {
    timeoutBodyCalls++;
    try {
      await waitFor(100, context);
      return "index ready";
    } catch (error: unknown) {
      timeoutObservedAbort = context.signal.aborted;
      throw error;
    }
  },
}));

const pipeline = new ToolExecutionPipeline(registry);

const invalidCalls = await Promise.all([
  pipeline.execute({ name: "search_notes", arguments: { limit: 2 } }),
  pipeline.execute({ name: "search_notes", arguments: { query: 42 } }),
]);
console.log("无效参数结果：", JSON.stringify(invalidCalls));
console.log("无效参数时工具函数调用数：", searchBodyCalls);

const valid = await pipeline.execute({
  name: "search_notes",
  arguments: { query: "tool", limit: 2 },
});
console.log("有效调用结果：", JSON.stringify(valid));
console.log("有效参数时工具函数调用数：", searchBodyCalls);

const timedOut = await pipeline.execute({
  name: "slow_index",
  arguments: { waitMs: 100 },
});
console.log("超时结果：", JSON.stringify(timedOut));
console.log("超时工具观察到取消：", timeoutObservedAbort);
console.log("超时后工具函数调用数：", timeoutBodyCalls);

releaseSlow();
releaseSearch();

function waitFor(durationMs: number, context: ToolRunContext): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      context.signal.removeEventListener("abort", abort);
      resolve();
    }, durationMs);
    const abort = () => {
      clearTimeout(timer);
      context.signal.removeEventListener("abort", abort);
      reject(context.signal.reason ?? new Error("aborted"));
    };
    if (context.signal.aborted) abort();
    else context.signal.addEventListener("abort", abort, { once: true });
  });
}
