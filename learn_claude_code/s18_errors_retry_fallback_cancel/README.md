# 第 18 课：错误、重试、回退与取消

**目标：** 区分 API 请求内部重试、流式请求降级、Query 切换模型，以及用户中断。重点看每条路径由哪个层负责、会保留什么状态、何时结束。

## 本课要回答的问题

1. 一次 API 错误如何决定重试、等待或停止？
2. 流式失败转成非流式请求，与切换到另一个模型有什么区别？
3. Esc/Ctrl+C 如何从 REPL 把取消信号传到请求和工具，并形成终止结果？

## 先区分四条路径

| 路径 | 决策层 | 主要动作 | 是否改变模型 |
| --- | --- | --- | --- |
| API 重试 | `withRetry()` | 同一请求操作再试；按错误类型和服务端等待时间退避 | 通常不变，特定错误可调整请求上下文 |
| 流式回退 | `claude.ts` | 流式失败后用同一模型发非流式请求 | 不变 |
| 模型回退 | `query.ts` | 收到 `FallbackTriggeredError` 后清理失败尝试并重启 Query 请求 | 改成配置的 fallback model |
| 用户中断 | `CancelRequestHandler` → REPL → Query/API/工具 | `AbortController` 通知进行中的路径停止并收尾 | 不适用 |

~~~mermaid
flowchart TD
  A[Query 调用模型] --> B[withRetry 发起流式 API 操作]
  B --> C{请求错误}
  C -- 可重试 --> D[退避等待并再次请求]
  C -- 连续 529 达阈值且有 fallbackModel --> E[抛 FallbackTriggeredError]
  E --> F[Query 清理失败尝试并切换模型]
  C -- 不可重试 / 到达上限 --> G[向上抛出错误]
  B --> H{流式消费错误}
  H -- 用户信号已取消 --> I[中断收尾]
  H -- 可走非流式降级 --> J[同模型非流式请求，继续使用 signal]
  J --> K[Query 清除旧流的部分消息与工具结果]
  H -- 无法降级 --> G
  L[Esc / Ctrl+C] --> M[REPL onCancel]
  M --> N[AbortSignal 到模型请求与工具执行]
  N --> I
  D --> B
~~~

这几条路径都可能表现为“再发请求”或“停止”，但拥有者不同：`withRetry` 只管理一次 API 操作的尝试；API 层负责流式与非流式传输方式之间的降级；Query 才决定更换模型并重启整次模型尝试。取消信号可以打断等待、网络请求和工具阶段。

## API 重试：`withRetry()` 管一组请求尝试

`queryModelWithStreaming()` 用 `withRetry()` 包住 API 请求创建，范围到 `.withResponse()` 收到响应头并返回流对象为止；后续读取流 body 在 `claude.ts` 的另一段处理里。创建客户端时设 `maxRetries: 0`，把这段请求的重试策略交给本地循环。默认 `CLAUDE_CODE_MAX_RETRIES` 为 10 次重试，所以普通路径至多是首次请求加 10 次重试；容量错误的持久重试分支可以越过这个普通上限。

每次失败后先判断是否应重试。代码还单独处理云认证错误、上下文 token 上限、fast mode 降级和 529 过载。对可重试错误，退避时间会考虑 `Retry-After`；等待期间 Query 可收到 API retry 系统消息。后台等非前台来源遇到 529 会直接退出，避免容量下降时放大请求量。

符合模型回退条件时，连续 529 达到阈值 3 且配置了 `fallbackModel`，`withRetry()` 抛出 `FallbackTriggeredError`。它不在 API 层偷偷切模型，而是把控制权交给 Query。阈值逻辑还受模型/环境条件限制，因此不能概括为“任何模型的第三个 529 都会换模型”。

## 流式回退：同模型换传输方式

流式请求在 `claude.ts` 消费响应时失败，且不是用户的 AbortSignal 中断时，部分错误路径会调用 `executeNonStreamingRequest()`。新请求仍传原模型、重试上下文和同一 `signal`；若原错误是 529，也会把它计入连续 529 计数。创建流时返回 404 则由外层识别，在流式重试失败后转到非流式请求。

`onStreamingFallback` 通知 Query：此前已经 yield 的 assistant 部分消息不能与非流式响应拼接。Query 会为旧 assistant 消息 yield tombstone，清空 assistant/tool 结果与 follow-up 标记，并丢弃旧 `StreamingToolExecutor` 后重建。这样旧的 `tool_use_id` 不会和新响应的工具结果混在一起。

源码也说明了一个风险：若流式阶段已经启动工具，再以非流式方式重做同一轮，可能重复执行工具。因此回退可被环境变量或 feature gate 关闭。关闭时错误继续向上抛出。这不是通用的网络错误重试规则，而是专门的请求模式降级。

## 模型回退：Query 清理并重新开始

`FallbackTriggeredError` 到达 `query.ts` 后，Query 设置 `currentModel = fallbackModel`，清理失败尝试累积的 assistant/tool 状态，并让流式工具执行器丢弃旧结果；随后同步 `mainLoopModel`，循环重新请求。特定内部构建还会剥除绑定在原模型上的 thinking 签名块。

因此模型回退粒度比 API 重试和流式降级更大：它不是再次调用原 API 操作，也不是把同模型的流式接口换成非流式接口，而是由 Query 开始一次新模型尝试。它仍发生在当前 Query 控制流内。

## 取消：信号中断之后还要收尾

`CancelRequestHandler` 在 Escape/Ctrl+C 有效的上下文中优先取消正在运行的任务；如果没有活动任务而命令队列非空，Escape 会取出队首命令。REPL 的 `onCancel()` 会结束 Query guard、保留已经显示的部分文本、清理加载状态，并按交互位置处理权限确认、Prompt、远端请求或本地 AbortController。普通本地取消用 reason `user-cancel`。

同一个 `AbortSignal` 从 Query 传进模型依赖和 API 请求；`withRetry()` 在开始新尝试与退避等待时也检查它。工具阶段同样从 `ToolUseContext` 读取该信号。代码还使用 `background`、`interrupt` 等 reason 表达其他控制流，所以 `signal.aborted` 本身并不等于用户按了 Esc。

取消后仍需维持消息结构：若在流式响应阶段中断，Query 会消费流式工具执行器的剩余结果，让排队/进行中的工具产生合成 `tool_result`；没有流式执行器时则补齐缺失的工具结果，然后通常 yield “Interrupted by user” 并以 `aborted_streaming` 返回。若中断发生在工具阶段，Query 发出工具中断消息并以 `aborted_tools` 返回。reason 为 `interrupt` 时会跳过通用中断消息，因为后续排队的用户输入会提供上下文。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/services/api/withRetry.ts | sed -n '52,55p;127,168p;170,193p;316,383p;430,516p;789,797p'
nl -ba engine/claude-code-analysis-main/src/services/api/claude.ts | sed -n '1776,1846p;2434,2461p;2464,2569p;2598,2659p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '650,742p;893,952p;1011,1051p;1484,1515p'
nl -ba engine/claude-code-analysis-main/src/hooks/useCancelRequest.ts | sed -n '87,167p'
nl -ba engine/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '2106,2163p;2186,2202p;2920,2933p'
~~~

## 观察结果

- API 重试次数、重试资格、等待和可中断退避集中在 `withRetry()`；API 客户端关闭 SDK 自带重试，避免两层重试叠加。
- 流式回退保留模型但改变传输方式；若此前已有流式输出，Query 会撤回旧消息并丢弃旧工具结果。
- 529 模型回退由 `withRetry()` 发出专用错误，实际模型切换和 Query 状态清理由 `query.ts` 执行。
- 用户取消沿 AbortSignal 传播，但会根据中断发生在 API 流还是工具阶段执行不同收尾，并返回不同的 Query 终止 reason。

## 简化与限制

- 本课聚焦重试、两种回退和取消的边界，没有逐一列举所有 HTTP 状态码、provider 特例与 fast mode 策略。
- `withRetry()` 的持久重试受环境、错误类别与服务端响应影响；默认 10 次只描述普通重试上限。
- 本课依据当前仓库快照静态阅读；未运行 CLI、制造 API 故障或执行测试，因此不构成网络恢复或运行时验收。
