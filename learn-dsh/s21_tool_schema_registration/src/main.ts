import { defineTool } from "./tool-definition.ts";
import { ToolRegistry } from "./tool-registry.ts";

const tools = new ToolRegistry();

const unregister = tools.register(defineTool({
  name: "search_notes",
  description: "Search notes and return matching titles.",
  parameters: {
    query: {
      type: "string",
      required: true,
      description: "Words to find in note titles and contents.",
    },
    limit: {
      type: "integer",
      description: "Maximum number of results. Defaults to 5.",
    },
  },
  output: {
    schema: { type: "array", items: { type: "string" } },
    render: (value) => JSON.stringify(value),
  },
  timeoutMs: 3_000,
  async execute(_args) {
    // 第 22 课才会消费模型参数并执行这类实现。
    return ["lesson-notes.md"];
  },
}));

const modelRequest = {
  provider: "fake-provider",
  model: "fake-model",
  messages: [{ role: "user", content: "查找工具注册的课程笔记。" }],
  tools: tools.schemas(),
};

console.log("发给模型的 tools：");
console.log(JSON.stringify(modelRequest.tools, null, 2));
console.log("模型 schema 包含 execute：", "execute" in modelRequest.tools[0]);
console.log("注册定义拥有 execute：", typeof tools.definitions()[0]?.execute);

unregister();
console.log("释放注册后的工具数量：", tools.schemas().length);
