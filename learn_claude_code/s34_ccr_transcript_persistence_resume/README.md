# 第 34 课：CCR v2 transcript 持久化与恢复回灌

**目标：** 接上第33课的 CCR worker 事件通道，追踪 transcript 如何从 `SessionStorage` 分发到 CCR v2 内部事件，以及 `--resume` 如何把远端事件回灌为本地 JSONL，再交给既有会话加载器。

## 本课要回答的问题

1. `recordTranscript()` 怎样把新消息交给本地与远端持久化路径？
2. `SessionStorage` 怎样在 CCR v2、v1 Session Ingress 和本地写入之间分流？
3. CCR v2 写入时如何标记 compact boundary 和 agent 信息？
4. `--resume` 怎样并行恢复 worker metadata，并把 foreground/subagent 事件重新物化为 JSONL？
5. 内部事件何时 flush，空会话与恢复错误如何处理？

## 与第12、33课的衔接

第12课讲本地 JSONL 的父子链、会话选择和恢复；第33课讲 CCR 的 transport、worker 状态和内部事件入口。本课只聚焦两者之间的适配边界：CCR 内部事件并不直接替代 `loadConversationForResume()`，而是先还原成本地 transcript 文件，再复用已有加载流程。

## 写入：一条 transcript 的本地与远端分发

~~~mermaid
flowchart TD
  U[useLogMessages / QueryEngine] --> R[recordTranscript]
  R --> C[清理、按 UUID 去重]
  C --> I[Project.insertMessageChain]
  I --> A[Project.appendEntry]
  A --> G{shouldSkipPersistence?}
  G -->|是| X[跳过持久化]
  G -->|否| B{Entry 类型}
  B -->|非 transcript message| L[enqueueWrite 本地 JSONL Entry]
  B -->|transcript message| D{agent sidechain 或 UUID 未写过?}
  D -->|agent sidechain| A1[enqueueWrite agent transcript]
  D -->|主 transcript 新 UUID| L1[enqueueWrite 主 JSONL]
  L1 --> P[persistToRemote]
  D -->|主 transcript UUID 已存在| X1[跳过重复 message]
  P -->|CCR writer 已注册| V[writeInternalEvent transcript]
  P -->|否则，v1 开关与 URL 都存在| W[Session Ingress appendSessionLog]
  P -->|都不满足| N[不写远端]
~~~

`useLogMessages()` 将新增消息切片交给 `recordTranscript()`；后者清理消息、查询已写 UUID 并只把新消息传入 `Project.insertMessageChain()`。`insertMessageChain()` 逐条构造带 session 与 parent 字段的 transcript entry，交给 `appendEntry()`。

`appendEntry()` 先执行统一的 `shouldSkipPersistence()` 检查。允许写入时，它把 Entry 放进本地 JSONL 写队列；对新写入的主 transcript message，再调用 `persistToRemote()`。因此本地 append 是排队操作，远端分发是单独的路径；消息进入 UI 也不能单独证明任一持久化队列已落盘或上传成功。

远端分流顺序是：

| 条件 | 远端写入 | 结果边界 |
| --- | --- | --- |
| `internalEventWriter` 已注册 | 写 `transcript` 类型的 CCR v2 worker internal event | CCR 写入异常被捕获并记录失败诊断；该方法不会在此分支直接触发 shutdown |
| 未注册 writer，且 v1 开关与 ingress URL 都存在 | `sessionIngress.appendSessionLog()` | 返回失败时记录事件并调用 `gracefulShutdownSync(1)` |
| 不满足上述条件 | 不写远端 | 本地 JSONL 路径仍由 `appendEntry()` 的 persistence guard 决定 |

CCR v2 分支将 compact boundary 标为 `isCompaction`，并在 entry 带 `agentId` 时一起传入。这个事件 writer 由 `RemoteIO` 在创建 `CCRClient` 后注册；课程第33课已经追踪过注册的入口。

有 agent sidechain 的本地写入需要单独看：`appendEntry()` 会把 sidechain 写到 agent transcript 文件，但当前这段主 transcript 分发逻辑只在非 sidechain 条件下更新主会话 UUID 集合并调用 `persistToRemote()`。不要把“本地 agent 文件写入”直接等同于“同一条路径一定上传 CCR”。

## 恢复：先回灌，再复用 JSONL 加载器

~~~mermaid
sequenceDiagram
  participant P as print.ts --resume
  participant H as hydrateFromCCRv2InternalEvents
  participant C as CCRClient readers
  participant F as 本地 JSONL 文件
  participant L as loadConversationForResume
  participant S as worker state
  P->>H: sessionId
  par 读取 transcript
    H->>C: 读取 foreground internal events
    C-->>H: payload entries
    H->>F: 写 foreground JSONL
    H->>C: 读取 subagent events
    C-->>H: events with agent_id
    H->>F: 按 agent_id 写独立 agent transcript
  and 恢复 worker state
    P->>S: await restoredWorkerState
    S-->>P: external metadata
  end
  H-->>P: hydrate 完成
  P->>L: 从 JSONL 加载 conversation
  L-->>P: messages / empty result
~~~

`print.ts` 在 CCR v2 `--resume` 分支中并行等待 `hydrateFromCCRv2InternalEvents(sessionId)` 和 `options.restoredWorkerState`。回来的 metadata 用于恢复 AppState；其中 `model` 字段若为字符串，还会设置 main loop 的 model override。这里的并行关系不是“先 hydrate 完才连 SSE”：连接和 worker 初始化已经由 RemoteIO 启动，`--resume` 等待的是本次状态恢复结果。

`hydrateFromCCRv2InternalEvents()` 先切换当前 session，再取得 RemoteIO 注册的 reader。它读取 foreground internal events，把每个 payload 序列化为一行 JSON，写入本地 session transcript；有 subagent reader 时，再按 `agent_id` 分组，将每组写进对应 agent 的 transcript 文件。源码使用目录权限 `0700` 和文件权限 `0600`。CCR reader 的注释说明服务端返回从最近 compaction boundary 开始的记录；这是客户端注释中的服务端契约，不是本课实测的服务端行为。

回灌完成后，Print 调用通用的 `loadConversationForResume()`。也就是说 CCR v2 提供远端读取适配，本地的 JSONL 解析、metadata 恢复和消息链组装仍由既有 loader 处理。若回灌后没有消息（包括新 session 写出的空 transcript），Print 将空结果按 CCR/URL 新会话处理并运行 startup SessionStart hooks，而不是按本地 UUID 查找失败直接退出。

## Flush、空结果与错误语义

Print 每轮在 `finally` 中先 `await structuredIO.flushInternalEvents()`，然后在未进入 shutdown 时通知 session 回到 `idle` 并 drain SDK events。普通 `StructuredIO` 的该方法是 no-op；`RemoteIO` 则把调用转给 `CCRClient.flushInternalEvents()`，让待写 transcript 内部事件先经过上传器的 flush 边界。

恢复函数返回布尔值：没有 reader、读取失败或 foreground 列表为空时都可能返回 `false`。一般异常会被记录并转成 `false`；epoch mismatch 会重新抛出，避免失效 worker 与另一个 epoch 继续竞争。Print 的 CCR 分支等待该函数，但不使用其布尔结果作分支判断，而是继续走通用 loader，再按 messages 是否为空决定 startup 路径。

这形成两条不同失败策略：CCR 写入异常由 `persistToRemote()` 捕获并记录，CCR hydrate 的普通异常也转成失败结果；v1 Session Ingress 返回失败则触发退出码为1的关闭路径。不能把两版持久化的失败语义合并成一个“上传失败即退出”的规则。

## 静态观察

以下命令只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/hooks/useLogMessages.ts | sed -n '20,75p'
nl -ba AI/claude-code-analysis-main/src/utils/sessionStorage.ts | sed -n '490,520p;993,1083p;1128,1265p;1302,1384p;1408,1462p'
nl -ba AI/claude-code-analysis-main/src/utils/sessionStorage.ts | sed -n '1632,1723p'
nl -ba AI/claude-code-analysis-main/src/cli/remoteIO.ts | sed -n '140,167p;217,219p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/ccrClient.ts | sed -n '789,834p;842,858p'
nl -ba AI/claude-code-analysis-main/src/cli/structuredIO.ts | sed -n '189,196p'
nl -ba AI/claude-code-analysis-main/src/cli/print.ts | sed -n '2448,2470p;5027,5103p'
~~~

## 观察结果

- `SessionStorage` 把 transcript 变成带 session/parent 信息的 Entry；本地 JSONL 与远端事件写入是两条可并行存在的路径。
- CCR v2 用 internal event writer 替代 v1 Session Ingress 写入分支，并把远端 payload 回灌成通用 loader 能读取的 JSONL。
- foreground transcript、subagent transcript 和 worker external metadata 是不同恢复数据；Print 把前两者落为文件，把 metadata 恢复到运行状态。
- flush、空 transcript、普通读取失败和 epoch mismatch 各有独立边界，不能简化成单一成功/失败布尔判断。

## 范围与限制

- 本课根据当前快照的静态源码追踪 `SessionStorage`、Print resume 和 CCRClient reader/writer 接线；没有启动 CLI、请求 CCR 服务或验证磁盘权限行为。
- 课程第12课仍是本地 JSONL 父子链、恢复列表与 session chooser 的入口；本课不重复推导完整 conversation chain 算法。
- 源码中的服务端 compaction 过滤说明只作为客户端预期，不证明远端存储的排序、完整性、持久性或可用性。
