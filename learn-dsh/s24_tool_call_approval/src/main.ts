import { ApprovalService } from "./approval-service.ts";
import { SessionLog } from "./session-log.ts";
import { ToolExecutionPipeline } from "./tool-pipeline.ts";
import type { ApprovalOutcome, ToolCall } from "./types.ts";

const session = new SessionLog();
const trace: string[] = [];
const outcomes: ApprovalOutcome[] = ["allowed-once", "rejected"];
const approval = new ApprovalService(session, (request) => {
  trace.push(`approval/request: ${request.callId}`);
  return outcomes.shift() ?? "unavailable";
});

const pipeline = new ToolExecutionPipeline(
  session,
  approval,
  (call) => ({
    kind: "ask",
    reason: `write note ${call.arguments.path}`,
  }),
  () => undefined,
  trace,
);

const notes: string[] = [];
let bodyCalls = 0;
const writeNote = async (call: ToolCall): Promise<string> => {
  bodyCalls++;
  notes.push(`${call.arguments.path}: ${call.arguments.text}`);
  return `已写入 ${call.arguments.path}`;
};

const approvedCall: ToolCall = {
  id: "call-1",
  name: "write_note",
  arguments: { path: "ideas.md", text: "add approval" },
};
const rejectedCall: ToolCall = {
  id: "call-2",
  name: "write_note",
  arguments: { path: "private.md", text: "keep this private" },
};

const approvedResult = await pipeline.execute(approvedCall, writeNote);
const rejectedResult = await pipeline.execute(rejectedCall, writeNote);

console.log("批准后的工具结果：", approvedResult);
console.log("拒绝后的工具结果：", rejectedResult);
console.log("执行顺序：", trace.join(" → "));
console.log("工具函数调用次数：", bodyCalls);
console.log("内存中的记录：", notes);
console.log("Session 事件：", JSON.stringify(session.snapshot(), null, 2));
console.log("模型可见的工具结果：", session.visibleToolResults());
