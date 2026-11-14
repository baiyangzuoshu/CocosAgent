# 第 33 课：RemoteIO 的传输选择与 CCR 会话事件

**目标：** 从 `--sdk-url` 追踪 RemoteIO 的双向消息路径，比较 WebSocket、Hybrid 与 SSE/POST 传输，并说明 CCR v2 如何管理 worker 生命周期、客户端事件和可恢复会话数据。

## 本课要回答的问题

1. `print.ts` 在什么条件下把普通 `StructuredIO` 换成 `RemoteIO`？
2. 远端输入怎样变成 `StructuredIO` 能消费的 NDJSON，输出又由谁发送？
3. 三种传输的读写通道分别是什么，重连时如何恢复？
4. CCR v2 中客户端事件、worker 内部事件、delivery 状态和 worker 状态分别承担什么职责？
5. 初始化、回调接线和关闭为何有顺序要求？

## 从 Print 分流到输入解析

第30课区分了 headless Print、SDK 与 UI 远程会话。本课继续追踪 `sdkUrl` 对应的 Print 远端 I/O。这里的 `RemoteIO` 是 CLI/SDK 的 `StructuredIO` 子类；它不是 UI 侧的 `RemoteSessionManager`，也不负责渲染远程 REPL。

~~~mermaid
flowchart LR
  P[print.ts: getStructuredIO] -->|sdkUrl 存在| R[RemoteIO]
  P -->|无 sdkUrl| S[StructuredIO]
  R --> T{getTransportForUrl}
  T -->|默认| W[WebSocketTransport]
  T -->|POST ingress 开关| H[HybridTransport]
  T -->|CCR v2 开关| E[SSETransport + CCRClient]
  W -->|收到字符串| I[PassThrough]
  H -->|WebSocket 收到字符串| I
  E -->|payload 转 NDJSON| I
  I -->|按换行解析| Q[StructuredIO.read]
  Q -->|stdout message| O[RemoteIO.write]
  O --> D{CCR v2?}
  D -->|是| C[CCRClient.writeEvent]
  D -->|否| X[Transport.write]
  C --> A[CCR HTTP API]
~~~

`print.ts:getStructuredIO()` 根据 `options.sdkUrl` 选择 `new RemoteIO(...)`，否则构造普通 `StructuredIO`。`RemoteIO` 把 `PassThrough` 交给父类作为输入；传输的 `onData` 将字符串写入该流。`StructuredIO.read()` 累积字符串块、按换行拆分并调用 `processLine()`，因此传输层需把远端消息整理为 NDJSON 格式。

反方向上，`RemoteIO.write()` 在 CCR v2 启用时调用 `CCRClient.writeEvent()`，否则调用 transport 的 `write()`。bridge 模式还会把 `control_request` 回显给父进程；其他消息只在 debug 模式回显。这条回显是 bridge 本地 IPC/观测边界，不替代远端发送。

## 三种传输路径

| 选择条件 | 读取通道 | 写入通道 | 关键行为 |
| --- | --- | --- | --- |
| 默认 | WebSocket | 同一 WebSocket | 重连时可回放尚未确认的缓冲消息；用 `X-Last-Request-Id` 与服务端确认位置衔接 |
| `CLAUDE_CODE_POST_FOR_SESSION_INGRESS_V2` | WebSocket | HTTP POST | `stream_event` 短暂缓冲后批量发送；串行上传器负责队列、退避重试和背压 |
| `CLAUDE_CODE_USE_CCR_V2` | SSE | HTTP POST / CCR API | SSE 帧中的 `client_event` payload 解包成 NDJSON；CCRClient 另负责 worker 状态和内部事件 |

`getTransportForUrl()` 的优先级是 CCR v2、POST ingress Hybrid、默认 WebSocket。CCR v2 将 `ws:`/`wss:` URL 转为 `http:`/`https:`，并在路径后追加 `/worker/events/stream`；非 CCR 分支只接受 `ws:`/`wss:`，其他协议会抛错。

重连行为属于各传输的实现细节，不能将它们视为相同保证：WebSocket 有请求缓冲与重放逻辑；SSE 记录序号，在后续连接中带上 `from_sequence_num` 和 `Last-Event-ID`，并对重复 frame 序号留下诊断记录；Hybrid 的读取仍走继承的 WebSocket，写入则由 POST 上传队列处理。SSE 还设置 45 秒静默检测，重连延迟指数增长并有 10 分钟预算。SSE/Hybrid 的 POST 对 429、5xx 或网络错误重试；其他 4xx 被视作永久错误而不重试。具体结果仍受服务端响应和队列关闭时机影响。

RemoteIO 在构造时准备初始认证头，并传入 `refreshHeaders`，供支持的传输在重连时重新读取会话 token 和环境 runner 版本。SSE 的连接及写入会重新读取 auth headers；Hybrid 的 `postOnce()` 则直接从 session ingress token 取 Bearer token。不要据此把所有通道概括成统一的凭据刷新机制。

## CCR v2：事件流之外的 worker 会话层

CCR v2 不只是把 WebSocket 替换为 SSE。`RemoteIO` 会先断言传输确实是 `SSETransport`，然后创建 `CCRClient` 并启动 `initialize()`。初始化读取 worker epoch，校验认证头，向 worker endpoint 注册 idle 状态，恢复 worker metadata，并启动 heartbeat。epoch 缺失、无认证头或注册失败会使初始化失败，错误路径记录诊断并进入 `gracefulShutdown(1)`。

`CCRClient` 将数据分成不同用途：

| 数据 | 入口 | 用途 |
| --- | --- | --- |
| 前端可见的客户端事件 | `RemoteIO.write()` → `writeEvent()` → `/worker/events` | 转发 `StdoutMessage`；为缺少 UUID 的消息补 UUID；流式事件短暂缓冲并合并 |
| worker 内部事件 | `setInternalEventWriter()` → `writeInternalEvent()` | 保存 transcript 消息、压缩标记和 agent 信息，供会话恢复；不发送到前端事件流 |
| 下行 client_event 的 delivery 更新 | SSE 的 `setOnEvent()` → `reportDelivery()` | 记录 `received`；命令生命周期再把状态更新为 `processing` / `processed` |
| worker/session 状态与 metadata | RemoteIO 注册的 listeners | 将会话状态变化和外部 metadata 报给 CCR |
| heartbeat | `initialize()` 注册的定时器 | 向 worker heartbeat endpoint 报活；会话活动 callback 也可写 `keep_alive` |

`CCRClient` 构造函数同步注册 SSE `onEvent` 回调，之后 `RemoteIO` 才调用 `transport.connect()`。这个先后次序避免连接追赶历史事件时，首个 `client_event` 抵达尚未接线的回调。其他接线包括 transcript 内部事件读写器、command lifecycle listener、session state listener 和 metadata listener。

## 连接与关闭顺序

~~~mermaid
sequenceDiagram
  participant P as print.ts
  participant R as RemoteIO
  participant T as Transport / SSE
  participant C as CCRClient
  participant A as CCR HTTP API
  participant I as StructuredIO
  P->>R: sdkUrl 存在时构造
  R->>T: 选择 transport，注册 onData/onClose
  opt CCR v2
    R->>C: 构造 CCRClient，立即接好 delivery callback
    R->>C: 启动 initialize() 异步初始化 worker/state/heartbeat
    R->>I: 注册 transcript 与状态 listener
  end
  R->>T: callbacks 接好后 connect()
  T->>R: onData(NDJSON)
  R->>I: PassThrough.write(data)
  I->>I: 按行解析 SDK 消息
  I->>R: stdout message
  R->>C: CCR v2: writeEvent(message)
  C->>A: POST client/internal events、delivery、state 和 heartbeat
  Note over R,C: initialize() 中的网络请求可与 transport.connect() 并行进行
  Note over R,T: onClose 结束 PassThrough；RemoteIO.close 清 timer、关 transport 并结束输入
~~~

传输的 `onClose` 会结束 `PassThrough`，让 `StructuredIO` 的输入循环自然收尾。`RemoteIO.close()` 清理 bridge keepalive 定时器、关闭 transport 并结束输入流；`RemoteIO` 也把自身 `close()` 注册到共享 cleanup registry。CCR v2 另外注册 `CCRClient.close()`，后者停止 heartbeat、注销 session activity callback 并关闭 worker state 与各事件上传器。共享 cleanup registry 并发运行回调，所以不能依赖这两个关闭回调的注册先后代表严格的销毁顺序。

关闭上传器不等于所有队列已经成功送达：`CCRClient.close()` 会关闭上传器；其注释要求需要确认 client-event 队列交付时先调用 `flush()`，内部 transcript 事件则通过 `flushInternalEvents()` 单独冲刷。Hybrid 关闭时会给上传队列一个有限的 flush 宽限期。不能把 `close()` 描述为可靠持久化保证。

## 静态观察

以下命令只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/cli/print.ts | sed -n '5199,5233p'
nl -ba AI/claude-code-analysis-main/src/cli/remoteIO.ts | sed -n '44,172p;198,213p;231,254p'
nl -ba AI/claude-code-analysis-main/src/cli/structuredIO.ts | sed -n '164,170p;222,255p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/transportUtils.ts | sed -n '8,44p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/WebSocketTransport.ts | sed -n '135,157p;574,634p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/HybridTransport.ts | sed -n '24,52p;117,152p;197,260p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/SSETransport.ts | sed -n '16,21p;231,269p;339,415p;425,465p;572,653p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/ccrClient.ts | sed -n '438,525p;677,723p;725,834p;960,997p'
~~~

## 观察结果

- `RemoteIO` 把传输协议和 `StructuredIO` 的 NDJSON 输入接口隔开；Print 分流仍由 `sdkUrl` 决定。
- 三条通道共享“收到字符串 / 写出消息”的抽象，但读写协议、缓冲和重连语义不同。
- CCR v2 在 SSE/POST 之外增加 worker 注册、heartbeat、delivery 状态、metadata 和 session resume 所需的内部事件。
- 初始化回调必须在连接前接好；输入结束、transport 关闭和 CCR 上传队列关闭是相关但不同的生命周期边界。

## 范围与限制

- 本课根据当前快照源码描述 Print RemoteIO 与 transport/CCR 的接线；没有启动 CLI、连接真实 session endpoint 或验证服务端协议。
- WebSocket/SSE 的重连代码、Hybrid 上传队列和 CCR worker endpoint 只证明客户端实现中的分支，不证明服务端实际可用性、端到端 exactly-once 或持久化成功。
- UI 的 `RemoteSessionManager` 与本课的 headless `RemoteIO` 是不同路径；本课不把两者合并为一种 Remote 会话管理实现。
