# 第 24 课：工具并发与流式执行

**目标：** 对照批量工具执行与流式到达时的队列执行，说明哪些调用可并发、互斥工具如何形成屏障，以及进度、结果和上下文更新何时回传。

## 本课要回答的问题

1. `isConcurrencySafe(input)` 如何决定工具调用能否并发？输入解析或判断失败时如何处理？
2. `runTools()` 怎样把调用分组、限制并发，并处理 context modifier？
3. `StreamingToolExecutor` 怎样边接收 tool_use 边启动工具，并单独交付 progress 和最终结果？
4. 流式路径如何处理 Bash 错误、用户中断和模型回退？

## 两条工具执行路径

~~~mermaid
flowchart TD
  A[assistant 返回 tool_use] --> B{streamingToolExecution gate}
  B -->|关闭| C[收集完整 tool_use 列表]
  C --> D[runTools / partitionToolCalls]
  D --> E[连续 safe 调用组成一批]
  D --> F[每个非 safe 调用独占一批]
  E --> G[all 并发运行，最多取配置上限]
  F --> H[runToolsSerially 顺序运行]
  B -->|开启| I[StreamingToolExecutor.addTool]
  I --> J[queued → executing → completed → yielded]
  J --> K[progress 单独缓冲并尽快发出]
  J --> L[最终消息完成后按队列规则发出]
  G --> M[归一化 tool_result 并回到 Query]
  H --> M
  L --> M
~~~

两条路径都调用第 23 课里的 `runToolUse()`。`runTools()` 面向已经收集完的一组调用；`StreamingToolExecutor` 则由 `query.ts` 在模型流中发现 tool_use 时逐个登记，并在后续消息到来时尝试发出已完成结果。

## 并发资格是“按调用输入”判断

`Tool` 接口要求工具实现 `isConcurrencySafe(input)`。它与 `isReadOnly(input)` 是两个独立方法，编排器实际读取前者；安全判断可能依赖参数。比如 FileRead 始终返回 `true`，Bash 则把自己的并发判断委托给 `isReadOnly(input)`。

找到工具定义时，两条路径都会先对当前输入运行 `inputSchema.safeParse()`，只把解析成功的数据交给 `isConcurrencySafe()`。Schema 解析失败或判断函数抛错，都不会获得并发资格，按互斥调用处理。找不到工具定义时两条路径不同：`runTools()` 把它归入非 safe batch，再交由 `runToolUse()` 返回未知工具错误；流式 `addTool()` 则直接登记一条已完成的合成错误结果。这个预解析用于选择调度方式；真正的输入校验和工具执行仍由 `runToolUse()` 完成。

因此，“同一个工具”不一定总在同一类批次：Bash 的只读命令可以进入 safe 并发组，写入或无法安全解析的命令则单独运行。这里不展开只读命令怎样判定，留给 Bash 专题。

## 完整响应路径：连续 safe 调用并发，其他调用串行

`partitionToolCalls()` 按模型给出的调用顺序扫描列表：

- 连续的 safe 调用合并为一个 batch；遇到非 safe 调用就结束当前 batch。
- 每个非 safe 调用单独形成一个 batch，所以它前后的 safe 调用不会跨过它合并。
- `runTools()` 按 batch 顺序处理。safe batch 通过 `all()` 并发运行，非 safe batch 经 `runToolsSerially()` 逐个调用。

`all()` 同时推进多个异步生成器，哪个生成器先产出，哪个更新就先向外 yield。因此 safe batch 的进度和结果可以交错到达。并发上限由 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` 提供，代码使用 `parseInt(...) || 10`；未设置、无法解析或值为 0 时回退为 10，源码没有把负数归一为正数。batch 全部结束后，`runTools()` 才把收集到的 context modifier 按原始 tool_use 顺序应用，并 yield 一次新的上下文。互斥路径则在每个工具返回更新时应用 context modifier；下一项工具以更新后的上下文启动。

这个上下文时序是并发边界的一部分：safe batch 中的调用共享该 batch 开始时的 `currentContext`，其 modifier 不会在 batch 运行途中影响同组的其他调用。

## 流式路径：登记即排队，符合门槛就启动

`query.ts` 根据 `config.gates.streamingToolExecution` 创建 `StreamingToolExecutor`。模型流产生包含 `tool_use` 的 assistant message 后，Query 对每个 block 调用 `addTool()`；此时 `runToolUse()` 可在模型后续消息仍在接收时开始工作。每条流式消息处理后，Query 调用 `getCompletedResults()` 检查可交付内容；流结束或中断时再调用 `getRemainingResults()` 等待剩余工作。

执行器为每项调用记录 `queued`、`executing`、`completed`、`yielded` 状态。`canExecuteTool()` 的门槛是：

| 当前执行中的调用 | 新调用 | 可否启动 |
| --- | --- | --- |
| 没有 | safe 或非 safe | 可以 |
| 全是 safe | safe | 可以与它们并行 |
| 有任意非 safe | 任意新调用 | 不可以 |
| 有 safe | 非 safe | 等现有 safe 完成，再独占执行 |

`processQueue()` 按登记顺序扫描。遇到暂时不能启动的非 safe 项会停止扫描，避免后续调用越过互斥边界；暂时不能启动的 safe 项不会终止扫描。和完整响应路径不同，这个类的队列门槛没有显式使用 `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`；可见实现仅按 safe / exclusive 状态决定能否启动。

## 进度和最终结果走不同队列

`executeTool()` 消费 `runToolUse()` 的更新时，把 `progress` 消息放进该工具自己的 `pendingProgress`，把其他消息留在 `results`，直到这次工具执行完成才将状态标成 `completed`。收到 progress 时会唤醒 `getRemainingResults()` 的等待；等待同时竞速执行 Promise 和 progress 通知，所以长工具可以先报告进度，而不必等最终结果。

`getCompletedResults()` 会先排出 pending progress，再扫描已登记工具并发出完成结果。执行中的 safe 工具不会阻断后续 safe 工具的完成结果；执行中的非 safe 工具会阻断其后的结果。因此进度能先于结果展示，safe 调用的最终消息也可能按完成情况先后交付，而互斥调用维持其前后的结果屏障。注意：类头注释概括为按接收顺序发结果，但 `getCompletedResults()` 只在遇到执行中的非 safe 调用时停止扫描；safe 调用之间不保证严格按输入顺序提交。

流式执行器会收集 context modifier，但源码明确没有支持并发 safe 工具的 modifier 应用；只有非 safe 调用完成时，modifier 才会更新执行器上下文。完整响应路径则会在 safe batch 完成后按 tool_use 顺序应用 modifier。这是两种路径目前可观察到的差异。

## 错误、中断与模型回退

流式执行器检查每个工具返回的 user `tool_result` 是否带 `is_error: true`。其中只有 Bash 错误会触发 sibling fail-fast：记录出错命令描述，并以 `sibling_error` 中止子控制器，让并发中的兄弟调用尽快停止。错误调用本身已有错误结果时，不会再收到重复的合成 sibling 错误。其他工具失败不会触发这条 Bash 专用的连锁取消。

用户中断会结合工具的 `interruptBehavior()` 决定是否为该调用合成拒绝结果；默认行为为 `block`。执行器还区分三种合成结果原因：用户中断、并发 Bash 兄弟错误、流式回退丢弃。Query 在回退时对旧执行器调用 `discard()` 并创建新的执行器，避免旧尝试的 tool_result 混入新模型响应；中断路径则必须消费剩余结果，以便每个已产生的 tool_use 都有匹配的 tool_result。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/Tool.ts | sed -n '394,410p'
nl -ba engine/claude-code-analysis-main/src/tools/BashTool/BashTool.tsx | sed -n '434,441p'
nl -ba engine/claude-code-analysis-main/src/tools/FileReadTool/FileReadTool.ts | sed -n '367,378p'
nl -ba engine/claude-code-analysis-main/src/services/tools/toolOrchestration.ts | sed -n '8,116p;118,188p'
nl -ba engine/claude-code-analysis-main/src/utils/generators.ts | sed -n '31,70p'
nl -ba engine/claude-code-analysis-main/src/services/tools/StreamingToolExecutor.ts | sed -n '19,151p;153,260p;262,405p;407,530p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '550,569p;730,740p;825,860p;909,919p;1011,1029p;1380,1409p'
~~~

## 观察结果

- 并发是工具对每次输入的显式判断；解析或判断失败走保守互斥路径，不能只凭工具名称推断 safe。
- 完整响应路径先分组，再逐批运行：连续 safe 调用并发，互斥调用独占；safe batch 的 context modifier 在组结束后按输入顺序提交。
- 流式路径在 tool_use 到达时就登记并启动，progress 单独尽快发送，最终结果在工具完成后缓冲交付。
- 两条路径的上下文更新及并发上限实现不同；流式队列还提供 Bash sibling fail-fast 与回退丢弃处理。

## 范围与限制

- 本课只比较两种调度器的并发、结果与上下文边界；单次工具的输入校验、权限和结果映射见第 23 课。
- Bash 只读命令的安全分析、工具取消界面和 Query 后续模型请求不在本课展开。
- 结论来自当前源码快照静态阅读；未运行 CLI，也未验证各 feature gate 或工具组合下的运行时并发。
