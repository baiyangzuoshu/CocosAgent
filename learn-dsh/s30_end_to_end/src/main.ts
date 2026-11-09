import { Application, type DemoContext, type Plugin } from "./application.ts";
import { AgentLoop } from "./agent-loop.ts";
import { FakeLlm } from "./fake-llm.ts";
import { SessionLog } from "./session.ts";
import { ToolRegistry } from "./tools.ts";
import {
  BrowserConversation,
  ConversationView,
  LocalWebTransport,
  REMOTE_MUX_PATH,
} from "./web-client.ts";

const session = new SessionLog("session-30");
const tools = new ToolRegistry();
const llm = new FakeLlm();
const transport = new LocalWebTransport();
const context: DemoContext = { session, tools, llm, transport };
const plugins: Plugin[] = [
  {
    name: "search-tool",
    apply: ({ tools: registry }) =>
      registry.register({
        name: "search_notes",
        description: "Search lesson notes by filename fragment.",
        parameters: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
        async execute(args) {
          const query = args.query;
          if (typeof query !== "string") {
            return { content: "query must be text", isError: true };
          }
          const notes = [
            "cache-design.md",
            "tool-loop.md",
            "session-history.md",
          ];
          const matches = notes.filter((note) => note.includes(query));
          return {
            content: matches.join(", ") || "No matching notes.",
            isError: false,
          };
        },
      }),
  },
  {
    name: "agent-loop",
    apply: (services) => {
      services.agent = new AgentLoop(
        services.llm,
        services.tools,
        services.session,
      );
    },
  },
  {
    name: "web-client",
    apply: async (services) => {
      const web = new BrowserConversation();
      await web.connect((signal) =>
        services.transport.openSession(services.session, signal)
      );
      services.web = web;
      return () => web.dispose();
    },
  },
  {
    name: "conversation-view",
    apply: (services) => {
      if (!services.web) throw new Error("web-client plugin must start first.");
      const view = new ConversationView(services.web);
      services.view = view;
      return () => view.dispose();
    },
  },
];
const app = new Application(context, plugins);

await app.start();
try {
  console.log(`Host/Web 事件流已连接：${REMOTE_MUX_PATH}`);
  if (!context.agent || !context.web) {
    throw new Error("Required plugins did not start.");
  }
  await context.agent.run("查找 cache 相关笔记并总结。");
  await context.web.waitForCursor(session.cursor);

  console.log("模型请求数：", llm.requests.length);
  console.log("第二次模型请求携带的历史：", llm.requests[1]?.messages);
  console.log("Web Client 最终状态：", context.web.getSnapshot());
} finally {
  await app.dispose();
}
