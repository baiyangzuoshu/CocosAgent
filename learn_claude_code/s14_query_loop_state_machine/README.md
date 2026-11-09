# 第 14 课：Query 主循环状态机

**目标：** 沿 `queryLoop()` 的外层循环识别状态从哪里来、哪些条件会继续循环，以及哪些结果会结束本次 Query。这里看状态迁移，不展开模型流协议和工具实现细节。

## 本课要回答的问题

1. 一次 `query()` 调用的 `State` 保存哪些跨迭代信息？
2. 哪些分支会在 `queryLoop()` 内继续，哪些会增加 `turnCount`？
3. `Terminal` 如何从循环返回给 `query()` 的调用方？

## 一次调用与多次迭代

`query()` 把参数交给 `queryLoop()`，并等待它正常返回一个 `Terminal`。`queryLoop()` 在进入 `while (true)` 前建立初始 `State`。每轮循环开始时从 `state` 解构出本轮要使用的消息、工具上下文、压缩跟踪、恢复计数、预算续行标记和 turn 计数。

循环里可能多次调用模型，但这不等于外层状态机已经进入下一轮。只有分支构造新 `State` 后执行 `continue`，或走到工具处理末尾把 `state` 替换后自然回到 `while` 顶部，才开始下一次外层迭代。

~~~mermaid
flowchart TD
  A[query(params)] --> B[queryLoop 初始化 State]
  B --> C[外层 while 读取 State]
  C --> D[准备上下文并请求模型]
  D --> E{需要工具跟进?}
  E -- 否 --> F{恢复、Hook 或预算要求继续?}
  F -- 是 --> G[替换 State 并 continue]
  G --> C
  F -- 否 --> H[返回 Terminal]
  E -- 是 --> I[执行工具并收集结果]
  I --> J{中断、Hook 停止或达到 maxTurns?}
  J -- 是 --> H
  J -- 否 --> K[turnCount 加一并保存下一轮 State]
  K --> C
~~~

## `State` 保存什么

| 类别 | 字段 | 状态机中的作用 |
| --- | --- | --- |
| 对话与执行环境 | `messages`、`toolUseContext` | 下一轮模型请求的消息和工具执行上下文 |
| 压缩与输出恢复 | `autoCompactTracking`、`maxOutputTokensRecoveryCount`、`hasAttemptedReactiveCompact`、`maxOutputTokensOverride` | 避免恢复过程丢失进度或重复尝试 |
| 延迟结果与 Hook | `pendingToolUseSummary`、`stopHookActive` | 把摘要 Promise 或 Hook 续行状态带到后续迭代 |
| 循环控制 | `turnCount`、`transition` | 计数工具驱动的下一 turn，并标记上一轮因何继续 |

`State` 只覆盖一部分跨迭代数据。例如 `taskBudgetRemaining`、`budgetTracker` 和一次调用的 `QueryConfig` 是 `queryLoop()` 内的局部变量；`pendingMemoryPrefetch` 则在整个生成器调用期间保留。读循环时要同时看它们的作用域，不能把所有延续状态都归到 `State`。

## 两种继续方式

源码里有 7 个把新状态交回外层 `while` 的位置。前 6 个是同一 turn 内的恢复或续写，`turnCount` 保持不变；工具结果路径则把完整对话增量写入下一轮状态并递增计数。

| `transition.reason` | 触发条件 | 主要状态变化 | `turnCount` |
| --- | --- | --- | --- |
| `collapse_drain_retry` | 被暂缓的 413 错误可由 context collapse 排空 | 使用排空后的消息；清除输出上限覆盖和待发送摘要 | 不变 |
| `reactive_compact_retry` | 被暂缓的 413/媒体错误可由 reactive compact 恢复 | 使用压缩后消息，标记已尝试 reactive compact，清除压缩跟踪 | 不变 |
| `max_output_tokens_escalate` | 输出上限错误且允许把上限升级重试 | 保留请求消息，设置更高的 `maxOutputTokensOverride` | 不变 |
| `max_output_tokens_recovery` | 输出上限恢复次数未达到上限 | 追加 assistant 输出及提示继续完成的 meta 消息；恢复计数加一 | 不变 |
| `stop_hook_blocking` | Stop Hook 返回阻止继续的错误 | 追加 assistant 输出和 Hook 错误；将 Hook 标记为 active | 不变 |
| `token_budget_continuation` | token budget 决策要求模型继续 | 追加 assistant 输出和预算提示；重置本轮恢复标记 | 不变 |
| `next_turn` | 模型请求产生工具调用且工具处理后允许继续 | 合并 assistant 消息、工具结果和更新后的工具上下文 | 加一 |

这些理由说明“为什么下一次迭代会发生”，不是完整的转移类型定义。`query.ts` 里 `transition` 的可见用途包括阻止 context collapse 在同一 413 恢复链中重复排空；源码注释还说明它可供测试断言恢复路径。

## 终止结果从哪里返回

循环在特定分支以 `return { reason: ... }` 结束，而不是继续替换 `State`。当前 `query.ts` 可见的终止原因包括：

- 请求前发现阻塞 token 上限：`blocking_limit`。
- 模型调用或流处理中发生不可恢复问题：`image_error`、`model_error`、`aborted_streaming`。
- 上下文错误无法恢复：`prompt_too_long`，或媒体输入错误 `image_error`。
- 无需再跟进、API 错误消息已交付、Stop Hook 阻止继续：`completed`、`stop_hook_prevented`。
- 工具阶段中断、Hook 要求停止、达到调用方给定 turn 上限：`aborted_tools`、`hook_stopped`、`max_turns`。

这里的 `completed` 表示 Query 按该分支结束；例如 API 错误消息分支也会返回 `completed`，所以不能单凭这个字符串推断模型请求成功。正常返回后，外层 `query()` 才发送已消费命令的 completed 生命周期事件；异常传播或消费者提前关闭生成器不走该收尾。

`Terminal` 和 `Continue` 从 `src/query/transitions.js` 类型导入，但该文件不在当前源码快照中。本课因此按 `query.ts` 实际可见的迁移赋值和 `return` 分支归纳，不声称列出缺失类型声明中可能包含的全部变体。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '203,239p;241,321p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '630,650p;1060,1185p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '1185,1358p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '1484,1522p;1673,1728p'
~~~

## 观察结果

`queryLoop()` 是一个以 `State` 替换和外层 `while` 为核心的迭代器。恢复、Hook 阻塞和预算续写可以让 Query 在同一 turn 内重试；工具结果路径会把对话与执行上下文推进到下一 turn。错误、取消、策略停止和 `maxTurns` 条件通过 `Terminal` 结束本次调用。内部模型回退循环与外层 `State` 迁移是不同层次。

## 简化与限制

- `transition` 只标记外层循环继续原因；模型流内部的 fallback、API 重试等不应自动算作一次外层状态迁移。
- 本课按 `query.ts` 可见分支整理终止原因。由于当前源码快照缺少 `src/query/transitions.js`，无法核对 `Terminal`、`Continue` 的完整类型联合。
- 结论来自静态源码阅读；没有运行 Query、模型流或测试，也不代表目标 CLI 的运行时验收。
