# 第 16 课：流式消息消费与 UI 事件

**目标：** 追踪 Query 生成器交出的流事件、完成消息和工具结果，观察 REPL 如何把它们分别送入临时流状态或会话消息状态。本课不展开 API 请求构造和工具执行实现。

## 本课要回答的问题

1. `queryLoop()` 如何同时转发模型流输出并积累后续需要的 assistant/tool 状态？
2. `handleMessageFromStream()` 怎样把原始流事件转成响应文字、thinking 和工具输入状态？
3. REPL 如何区分追加、替换、压缩边界和 tombstone 消息？

## 两条并行路径：流状态与会话消息

REPL 在 `for await` 中逐个消费 `query()` 的输出并调用 `onQueryEvent()`。其中 `StreamEvent` 更新短暂的流式显示状态；完成的 `Message` 进入 REPL 的会话消息数组。若 assistant 消息带有 `tool_use`，`queryLoop()` 还会记录工具调用并准备后续执行。

~~~mermaid
flowchart TD
  A[queryModelWithStreaming 输出] --> B[queryLoop 消费]
  B -->|StreamEvent| C[query yield]
  B -->|AssistantMessage / API error| D[query yield 并积累内部状态]
  B -->|工具结果 / 其他 Message| E[query yield 并准备后续上下文]
  C --> F[REPL onQueryEvent]
  D --> F
  E --> F
  F --> G[handleMessageFromStream]
  G -->|流事件| H[响应文字 / thinking / 工具输入临时状态]
  G -->|完整消息| I[REPL messages 数组]
  D --> J{含 tool_use?}
  J -- 是 --> K[标记 needsFollowUp 并收集 tool_use]
  K --> L[工具处理后把结果归一化为 API user message]
~~~

## Query 如何边转发边收集

每轮模型请求前，`queryLoop()` 建立本轮的 `assistantMessages`、`toolResults` 和 `toolUseBlocks`。它从 `deps.callModel()` 逐条读取输出：可见消息会 `yield` 给调用方；assistant 消息同时进入内部列表，发现 `tool_use` 时记录 tool block 并设置 `needsFollowUp`。如果启用了 streaming tool executor，完整 tool block 到达后会加入执行队列，已完成的结果也可在模型流尚未全部结束时 yield。

因此输出给 REPL 的消息流与下一次 API 请求使用的内部历史是相互关联、但不完全相同的两份数据。遇到流式回退时，Query 可以先发 `tombstone` 移除失败尝试的 assistant 消息；恢复用的错误消息也可能先被 withholding，不立即展示，但仍留在 Query 内部状态供恢复判断。工具执行顺序和外层续跑条件见第 17 课。

工具结果在交给界面显示的同时，会通过 `normalizeMessagesForAPI()` 转成 API 需要的 user 消息并加入 `toolResults`。`normalizeMessagesForAPI()` 也负责过滤 display-only 的虚拟消息、progress 等非对话记录；所以 UI 消息数组不能直接当作下一次模型请求正文。

## `handleMessageFromStream()` 的分流

`REPL.tsx` 的 `onQueryImpl()` 对 Query 使用 `for await`，每个事件进入 `onQueryEvent()`；后者调用 `utils/messages.ts` 的 `handleMessageFromStream()`，将操作分别委托给消息数组、响应长度、stream mode、局部工具输入、thinking、API 指标和 tombstone 回调。

| 输入 | 即时处理 |
| --- | --- |
| `stream_request_start` | 将 stream mode 设为 `requesting` |
| `message_start` 的 `StreamEvent` | 若携带 `ttftMs`，记录首 token 延迟指标 |
| `content_block_start` | 设置 thinking、responding 或 tool-input 模式；tool_use 时建立按 block index 跟踪的临时输入 |
| `content_block_delta` | text delta 更新可见流式文本和长度；JSON delta 追加到对应工具输入；thinking delta 更新响应长度 |
| `message_stop` | 切换到 tool-use 模式并清空未完成工具输入的临时显示 |
| 完成的普通 `Message` | 清空临时流式文本，再交给 REPL 追加到会话消息数组；完整 thinking block 可更新 thinking 状态 |
| `tombstone` | 调用删除回调，从 REPL 消息数组和 transcript 中移除目标消息 |

API 的 `content_block_stop` 流事件在这个 handler 中不单独追加内容；完成的 assistant 消息由 Query 同一消费链另行 yield。这样文字 delta 可以先显示在临时状态，完成消息到达时再切换为会话消息，避免重复显示或空白间隙。

## REPL 如何更新持久消息

`onQueryEvent()` 的消息回调不是一律追加：

- compact boundary 在普通终端模式下替换当前消息数组；全屏模式保留受限的压缩前滚动历史，并更新 `conversationId` 使行组件重新挂载。
- ephemeral tool progress 会替换末尾同一工具、同一类型的 progress 记录，避免高频 tick 不断增长消息数组。
- 其他完整消息追加到 `messages`。
- tombstone 则从消息数组和 transcript 删除目标消息。

`handleMessageFromStream()` 还会忽略 SDK-only 的 `tool_use_summary`，并在 API 错误消息到达时通过 REPL 回调屏蔽主动 tick；这些控制状态和普通可见对话消息并非同一类事件。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/query.ts | sed -n '551,560p;659,708p;709,863p;1380,1409p'
nl -ba AI/claude-code-analysis-main/src/utils/messages.ts | sed -n '2930,3095p;1989,2001p;2056,2105p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '2584,2660p;2793,2803p'
~~~

## 观察结果

同一 Query 输出在 REPL 中会走两类路径：原始流事件驱动临时 UI 状态，完整消息更新会话消息数组；Query 自身另外积累 assistant 消息、工具调用和归一化后的工具结果来准备后续请求。Tombstone、compact boundary 和 ephemeral progress 则体现消息生命周期中的删除、重置与替换。

## 简化与限制

- 本课观察 REPL 主线程消费链；SDK 消费者、Agent 子界面或其他 `query()` 调用方可能采用不同的事件处理方式。
- 工具的权限判断、执行并发、tool_result 配对和下一 turn 决策不在本课展开。
- 结论来自静态源码阅读；没有运行 REPL、终端渲染或 transcript 写入测试。
