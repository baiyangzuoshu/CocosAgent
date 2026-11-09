import { FakeLlm } from "./fake-llm.ts";
import { LocalNotesMcpServer } from "./local-mcp-server.ts";
import { connectMcpServer } from "./mcp-bridge.ts";
import { ToolRegistry } from "./tool-registry.ts";
import type { ModelMessage } from "./types.ts";

const server = new LocalNotesMcpServer();
const tools = new ToolRegistry();
const llm = new FakeLlm();
const connection = await connectMcpServer(server, tools, "local_notes");
const messages: ModelMessage[] = [{
  role: "user",
  content: "搜索名称包含 cache 的课程笔记。",
}];

let answer = "";
try {
  const first = await llm.generate(messages, tools.schemas());
  if (first.kind !== "tool-call") {
    throw new Error("Expected a tool call from FakeLlm.");
  }
  messages.push({
    role: "assistant",
    content: "",
    toolCall: { id: first.id, name: first.name, arguments: first.arguments },
  });

  const result = await tools.execute(first.name, first.arguments);
  messages.push({
    role: "tool",
    name: first.name,
    toolCallId: first.id,
    content: result.content,
    isError: result.isError,
  });

  const second = await llm.generate(messages, tools.schemas());
  if (second.kind !== "final") {
    throw new Error("Expected a final response from FakeLlm.");
  }
  messages.push({ role: "assistant", content: second.content });
  answer = second.content;

  const errorResult = await tools.execute(first.name, { query: "" });
  console.log("模型可见工具：", tools.schemas().map(({ name }) => name));
  console.log("MCP Server 收到：", server.requests);
  console.log("MCP 工具错误映射为 Harness isError：", errorResult.isError);
  console.log("模型请求轮数：", llm.requests.length);
  console.log("第二次请求中的工具结果：", llm.requests[1].messages.at(-1));
  console.log("最终回答：", answer);
} finally {
  connection.dispose();
}

console.log("断开 MCP Server 后剩余 Harness 工具：", tools.size);
