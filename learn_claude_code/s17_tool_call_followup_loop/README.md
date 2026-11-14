# 第 17 课：工具调用后的模型续跑

**目标：** 从 assistant 消息中的 `tool_use` 跟到工具执行结果，再回到 Query 的下一次模型请求。本课聚焦调用闭环和续跑条件；权限规则与工具内部实现留到后续专题。

## 本课要回答的问题

1. Query 如何判断本轮需要执行工具？
2. 流式执行和响应完成后执行分别在哪里接入？
3. `tool_result` 怎样配对回传，什么条件会阻止下一次模型请求？

## `tool_use` 才是闭环入口

每轮模型调用期间，`queryLoop()` 收集 assistant 消息，并检查其内容块中的 `tool_use`。只要出现该 block，Query 就记录 `ToolUseBlock` 并设 `needsFollowUp = true`。源码注释特别指出 `stop_reason === 'tool_use'` 不可靠，因此外层循环根据实际内容块，而非单独依赖 stop reason 来决定是否执行工具。

~~~mermaid
flowchart TD
  A[模型返回 assistant 消息] --> B{内容含 tool_use?}
  B -- 否 --> C[走普通完成 / Hook / 预算分支]
  B -- 是 --> D[记录 ToolUseBlock，needsFollowUp=true]
  D --> E{streaming tool execution 开启?}
  E -- 是 --> F[StreamingToolExecutor 收到完整工具块后排队]
  E -- 否 --> G[响应流结束后调用 runTools]
  F --> H[canUseTool 权限决策与 runToolUse]
  G --> H
  H --> I[成功或拒绝都形成对应 tool_result 消息]
  I --> J[Query yield 消息并归一化为 API user result]
  J --> K{中断 / Hook 停止 / maxTurns?}
  K -- 是 --> L[结束当前 Query]
  K -- 否 --> M[合并消息和上下文，turnCount + 1]
  M --> N[外层 Query 再次请求模型]
~~~

## 两种工具执行接法

| 接法 | 何时开始 | Query 怎样收结果 |
| --- | --- | --- |
| `StreamingToolExecutor` | gate 开启时，完整 `tool_use` 消息块到达后加入队列；模型还在输出时，已完成结果和 progress 可先被取出 | 每次模型输出后用 `getCompletedResults()` 收集可用结果；流结束后用 `getRemainingResults()` 等待剩余工具 |
| `runTools()` | gate 关闭时，等模型流结束后一次传入已收集的 `toolUseBlocks` | 遍历 `MessageUpdate`，逐条 yield 结果并更新 `ToolUseContext` |

两条接法都把工具调用交给 `runToolUse()`，并传入 `canUseTool` 与 `ToolUseContext`。`runTools()` 会按工具声明的并发安全性分组处理调用；并发组运行后续接下一组，不能并发的调用按顺序执行。这里仅标出编排边界，并发分组细节留到第 24 课。

## 权限决策、执行与配对结果

`runToolUse()` 先按名称定位当前工具，再沿 Hook 与权限决策路径调用 `canUseTool`。获准后执行工具并用工具自己的结果映射函数构造 `tool_result`；结果块中的 `tool_use_id` 与 assistant 请求块的 ID 相同。拒绝或工具不存在也可以生成带 `is_error: true` 的 tool result，让 Query 将结果交给模型处理。权限模式、Hook 顺序和工具实现不在本课展开。

工具执行通过 `MessageUpdate` 逐步产生消息和可选的新上下文。Query 会把消息 yield 给调用方；随后通过 `normalizeMessagesForAPI()` 转换为 API 可用的 user 消息，并加入本轮 `toolResults`。因此一个 tool use 的闭环是 assistant `tool_use`，接着是配对的 user `tool_result`，然后才可能出现下一次 assistant 响应。

## 下一次请求前的续跑决策

工具处理结束后，Query 先检查取消信号和 Hook 是否要求停止。取消返回 `aborted_tools`；遇到 `hook_stopped_continuation` attachment 则返回 `hook_stopped`。正常路径还可能把队列通知、预取 memory/skills 等附件加进 `toolResults`，并在下一轮前刷新当前工具列表。

最后，Query 计算 `nextTurnCount = turnCount + 1`。若超过调用方给定的 `maxTurns`，会 yield `max_turns_reached` attachment 并返回终止结果；否则新 `State` 合并原请求消息、assistant 工具调用消息和 tool results，带上更新后的工具上下文和下一 turn 计数，再回到 `while` 顶部请求模型。此处的计数推进构成工具调用闭环的下一次 Query 迭代。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/query.ts | sed -n '551,568p;827,862p;1360,1409p;1484,1522p;1673,1728p'
nl -ba AI/claude-code-analysis-main/src/services/tools/toolOrchestration.ts | sed -n '14,82p;91,115p;118,177p'
nl -ba AI/claude-code-analysis-main/src/services/tools/toolExecution.ts | sed -n '337,410p;915,930p;995,1071p;1206,1222p;1290,1295p;1403,1473p'
nl -ba AI/claude-code-analysis-main/src/services/tools/StreamingToolExecutor.ts | sed -n '34,76p;104,124p;407,489p'
~~~

## 观察结果

Query 以 assistant 内容中的 `tool_use` block 决定是否跟进，而不是只读 API stop reason。工具执行层通过 `canUseTool` 做授权决策并运行具体工具，把成功、拒绝或缺失工具等结果整理成与调用 ID 配对的 `tool_result`。Query 收集结果、处理停止条件并更新下一轮状态，使同一 `query()` 调用能够继续发起下一次模型请求。

## 简化与限制

- 本课只追踪 Query 与工具编排的闭环，不覆盖各工具的参数 Schema、权限规则、Hooks 细节或副作用。
- StreamingToolExecutor 的并发调度与 `runTools()` 的安全分组只按接口说明；并发细节见第 24 课。
- 结论来自静态源码阅读；没有执行工具、调用模型或运行测试。
