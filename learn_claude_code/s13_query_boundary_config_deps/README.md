# 第 13 课：`query()` 的边界、配置与依赖

**目标：** 看清调用方传给 `query()` 的一轮请求数据、内部一次性配置快照和可替换依赖之间的边界；本课只跟到循环入口，不展开 Query 状态机。

## 本课要回答的问题

1. REPL 与 `QueryEngine` 怎样组装 `QueryParams`？
2. `query()` 作为异步生成器向外提供什么？
3. `QueryConfig` 从进程和会话状态中快照什么，为什么不包含编译期 feature gate？
4. `QueryDeps` 替换了哪些依赖，又有哪些工作仍直接调用其他模块？

## 两个调用方，共用一份 QueryParams

REPL 与 `QueryEngine` 都调用 `query()`。它们把当前消息、有效 system prompt、两种 context、权限回调和 `ToolUseContext` 显式传入；来源和可选控制参数按运行路径提供。例如 REPL 用 `getQuerySourceForREPL()`，SDK 路径传入 `querySource: 'sdk'`、`maxTurns` 和 `taskBudget`。

`QueryParams` 可按用途分成四组：

| 参数组 | 字段 | 边界 |
| --- | --- | --- |
| 本轮输入 | `messages`、`systemPrompt`、`userContext`、`systemContext` | 表达这一轮模型工作所需的对话与上下文 |
| 工具执行上下文 | `canUseTool`、`toolUseContext` | 提供权限判断及工具运行所需的当前环境 |
| 运行控制 | `fallbackModel`、`querySource`、`maxOutputTokensOverride`、`maxTurns`、`skipCacheWrite`、`taskBudget` | 控制此轮的来源、限制和可选预算 |
| 依赖覆盖 | `deps` | 可选地替换 Query 明确声明的 I/O 依赖 |

两种 context 具体如何加入模型请求，见第 10 课；消息的 UI 归一化和 API 归一化见第 11 课。这里关注它们作为调用方输入进入 `query()` 的接口边界。

## 异步生成器的外部契约

`query()` 是异步生成器。消费期间，它可以 yield stream events、请求开始事件、消息、tombstone 和工具使用摘要；正常结束时返回 `Terminal`。REPL 和 `QueryEngine` 通过 `for await` 消费这些逐步产生的事件。

导出层还包了一层命令生命周期处理：它先创建本次调用自己的 `consumedCommandUuids`，再把事件流委托给内部 `queryLoop()`。只有内部循环正常返回后，才逐个发送 command completed 通知；异常向外传播或消费者提前关闭生成器时，这段正常完成处理不会执行。因而外部边界既传递事件，也负责成功结束时的收尾。

~~~mermaid
flowchart TD
  A[REPL] --> P[QueryParams]
  B[QueryEngine] --> P
  P --> Q[query 异步生成器]
  Q --> L[queryLoop]
  L --> S[每次调用的 State]
  L --> C[QueryConfig 快照]
  L --> D[QueryDeps 或 productionDeps]
  L --> O[StreamEvent、Message 等 yield]
  L --> T[Terminal 返回值]
  Q --> F[正常返回后完成命令生命周期]
~~~

## 参数、快照与循环状态不是同一层

`queryLoop()` 取得参数后，把不会在循环中重绑的 prompt、context、权限回调、来源等作为调用输入使用。消息与 `ToolUseContext` 则初始化内部 `State`；State 还保存压缩跟踪、最大输出恢复次数、turn 计数等跨迭代信息。Query loop 后续可以用新 State 替换旧状态。

另一个层次是 `buildQueryConfig()` 创建的 `QueryConfig`。它不由调用方传入，而是在生成器开始执行、进入 `queryLoop()` 时采集一次：

| 快照字段 | 来源 |
| --- | --- |
| `sessionId` | 当前 session |
| `gates.streamingToolExecution` | 可缓存的 Statsig gate |
| `gates.emitToolUseSummaries` | 环境变量 |
| `gates.isAnt` | `USER_TYPE` |
| `gates.fastModeEnabled` | 环境变量 |

这些运行时值在一次 Query 中保持为该次调用的配置快照。编译期 `feature()` gate 则刻意不收进对象，仍留在源码的守卫位置，以便构建期裁剪代码。这样可以把调用方输入、循环可变状态和进程/会话快照分别阅读，而不把它们混成一个大上下文对象。

## 显式依赖注入的范围

`QueryParams.deps` 可选。调用方没有传入时，`queryLoop()` 使用 `productionDeps()`；生产工厂连接真实的模型流、microcompact、autocompact 和 `randomUUID`。

| QueryDeps 字段 | 默认实现 | Query 中的职责 |
| --- | --- | --- |
| `callModel` | `queryModelWithStreaming` | 发起模型流调用 |
| `microcompact` | `microcompactMessages` | 处理 microcompact |
| `autocompact` | `autoCompactIfNeeded` | 处理自动压缩 |
| `uuid` | `randomUUID` | 生成 query chain 和 turn 标识 |

这个注入面刻意只列出四项，类型直接复用实际函数签名，避免 fake 与生产实现的参数类型漂移。它不是 Query 所有模块调用的统一代理：例如工具编排、stop hooks、日志和其他辅助工作不在当前 `QueryDeps` 中。做测试替身时，应把它理解为局部 seam。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/query.ts | sed -n '181,239p;241,305p'
nl -ba AI/claude-code-analysis-main/src/query/config.ts | sed -n '8,46p'
nl -ba AI/claude-code-analysis-main/src/query/deps.ts | sed -n '8,40p'
nl -ba AI/claude-code-analysis-main/src/QueryEngine.ts | sed -n '675,686p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '2780,2803p'
nl -ba AI/claude-code-analysis-main/src/query.ts | sed -n '412,467p;555,590p;652,680p'
~~~

## 观察结果

本课可以从三个结构验证 Query 的接口边界：调用方构造的 `QueryParams`、生成器开始执行时创建的 `QueryConfig` 快照，以及由可选 `deps` 覆盖或生产工厂提供的 `QueryDeps`。循环内部另有随迭代变化的 `State`；事件通过异步生成器向调用方返回，正常完成时由导出层补做命令生命周期收尾。

## 简化与限制

- 本课只覆盖 REPL 与 SDK QueryEngine 的输入装配以及 `query()` 的外部接口；Agent、Hook、bridge 等调用方可能构造不同的可选参数组合。
- QueryDeps 当前只有四个显式 seam，不能据此推断其他 I/O 或工具执行都可被注入。
- `QueryConfig` 是当前源码中可见的运行时快照，不等同于一份包含所有 process、settings 和 feature flag 的完整配置。
- 结论来自当前源码快照的静态阅读；没有运行 Query、模型流或测试。
