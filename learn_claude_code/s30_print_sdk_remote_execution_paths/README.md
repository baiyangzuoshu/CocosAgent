# 第 30 课：Print、SDK 与 Remote 会话的执行路径

**目标：** 比较 headless Print、SDK 消息流和 Remote 会话的输入边界、共享查询逻辑与输出消费者，辨别哪些状态由本地进程持有，哪些消息来自远程会话。

## 本课要回答的问题

1. Print 如何把单条或连续输入送进模型主链？
2. `ask()`、`QueryEngine` 与 `query()` 分别承担什么职责？
3. `text`、`json`、`stream-json` 三种输出在哪一层分流？
4. REPL 进入 Remote 模式后，普通文本、斜杠命令和返回的 SDK 消息如何处理？
5. 当前源码能证明哪些 SDK 行为，哪些只是 API 类型或接口契约？

## 三种会话路径

本课把 SDK 拆成两种容易混淆的东西：Print/headless 路径确实使用 `SDKMessage` 并通过 `ask()` 进入 `QueryEngine`；`agentSdkTypes.ts` 中对外的 `query()` 则在此快照里仍是抛出 `not implemented` 的桩。Remote UI 路径是 REPL 客户端连接既有远程会话，不等于本地启动一个 Query。

~~~mermaid
flowchart LR
  subgraph H[Print / headless]
    I[inputPrompt 或 structuredInput] --> IO[getStructuredIO]
    IO --> R[runHeadlessStreaming 命令队列]
    R --> A[ask]
    A --> E[QueryEngine.submitMessage]
    E --> Q[query 模型与工具循环]
    Q --> M[SDKMessage 流]
    M --> O[runHeadless 输出分支]
    O --> F[text / json / stream-json]
  end

  subgraph L[本地交互 REPL]
    UI[用户普通文本] --> P[handlePromptSubmit]
    P --> QL[本地 query]
    QL --> U[REPL 消费消息与流事件]
  end

  subgraph C[REPL Remote 会话]
    RU[用户文本或附件] -->|先加入本地 UI| POST[sendMessage / HTTP POST]
    POST --> W[远程执行会话]
    W --> WS[SessionsWebSocket SDKMessage]
    WS --> RM[RemoteSessionManager]
    RM --> AD[useRemoteSession / sdkMessageAdapter]
    AD --> RUOUT[本地显示转换后消息]
  end

  CMD[local-jsx 斜杠命令] --> P
  SDKAPI[agentSdkTypes.query()] -. 当前快照抛出 not implemented .-> STUB[不能据此推断 SDK 可运行]
~~~

## Print：输入、查询与输出由不同层负责

`getStructuredIO()` 把字符串输入包装成结构化 user 消息，也可以接收异步输入流；存在 `sdkUrl` 时它选择 `RemoteIO`，否则使用 `StructuredIO`。在 `runHeadlessStreaming()` 中，读取输入的任务与消费命令队列的任务并行运行：输入进入队列，队列按 turn 处理 prompt，再调用 `ask()`。因此 Print 的差异首先在 IO 和会话调度层，而非另造一套模型循环。

`ask()` 是单次提交的便利封装。它创建 `QueryEngine`，把当前 `mutableMessages`、工具、命令、权限回调、模型配置和文件读取缓存交给 `submitMessage()`，再逐项转发产生的 `SDKMessage`。`QueryEngine.submitMessage()` 先用 `processUserInput()` 处理 prompt，然后调用内部 `query()`，把 Query 产生的消息转成 SDK 消息。Print 外层在多次提交之间复用消息数组和文件读取缓存；`ask()` 的 `finally` 会把引擎内缓存写回调用方。阅读时要区分每次 `ask()` 新建一个引擎实例和调用方跨 turn 保留会话数据。

`runHeadless()` 负责选择输出形态。默认文本分支要求最后一条有效消息是 `result`，只打印结果文本或对应错误；`json` 输出最终 `result`，开启 verbose 时保留并输出完整消息数组；`stream-json` 消费逐条消息流，verbose/精简转换路径会把消息交给 `structuredIO.write()`。外层还会排除 stream event、控制消息及部分 SDK 系统事件，避免它们覆盖用于退出码和最终文本的 `lastMessage`。

源码中的调用关系可以概括为：

~~~text
inputPrompt / structuredInput
  → StructuredIO 或 RemoteIO
  → runHeadlessStreaming 的命令队列
  → ask()
  → QueryEngine.submitMessage()
  → query()
  → SDKMessage
  → 输出格式化或远程桥接
~~~

## Remote：本地先呈现输入，远端执行并回传事件

REPL 检测到 `activeRemote.isRemoteMode` 后，普通文本和 prompt 型斜杠命令会创建 user message 并先加入本地消息列表，然后调用 `sendMessage(content, { uuid })`。本地 JSX 型命令（例如 `/agents`、`/config`）需要当前终端渲染，仍走本地 `handlePromptSubmit()`。有粘贴内容时，输入会同时构造成用于本地展示和远端传输的 content blocks。

`RemoteSessionManager.sendMessage()` 把输入通过 HTTP POST 发给远程会话；它建立的 `SessionsWebSocket` 接收远端 `SDKMessage` 和控制消息。Manager 单独处理权限请求、取消及控制响应，再把普通 SDK 消息交给 `useRemoteSession` 的回调。回调过滤本地已显示用户消息的回声，调用 `convertSDKMessage()`，把 assistant、stream event、init/status、compact boundary 和工具进度转成 REPL 能消费的消息；成功 result、SDK 专用事件及重复用户输入会按类型忽略。远端 assistant 中的 `tool_use` 是已由远端构建的消息，客户端在这里负责显示工具运行状态，不会在本地再次执行工具。

因此 Remote 的模型、工具和会话推进不经过本地 REPL 的 `handlePromptSubmit → onQueryImpl → query()` 主链。两条路径共享 SDK 消息结构和部分 UI 消费逻辑，但执行所在进程不同。`RemoteIO` 则是 Print/headless 根据 `sdkUrl` 选用的另一种传输适配，不要把它与 REPL 的 `RemoteSessionManager` 会话连接合并成一个入口。

## 四条路径放在一起看

| 路径 | 输入边界 | 查询/状态边界 | 输出消费者 |
| --- | --- | --- | --- |
| 本地交互 REPL | REPL 输入与 `handlePromptSubmit()` | 本地 `query()`；REPL 持有展示消息和交互状态 | `onQueryEvent()` 与 Ink/React UI |
| Print/headless | `StructuredIO` / `RemoteIO` 输入队列 | `ask()` 创建 `QueryEngine`；调用方复用消息与文件缓存 | `runHeadless()` 的输出格式分支 |
| 远程 REPL 会话 | UI 本地追加后 POST `sendMessage()` | 远端会话执行；本地 Manager 处理控制与事件 | WebSocket 回调、SDK 适配器和 REPL UI |
| 对外 Agent SDK `query()` | 声明了 prompt/options 类型 | 当前文件中的函数体直接抛错 | 本快照不能据此验证 SDK 调用行为 |

## 静态观察

以下命令只读取源码，核对本课调用链：

~~~sh
nl -ba AI/claude-code-analysis-main/src/cli/print.ts | sed -n '455,470p;863,974p;976,1010p;2145,2245p;2813,2828p;5199,5233p'
nl -ba AI/claude-code-analysis-main/src/QueryEngine.ts | sed -n '176,212p;410,435p;675,716p;1248,1295p'
nl -ba AI/claude-code-analysis-main/src/entrypoints/agentSdkTypes.ts | sed -n '112,122p;439,443p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '3410,3485p;3488,3495p'
nl -ba AI/claude-code-analysis-main/src/remote/RemoteSessionManager.ts | sed -n '108,183p;216,242p'
nl -ba AI/claude-code-analysis-main/src/hooks/useRemoteSession.ts | sed -n '156,190p;269,329p'
nl -ba AI/claude-code-analysis-main/src/remote/sdkMessageAdapter.ts | sed -n '168,270p'
~~~

## 观察结果

- Print 用 `StructuredIO`/`RemoteIO` 接收输入，以 `ask()` 和 `QueryEngine` 复用查询循环；消息编码与终端输出由 Print 外层负责。
- 调用方复用 `mutableMessages` 和文件读取缓存，使多次 `ask()` 之间能够保留会话数据。
- Remote REPL 在本地显示输入、向远端发送带 UUID 的请求，并把回传 SDK 消息转换为 UI 消息或流事件。
- 本地交互、headless Print、远程会话和公开 SDK 函数的执行边界不同，不能只看共用的消息类型就认定它们执行在同一个进程。

## 范围与限制

- 本课基于仓库中的静态源码，不运行 CLI 或远端服务；Remote 的网络行为和目标部署均未做运行时验收。
- `agentSdkTypes.ts` 里的 `query()` 与 `connectRemoteControl()` 在本快照中是未实现桩。`QueryEngine` 的实际源码可供静态追踪，但不代表公开 Agent SDK API 已接通。
- `RemoteIO` 与 REPL 的 Remote Session 是两个不同传输入口；本课只比较其接线位置，不展开协议服务端实现和完整重连策略。