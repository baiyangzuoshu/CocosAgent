# 第 32 课：进程退出、信号与资源清理

**目标：** 从信号或正常结束追到退出码、注册清理、SessionEnd Hook、终端复位和强制退出兜底，区分“发起关闭”与“清理已完成”。

## 本课要回答的问题

1. `setupGracefulShutdown()` 注册哪些进程级信号处理？
2. `gracefulShutdown()` 按什么顺序清理进程、会话和终端？
3. `registerCleanup()` 的回调怎样执行，超时和异常如何处理？
4. `gracefulShutdownSync()` 是否会同步等待清理结束？
5. Print 的 Ctrl+C、SDK `end_session` 与进程信号有什么区别？

## 退出主链

课程第31课追踪了控制协议中的 `end_session`；本课继续看进程如何退出。源码里关闭至少有两层：消息处理或调用方决定何时启动关闭；`gracefulShutdown()` 统一负责执行清理和最终退出。下面的流程只概括共享收尾函数，具体触发点仍取决于运行模式。

~~~mermaid
flowchart TD
  S[Signal / normal completion / fatal setup path] --> T{运行模式}
  T -->|Print Ctrl+C| P[abort 当前 Query，再调用 gracefulShutdown]
  T -->|其他信号或调用方| G[gracefulShutdown 或 gracefulShutdownSync]
  P --> G
  G --> D[shutdownInProgress 去重]
  D --> F[设置 failsafe timer 与 exitCode]
  F --> R[同步复位 TTY 与 Ink 状态]
  R --> C[并发执行 registerCleanup 回调，最多等待 2 秒]
  C --> H[SessionEnd Hooks：有总预算]
  H --> A[性能/会话事件与 Analytics：最多等 500ms]
  A --> X[forceExit：drain stdin，process.exit]
  X -->|process.exit 在死终端失败| K[SIGKILL 兜底]
~~~

## 从信号进入共享关闭函数

`entrypoints/init.ts` 调用 memoized 的 `setupGracefulShutdown()`。这组 handler 将 SIGTERM 映射到退出码 143，将非 Windows 平台的 SIGHUP 映射到 129；其 SIGINT handler 在 `-p/--print` 模式让位给 Print 自己的处理。需要注意，`main.tsx` 另有 SIGINT handler，在非 Print 路径直接调用 `process.exit(0)`。因此源码里有两处 SIGINT 注册；不能只凭 `setupGracefulShutdown()` 的映射就断言每条交互退出路径都会等完异步清理。TTY 被系统撤销但没有收到 SIGHUP 时，还有周期检查读取/写入流的 orphan detector。Signal handler 之外，源码也在未捕获异常和未处理 Promise rejection 时记录诊断信息。

Print 为 Ctrl+C 安装专属处理：先 abort 当前 `abortController`，再调用 `gracefulShutdown(0)`。正常 Print 结束时，`runHeadless()` 根据最后的 result 错误标记调用 `gracefulShutdownSync()` 并设置退出码。`end_session` 是 SDK 控制协议消息，不等于 OS 信号；它在 Print 输入循环中停止接收请求，随后由正常结束路径进入共享收尾。

## 关闭顺序与时间边界

`gracefulShutdown()` 用 `shutdownInProgress` 防重复进入，先取得 SessionEnd Hook 的预算并启动 failsafe timer。随后立即复位终端并打印可恢复会话提示，再执行注册的清理回调，之后执行 SessionEnd Hooks、输出性能/会话事件、限时 flush Analytics，最后调用 `forceExit(exitCode)`。

`cleanupTerminalModes()` 只在 stdout 是 TTY 时用 `writeSync()` 清理终端模式。它会尽早停用鼠标事件、卸载活动 Ink 实例、恢复光标与键盘/粘贴/焦点模式，并清掉终端标题及进度显示。同步写是为了让复位字节在进程退出前落到终端；终端已经断开时错误会被忽略。

`cleanupRegistry.ts` 用 `Set` 保存回调，`registerCleanup()` 返回可注销该回调的函数，`runCleanupFunctions()` 用 `Promise.all()` 同时启动已注册回调。`gracefulShutdown()` 最多等待这组任务 2 秒，清理错误和超时都不会阻止后续收尾。源码中的例子包括 init 注册 LSP/团队清理、RemoteIO 注册传输关闭、Print 注册后台任务状态诊断。

SessionEnd Hooks 使用独立的总预算（源码默认 1.5 秒，可由设置调整）。Analytics flush 最多等待 500 毫秒。failsafe timer 的等待上限为 `max(5s, hookBudget + 3.5s)`；到期先尝试复位终端和打印恢复提示，再直接退出。`forceExit()` 在真正退出前再次 drain Ink 输入；若死终端导致 `process.exit()` 抛出 EIO，生产路径改用 SIGKILL。

需要特别区分 `gracefulShutdownSync()`：它立即写入 `process.exitCode`，然后启动并保存 `gracefulShutdown()` 的 Promise，并没有在函数返回前同步等待全部清理。它适合要标记退出状态又让事件循环完成异步收尾的调用点，名字中的 Sync 不代表整个关闭流程同步完成。

stdout/stderr 的 EPIPE 是另一种边界：`registerProcessOutputErrorHandlers()` 在管道断开时销毁对应 stream，减少 broken-pipe 场景下的资源滞留；这段逻辑本身不执行 SessionEnd Hook 或 Analytics flush。

## 关闭触发点对照

| 触发方式 | 首要动作 | 是否直接结束进程 |
| --- | --- | --- |
| Print Ctrl+C | Print handler abort 当前 Query，再进入共享 graceful shutdown | 否；等待异步清理或 failsafe |
| 非 Print SIGINT | `setupGracefulShutdown()` 与 `main.tsx` 各有 handler；后者调用 `process.exit(0)` | 仅静态源码不足以断言异步清理必定完成 |
| SDK `end_session` | abort 当前工作、回控制响应、停止读取新输入 | 否；headless 结束路径随后收尾 |
| SIGTERM / SIGHUP | 映射为 143 / 129 并进入 `gracefulShutdown()` | 否；清理结束后 `forceExit()` |
| 正常 Print 完成 | 根据最终 result 设置退出码并启动关闭 | 否；会话数据、Hook 与日志先收尾 |
| `forceExit()` | drain stdin 并调用 `process.exit()` | 是；死终端下 SIGKILL 兜底 |

## 静态观察

以下命令只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/entrypoints/init.ts | sed -n '57,96p;185,200p'
nl -ba AI/claude-code-analysis-main/src/main.tsx | sed -n '585,607p'
nl -ba AI/claude-code-analysis-main/src/utils/cleanupRegistry.ts | sed -n '1,25p'
nl -ba AI/claude-code-analysis-main/src/utils/gracefulShutdown.ts | sed -n '58,135p;193,232p;234,334p;336,359p;391,523p'
nl -ba AI/claude-code-analysis-main/src/cli/print.ts | sed -n '959,974p;1020,1048p'
nl -ba AI/claude-code-analysis-main/src/utils/process.ts | sed -n '1,15p'
~~~

## 观察结果

- `gracefulShutdown()` 是共享异步收尾路径；信号、正常完成和同步入口都会把退出工作汇入这里。
- 终端恢复尽早且同步执行，注册资源清理、SessionEnd Hook 和 Analytics 则受各自时间预算约束。
- Cleanup 回调并发执行；注册顺序不是完成顺序，调用方不能依赖串行资源销毁。
- `gracefulShutdownSync()` 设置退出码并启动异步关闭，不代表调用它的栈已经等到关闭完成。

## 范围与限制

- 本课根据静态源码描述 Node/Bun 进程关闭策略，没有发送真实信号、断开 TTY、模拟 EPIPE 或运行 CLI。
- 测试模式下 `forceExit()` 对模拟的 `process.exit()` 异常有特殊处理；本课只概括生产退出路径。
- 不把 `process.exitCode` 已设置等同于清理完成；进程退出、终端复位和 Hook/资源清理是不同阶段。