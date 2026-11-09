import { AgentFactory } from "./agent.ts";
import { FakeLLM } from "./fake-llm.ts";
import { SubagentManager } from "./subagent-manager.ts";
import type { UserMessage } from "./types.ts";

const llm = new FakeLLM([
  "README includes installation steps but is missing the command to start the app.",
]);
const factory = new AgentFactory(llm);
const parent = factory.create("parent-session");
const originalTask: UserMessage = {
  role: "user",
  content: [{
    type: "text",
    text:
      "Review the README and tell me whether the run instructions are complete.",
  }],
};
parent.session.append(originalTask);

const trace: string[] = [];
const subagents = new SubagentManager(factory, trace);
const activation = subagents.start(parent, {
  description: "review README",
  prompt:
    "Check the README installation and run instructions. Report missing steps.",
});

console.log("子 Agent 已启动：", activation.name, activation.childId);
console.log("启动回执：", parent.session.snapshot().at(-1));

const result = await activation.result;
const notices = parent.receivePending();

console.log("子 Agent 结果：", result);
console.log("子 Agent 的模型请求：", JSON.stringify(llm.requests[0], null, 2));
console.log("父 Agent 收到的完成通知：", notices);
console.log("父 Session：", JSON.stringify(parent.session.snapshot(), null, 2));
console.log("执行顺序：", trace.join(" → "));
