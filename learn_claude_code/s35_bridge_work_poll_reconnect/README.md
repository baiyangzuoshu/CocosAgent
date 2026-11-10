# 第 35 课：Remote Control Bridge 工作轮询与重连

**目标：** 从 `initBridgeCore()` 追踪环境与会话建立、work poll、transport 接管及断线恢复，区分“transport 自己重连”和 bridge 重新领取 work 的职责。

## 本课要回答的问题

1. `initBridgeCore()` 将哪些外部依赖交给 bridge core，又按什么顺序建立环境和 session？
2. work poll 返回无任务、healthcheck 或 session work 时分别怎样处理？
3. transport 已占用单 session bridge 时，poll loop 怎样保活并在连接丢失后及时恢复取活？
4. 初始历史消息怎样避免和新消息交错发送？
5. clean close、环境丢失、临时 poll 错误与致命错误分别进入什么路径？

## 与第33、34课的边界

第33课跟进 RemoteIO 的 WebSocket/Hybrid/SSE 传输；第34课讲 CCR transcript 的持久化和恢复。本课位于它们之上的 bridge orchestration：谁轮询服务器、何时把 work item 交给 session transport、连接失效后何时重用 session 或创建新 session。这里只把 v1/v2 transport 当作 work 接收后的适配选项，不重讲其协议细节。

## 从 core 初始化到 work poll

`initBridgeCore()` 是参数驱动的 core：工作目录、分支、认证、创建/归档 session、消息回调和 poll 配置都从 `BridgeCoreParams` 注入。它注册 bridge environment，必要时读取 crash-recovery pointer 并尝试复用 perpetual session；否则创建 session、写入 pointer，然后启动持续运行的 `startWorkPollLoop()`。

~~~mermaid
flowchart TD
  A[initBridgeCore: 显式依赖] --> B[registerBridgeEnvironment]
  B --> C{存在可复用的 prior session?}
  C -->|复用成功| D[保留 session 与已发送 UUID]
  C -->|没有或复用失败| E[createSession]
  D --> F[写 crash-recovery pointer]
  E --> F
  F --> G[startWorkPollLoop]
  G --> H[pollForWork]
  H -->|无 work| I{transport != null?}
  I -->|否| J[按配置 sleep 后继续 poll]
  I -->|是| K[capacity heartbeat/wait]
  K -->|transport lost / shutdown| H
  H -->|有 work| L[decode secret]
  L -->|失败| M[stopWork，避免坏 work 重复领取]
  L -->|成功| N[acknowledgeWork]
  N --> O{work 类型}
  O -->|healthcheck| H
  O -->|session| P[validate sessionId]
  P --> Q[onWorkReceived]
  Q --> R[建立或替换 session transport]
~~~

work item 的 secret 解码后提供 session ingress token 和版本选择信息。解码失败时没有可用于 ack 的 JWT，代码使用 OAuth 路径 best-effort `stopWork(..., false)`，避免坏 work 在后续轮询中反复出现。正常 ack 失败本身不是致命错误：服务端可能再次投递，`onWorkReceived()` 再按 session 身份和当前 transport 状态处理。healthcheck 被 ack 后直接跳过；session work 则先验证 ID，再交给回调。

`sameSessionId()` 比较底层 UUID，因此兼容层的 `session_*` 与 work queue 的 `cse_*` 可以代表同一 session。其他 session ID 会被拒绝，避免 bridge 接入被分派到不同 session 的 work。

## 单 session 容量与 initial flush

REPL bridge 的 `isAtCapacity` 定义为 `transport !== null`，即使该 transport 内部正自动重连，也不会同时领取另一个 session work。无 work 时，poll loop 按配置进入 at-capacity 分支：可定时 heartbeat、按配置 deadline 重新 poll，或等待容量变化。`CapacityWake` 把 shutdown signal 和 capacity-wake signal 合并；transport 丢失时 `wakePollLoop()` 中断当前等待，让下一轮尽快重新 poll。

work 到达后，`onWorkReceived()` 先核对 session，再按服务器随 work secret 带来的 code-session 标记选择 v1/v2 transport（开发环境 override 也可强制 v2）。它保存当前 work ID 和 token 供 heartbeat 使用。旧 transport 被程序主动替换时，代码先将引用置空，再关闭旧连接，并保留 pending flush 队列交给新 transport；这样 close callback 不会把主动切换误判为 session 正常结束。

若存在 `initialMessages`，bridge 在 `connect()` 前启动 `FlushGate`。新消息暂存在 gate；连接后先筛选符合条件的历史消息、排除已 flush UUID，并按 `initialHistoryCap` 取尾部批次发送。初始 flush 完成后才 drain gate 并发出 `connected`，防止新消息插到历史批次中间。transport 自己短暂断线并恢复时，同一 work dispatch 不重复 flush 历史。

`FlushGate` 有三种不同清理语义：`deactivate()` 在 transport 替换时保留待发消息；`drop()` 在永久关闭时丢弃并返回丢弃数量；`end()` 结束初始 flush 并交出队列，由调用方发送。它不是远端持久化确认机制，只维护本地发送顺序。

## 连接失效与 session 恢复

~~~mermaid
flowchart TD
  A[transport 自动重连] -->|恢复成功| B[继续同一 work]
  A -->|clean close 1000| C[abort poll loop 并 teardown]
  A -->|永久关闭 / 重连预算耗尽| D[保存 sequence，唤醒 poll，drop FlushGate]
  D --> F[reconnectEnvironmentWithSession]
  E[pollForWork 返回环境 404] --> F
  F --> G[重新注册环境]
  G --> H{原环境和原 session 可重连?}
  H -->|是| I[reconnectSession，保留 session]
  H -->|否| J[archive 旧 session，create 新 session]
  I --> K[server 重新分派 work]
  J --> L[清零 session-scoped 序号/去重状态]
  L --> K
  K --> M[领取新 work token 并接入 transport]
~~~

`handleTransportPermanentClose()` 只处理 clean close、服务端永久拒绝或 transport 自己的重连预算耗尽；短暂断线由 transport 内部重试。close code `1000` 表示 session 正常结束，bridge abort poll 并 teardown。其他永久关闭会保存当前 SSE sequence、清空 transport 引用、唤醒 at-capacity poll，并 drop 永远不会由新 transport drain 的 flush 消息，然后调用 `reconnectEnvironmentWithSession()`。

环境重连先尝试以原 environment ID 重新注册，再尝试在同一环境中 `reconnectSession()`。若环境 ID 已变或原 session 无法重新排队，bridge 先 archive 旧 session，再创建新 session，并重写 crash-recovery pointer。切到新 session 时要清零 SSE sequence 和 inbound UUID 去重集合、清除旧 session 的 previously-flushed UUID；这些状态都不能跨 session 继承。重连过程中若 poll loop 已自行领取到新 work，reconnect helper 会让位，避免 archive 它刚接入的 session。

poll 端的错误恢复与 transport 的自动重连是两套层次：成功 poll 会清除连续错误计数；环境 404 走环境重新注册路径；其他致命认证/会话错误触发 teardown；一般错误按 2、4、8…秒退避，最高60秒，连续失败达到15分钟后转为 `failed`。heartbeat 对 work token 返回致命状态时，调用方会清除当前 transport/work 并唤醒 poll loop，以便尽快领取服务端重新分派、带新 token 的 work。

## Bridge 状态读法

| 状态 | 本课中的含义 |
| --- | --- |
| `ready` | 环境已建立或 poll 从错误中恢复；可等待 work |
| `connected` | transport 已连通；有初始历史时还要等 flush 完成才报告 |
| `reconnecting` | poll 或 transport/环境正在恢复；首次 poll 错误时转换，成功后再回 `ready` |
| `failed` | session 正常结束或不可恢复路径触发关闭；具体 detail 由分支给出 |

因此 `ready`、`connected` 是不同边界：前者说明 work poll 健康，后者表示 session transport 已接管；`transport !== null` 也不等同于 transport 当前已连接。

## 静态观察

以下命令只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/bridge/replBridge.ts | sed -n '70,110p;228,260p;298,370p;381,490p'
nl -ba engine/claude-code-analysis-main/src/bridge/replBridge.ts | sed -n '495,575p;887,963p;1008,1030p;1077,1208p;1208,1372p'
nl -ba engine/claude-code-analysis-main/src/bridge/replBridge.ts | sed -n '1851,1971p;2138,2188p;2201,2392p'
nl -ba engine/claude-code-analysis-main/src/bridge/replBridge.ts | sed -n '605,830p'
nl -ba engine/claude-code-analysis-main/src/bridge/workSecret.ts | sed -n '1,32p;62,87p'
nl -ba engine/claude-code-analysis-main/src/bridge/flushGate.ts | sed -n '1,71p'
nl -ba engine/claude-code-analysis-main/src/bridge/capacityWake.ts | sed -n '1,56p'
nl -ba engine/claude-code-analysis-main/src/bridge/replBridgeTransport.ts | sed -n '11,42p'
~~~

## 观察结果

- `initBridgeCore()` 把 bootstrap 信息作为参数传入，并把 environment/session setup 与持续 work poll loop 接成一个 core。
- poll loop 收到 work 后负责解 secret、ack、验证 session，再让 `onWorkReceived()` 安装合适的 transport。
- 单 session 的 at-capacity heartbeat、capacity wake 与 transport 自己的重试协作，避免连接恢复时长时间不再 poll。
- 初始历史 flush 通过 `FlushGate` 与新消息排序；替换 transport、永久关闭和结束 flush 使用不同队列语义。
- 同环境 session reconnect 与创建新 session 是两种恢复策略；session-scoped 序号、去重和已发送 UUID 需要按策略保留或重置。

## 范围与限制

- 本课根据当前快照静态追踪 `initBridgeCore()` 和 work-poll 代码；没有连接 Remote Control 服务、领取真实 work 或模拟环境失效。
- poll interval 来自运行配置；本课只描述源码中的分支和退避上限，不把可配置的 sleep 时长当作固定线上行为。
- v1/v2 transport 具体消息格式、权限控制消息和 CCR 内部事件分别见第31、33、34课；本课不证明服务端 ack、重派、session reconnect 或 environment 复用成功。
