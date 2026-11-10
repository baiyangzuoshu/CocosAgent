# 第 29 课：端到端追踪与测试接缝

**目标：** 以交互式 REPL 中的一条普通文本输入为例，从 CLI 启动一路追到模型最终消息；沿途辨认消息、循环状态、工具结果和可替换依赖各自经过的边界。

## 本课要回答的问题

1. 默认 CLI 路径怎样把进程带到 REPL？
2. 用户输入如何变成传入 `query()` 的消息与工具上下文？
3. 模型流、工具调用和工具结果如何汇合成下一轮请求？
4. Query 的输出流和结束返回值分别是什么？REPL 怎样消费它们？
5. `QueryDeps` 提供哪些测试替换点，又有哪些执行环节仍在边界之外？

## 一条普通输入的主链

本课只跟踪交互 REPL 的普通 prompt：不展开 Print、SDK、Remote、子 Agent、斜杠命令或 Bash 快捷输入。它们会在入口、上下文或终止路径上分叉。

~~~mermaid
flowchart TD
  A[CLI argv] --> B[entrypoints/cli.tsx]
  B -->|普通默认路径| C[动态导入 main.tsx]
  C --> D[Commander 默认 action]
  D --> E[launchRepl: App 包装 REPL]

  U[用户提交文本] --> F[REPL onSubmit]
  F --> G[handlePromptSubmit]
  G --> H[executeUserInput / processUserInput]
  H --> I[newMessages + shouldQuery]
  I --> J[REPL onQuery: guard 与消息追加]
  J --> K[onQueryImpl: ToolUseContext 和上下文]
  K --> L[query(params)]

  L --> M[queryLoop 初始化 State 与 QueryDeps]
  M --> N[microcompact / autocompact]
  N --> O[deps.callModel: 模型流]
  O --> P{assistant 是否包含 tool_use?}
  P -->|否| Q[停止 Hook / Terminal]
  P -->|是| R[runTools 或 StreamingToolExecutor]
  R --> S[runToolUse: 校验、权限、Hook、tool.call]
  S --> T[tool_result Message + 更新后的 Context]
  T --> V[写入下一轮 State]
  V --> N

  O -. stream_event / assistant Message .-> W[REPL onQueryEvent]
  R -. progress / result Message .-> W
  W --> X[handleMessageFromStream]
  X --> Y[React 消息与流式 UI]
  Q -. query 正常结束 .-> Z[onQuery finally / turn cleanup]

  TEST[测试可替换 deps] -.-> M
~~~

## 从进程入口走到输入处理

`entrypoints/cli.tsx` 会先处理若干快速分支；普通 CLI 路径动态导入 `main.tsx` 并调用其 `main()`。Commander 默认 action 完成初始化后调用 `launchRepl()`；`replLauncher.tsx` 动态加载 `App` 和 `REPL`，再交给 Ink renderer 渲染。

用户提交文本后，REPL 等待首轮 Hook 上下文就绪，再调用 `handlePromptSubmit()`。它把直接输入包装成 `QueuedCommand`，统一送到 `executeUserInput()`；该函数处理命令和输入内容，得到 `newMessages`、`shouldQuery` 等结果，再调用 REPL 传入的 `onQuery`。本课选择普通文本的 `shouldQuery === true` 路径；本地命令可以只改 UI 或本地状态而不进入模型 Query。

`onQuery()` 先用 `queryGuard` 防止并发 Query，再把新消息追加到 REPL 会话消息，最后进入 `onQueryImpl()`。后者从当前状态重新计算工具和 MCP 客户端，准备系统提示、用户上下文、系统上下文与 `ToolUseContext`，然后将完整参数交给 `query()`。因此，提交输入后看到的 `messages`、Query 循环里的 `State.messages` 和发给 API 的归一化消息是相关但不同的视图。

## Query 里发生什么

`query()` 是异步生成器。它把循环交给 `queryLoop()`；`queryLoop()` 以消息和工具上下文建立 `State`，随后每轮执行消息压缩、预算和错误恢复逻辑，再调用 `deps.callModel()` 消费模型流。

模型流中的 `StreamEvent` 用于流式展示；完整 assistant 消息也会从生成器向外产出。若 assistant 内容含 `tool_use`，Query 收集这些块并进入工具阶段：普通路径调用 `runTools()`，流式执行已启用时则读取 `StreamingToolExecutor` 的结果。`runToolUse()` 找工具、验证输入并沿权限与 Hook 路径处理后调用 `tool.call()`。它产出的工具结果消息带有对应的 `tool_use_id`，Query 把可回灌的 user 消息形式结果归一化后放进 `toolResults`，同时接收更新后的 `ToolUseContext`。

有工具结果且允许续跑时，Query 把前轮消息、assistant 消息、工具结果和新上下文写入下一份 `State`，`turnCount` 加一，再次调用模型。没有需要跟进的工具时，Query 收束当前分支并返回 `Terminal`；取消、Hook 阻止续跑、错误和 `maxTurns` 也会产生不同结束原因。外层 Query 只有在 `queryLoop()` 正常返回时才发送已消费命令的 completed 生命周期通知；异常传播或生成器被提前关闭不会走这段收尾。

REPL 用 `for await...of query(...)` 消费生成出来的流事件与消息，并把它们交给 `onQueryEvent()`。后者调用 `handleMessageFromStream()`：流事件更新流式文本、工具进度或 spinner，完整消息追加到 React 消息列表，tombstone 则移除对应消息。注意 `for await...of` 不读取异步生成器的最终返回值；此处 REPL 依赖迭代正常结束进入后续清理，而不是接收 `Terminal` 对象。

## 数据经过哪些边界

| 边界 | 主要内容 | 用途 |
| --- | --- | --- |
| REPL 消息列表 | 用户、assistant、tool result、progress 等会话消息 | UI 展示、会话历史和提交下一轮输入 |
| `QueryParams` | 当前消息、系统/用户上下文、权限回调、工具上下文、循环限制、可选 `deps` | 一次 Query 的输入快照 |
| Query `State` | 循环中的消息、`ToolUseContext`、恢复计数、Hook 状态、`turnCount`、`transition` | 跨外层迭代保存和替换的状态 |
| Query yield | stream event、完整消息、tombstone、工具摘要等 | REPL 或其他消费者逐步观察执行过程 |
| Query return | `Terminal` 结束原因 | 直接消费生成器返回值的调用方可读取；REPL 的 `for await` 不读取它 |

## Query 的测试接缝

`QueryParams.deps` 是显式依赖注入点。没有传入覆盖时，`queryLoop()` 使用 `productionDeps()`；测试可传入与真实函数类型一致的替代实现：

| 依赖 | 生产实现 | 可隔离观察的部分 |
| --- | --- | --- |
| `callModel` | `queryModelWithStreaming` | 注入可控的模型事件、assistant 消息或 API 错误，不发真实模型请求 |
| `microcompact` | `microcompactMessages` | 控制微压缩对消息的影响 |
| `autocompact` | `autoCompactIfNeeded` | 控制自动压缩结果与恢复分支 |
| `uuid` | `randomUUID` | 让追踪与轮次 ID 可预测 |

另一个观察点是 `State.transition`：源码注释说明它用于让测试断言 Query 走过哪种继续路径，而不用只检查消息文本。`query()` 的异步生成器输出和 `Terminal` 也让调用方分别观察中间事件与正常终止结果。

这不是完整的依赖隔离层。`QueryDeps` 当前只有四项；它的注释明确把 `runTools`、`handleStopHooks`、`logEvent` 和队列操作留作以后可能加入的依赖。因此测试 Query 状态机时仍可能经过真实工具编排、Hook 或事件记录逻辑，除非在这些模块另设隔离手段。`canUseTool` 是 `QueryParams` 输入而非 `QueryDeps` 项，可由调用方提供受控权限回调。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/entrypoints/cli.tsx | sed -n '287,299p'
nl -ba engine/claude-code-analysis-main/src/main.tsx | sed -n '3797,3808p'
nl -ba engine/claude-code-analysis-main/src/replLauncher.tsx | sed -n '12,22p'
nl -ba engine/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '2584,2640p;2661,2803p;2855,2930p;3488,3519p'
nl -ba engine/claude-code-analysis-main/src/utils/handlePromptSubmit.ts | sed -n '120,171p;356,386p;396,470p;540,575p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '175,239p;241,280p;337,365p;412,468p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '650,735p;823,835p;1262,1285p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '1360,1409p;1500,1522p;1714,1728p'
nl -ba engine/claude-code-analysis-main/src/query/deps.ts | sed -n '6,40p'
nl -ba engine/claude-code-analysis-main/src/services/api/claude.ts | sed -n '752,779p'
nl -ba engine/claude-code-analysis-main/src/services/tools/toolOrchestration.ts | sed -n '19,82p;118,150p'
nl -ba engine/claude-code-analysis-main/src/services/tools/toolExecution.ts | sed -n '337,410p;599,680p;916,1005p;1206,1222p'
nl -ba engine/claude-code-analysis-main/src/utils/messages.ts | sed -n '2930,3005p'
~~~

## 观察结果

- 用户输入由 REPL 预处理成消息和 Query 参数；Query 自己再管理跨模型请求的循环状态。
- 模型的流式事件和完整消息是 Query 的逐步输出；工具结果会被归一化、并入下一轮消息后续跑。
- REPL 消费 yield 并更新消息/UI；它不读取 `for await...of` 背后的 `Terminal` 返回值。
- `QueryDeps` 给模型请求、两类压缩和 UUID 提供替换点；工具编排、Hook 与事件记录不属于这组依赖。

## 范围与限制

- 主链按普通交互文本输入追踪；斜杠命令、本地命令、Print/SDK、Remote、Agent fork、StreamingToolExecutor 的内部队列和完整恢复矩阵属于其他分支。
- 当前目录是静态源码快照，没有 `package.json` 构建入口，且本快照未包含可运行的测试套件。本课没有运行测试或 CLI，测试接缝结论只描述源码接口与注释。
