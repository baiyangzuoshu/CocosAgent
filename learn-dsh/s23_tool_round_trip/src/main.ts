import { AgentLoop } from "./agent-loop.ts";
import { FakeLlm } from "./fake-llm.ts";
import { SessionLog } from "./session-log.ts";
import { ToolRegistry } from "./tool-registry.ts";

const llm = new FakeLlm();
const session = new SessionLog();
const tools = new ToolRegistry();

const unregister = tools.register({
  name: "search_notes",
  async execute(args) {
    const query = String(args.query ?? "");
    const notes = ["cache-design.md", "tool-loop.md", "session-history.md"];
    const matches = notes.filter((note) => note.includes(query));
    return [{ type: "text", text: matches.join(", ") || "没有找到匹配笔记。" }];
  },
});

try {
  const agent = new AgentLoop(llm, tools, session);
  await agent.run("搜索名称包含 cache 的课程笔记，然后总结。");

  console.log(JSON.stringify(
    {
      requestCount: llm.requests.length,
      requests: llm.requests.map((messages, index) => ({
        step: index + 1,
        messages,
      })),
      events: session.snapshot(),
    },
    null,
    2,
  ));
} finally {
  unregister();
}
