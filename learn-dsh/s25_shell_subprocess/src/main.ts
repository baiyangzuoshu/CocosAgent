import { LESSON_COMMAND, runStatusCommand } from "./consumer.ts";
import { DemoReadOnlySandboxProvider } from "./sandbox-provider.ts";
import { DenoSubprocessProvider } from "./subprocess-provider.ts";
import { LocalBashProvider, SandboxedBashProvider } from "./shell-provider.ts";

const trace: string[] = [];
const subprocess = new DenoSubprocessProvider(trace);
const sandbox = new DemoReadOnlySandboxProvider(
  ["/bin/bash", "-c", LESSON_COMMAND],
  trace,
);

const localResult = await runStatusCommand(
  new LocalBashProvider(subprocess, trace),
);
const localTrace = trace.splice(0);

const sandboxedResult = await runStatusCommand(
  new SandboxedBashProvider(subprocess, trace, sandbox),
);

console.log("本地 Provider 输出：", JSON.stringify(localResult.stdout.trim()));
console.log(
  "沙箱 Provider 输出：",
  JSON.stringify(sandboxedResult.stdout.trim()),
);
console.log(
  "消费者调用结果相同：",
  localResult.stdout === sandboxedResult.stdout,
);
console.log("本地执行链：", localTrace.join(" → "));
console.log("沙箱执行链：", trace.join(" → "));
console.log("沙箱事实：", sandboxedResult.sandbox);
