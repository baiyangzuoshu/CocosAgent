# 第 39 课：Bridge CCR v2 Worker 状态与事件确认

**目标：** 分清 session 级 worker 状态与单条 client event 的 delivery 状态，并追踪 REPL Bridge CCR v2 怎样选择状态转换和确认时机。

## 本课要回答的问题

1. CCR worker 的 `idle`、`running`、`requires_action` 分别由哪些 Bridge 路径触发？
2. 为什么启用 Bridge 时，如果最近一条符合条件的历史消息是 user，worker 要从 idle 改为 running？
3. 权限请求、权限回应和本地取消怎样避免 session 状态一直停在 requires_action？
4. SSE 收到的每条 client event 如何记录 delivery 状态？Bridge 与 RemoteIO 的 processed 时机有什么差别？
5. 为什么 processed ACK 不能证明 prompt 已经写入 transcript 或至少执行一次？

## 两种状态：session 与 event

第33课说明了 CCR 的通用 worker 状态和 event delivery API。本课限定在 env-less Remote Control Bridge：`remoteBridgeCore.ts` 把 turn 与权限语义映射到 worker 状态，`replBridgeTransport.ts` 则为 Bridge 调整每条 SSE event 的确认策略。

~~~mermaid
flowchart LR
  subgraph W[Session worker state]
    A[CCRClient.initialize] --> B[idle]
    B --> C[running: user work]
    C --> D[requires_action: can_use_tool]
    D --> E[running: response or cancel]
    E --> F[idle: result or teardown]
  end
  subgraph Evt[Per-event delivery]
    G[SSE client_event received] --> H[received]
    H --> I[Bridge queues processed ACK immediately]
  end
~~~

worker 状态回答“这个 session 当前在做什么或等什么”；delivery 状态则按 event ID 回答“某条服务端下行事件处于什么接收阶段”。事件被标成 processed 不会自动把 worker 状态改成 running，状态也不能替代 event 的 received/processed 记录。

## Bridge 怎样映射 worker 状态

CCRClient 初始化时向 worker endpoint 报告 `idle`，并清理上个 worker 进程可能遗留的 `pending_action` 和 `task_summary` metadata，然后启动 heartbeat。之后 env-less Bridge 根据消息和控制协议语义显式报告状态；CCR v2 不像旧 v1 session-ingress 路径那样从事件类型自动推导 worker status。

| 状态 | Bridge 触发点 | 服务端侧用途 |
| --- | --- | --- |
| `idle` | CCR 初始化；发送 result；teardown 发送 result 前 | 表示当前没有活动 turn |
| `running` | 初始 flush 最近一条 eligible 消息是 user；flush gate drain 或 `writeMessages()` 批次含 user；权限回应、control response 或 control cancel | 表示 turn 已开始/继续，或权限等待已解除 |
| `requires_action` | `sendControlRequest()` 发送 subtype 为 `can_use_tool` 的权限请求前 | 让 claude.ai 显示等待用户输入 |

初始历史 flush 有一个容易漏掉的边界：代码检查完整的 `eligible` 列表尾部，而不是受 `initialHistoryCap` 截断后的 `capped` 列表。如果 Remote Control 在 turn 中途启用，末条 eligible 消息是 user 时要立即改为 running；否则初始化 PUT 上报的 idle 可能保持到下一条 user 类型消息，而纯文本 turn 后续只流出 assistant chunk。

其他路径也有状态配对：远端用户回应权限后，收到的 `control_response` callback 先报 running 再恢复本地 turn；本地 Hook、classifier 或 permission recheck 已经解决权限时，`sendControlCancelRequest()` 同样先报 running 再通知服务端取消 pending request。若只取消请求而不更新状态，服务端可能继续显示 requires_action。

Bridge transport interface 的 `reportState()` 在 CCR v2 才有效，v1 adapter 是 no-op。Bridge 调用只传状态、不传 `RequiresActionDetails`；`CCRClient.reportState()` 对连续相同且没有 details 的状态会跳过重复 enqueue，其余状态写入 worker-state 上传队列。这里描述的是客户端排队意图，不能由一次调用推断服务端已完成 PUT。

## Bridge 的事件确认为何提前

CCRClient 构造时为 SSE event 注册 `received` callback。RemoteIO 另外接入 query command lifecycle，在开始处理和处理完后发送 `processing`、`processed`；Bridge transport 没有这条进程内监听器，所以它会覆盖 SSE 的 `onEvent` callback，在收到 frame 时连续 enqueue `received` 和 `processed`。Bridge 不发送中间的 `processing` 状态。

这个选择明确折中了两类故障：如果只发 received，重启后没有 processed 的旧事件可能被重新排队，制造重复 prompt；现在 receipt 后就 ACK processed，若进程在 prompt 写入 transcript 前崩溃，则可能丢失这一条 prompt。源码注释把这个窗口描述为较窄，并优先避免反复重放导致的多条幻影消息。

`reportDelivery()` 本身也只是把 {eventId, status} 放入 delivery uploader 并 fire-and-forget。因而 processed 表示 Bridge 选择向服务端报告的处理边界，不是持久化事务提交、模型执行完成或端到端 exactly-once 的证明。第34课讲 transcript 的独立持久化与恢复路径。

## 与相邻课程的边界

- 第33课讲 RemoteIO/CCR 的传输结构、worker/event API 及通用 delivery 生命周期；本课讲 Bridge runtime 何时映射 worker 状态，以及为何覆盖其 SSE event ACK callback。
- 第34课讲 transcript 持久化与恢复；本课不把 processed ACK 当作 JSONL 已落盘。
- 第35课讲 work poll、transport 接管和 session 恢复；本课只解释 v2 worker 状态与单条 event 的本地确认策略。

## 静态观察

以下命令只读取当前源码快照：

~~~sh
nl -ba engine/claude-code-analysis-main/src/utils/sessionState.ts | sed -n '1,24p'
nl -ba engine/claude-code-analysis-main/src/cli/transports/ccrClient.ts | sed -n '438,445p;448,500p;644,658p;960,968p'
nl -ba engine/claude-code-analysis-main/src/bridge/remoteBridgeCore.ts | sed -n '422,447p;607,656p;671,679p;797,879p'
nl -ba engine/claude-code-analysis-main/src/bridge/replBridgeTransport.ts | sed -n '49,64p;234,253p;324,332p'
~~~

## 观察结果

- worker status 是 session 级状态；event delivery 以 event ID 为键。它们由不同 API 和队列报告。
- Bridge 的 user message、权限请求/回应、取消和 result 分别触发 running、requires_action 或 idle。
- Bridge 直接将 SSE event 从 received 标记到 processed，没有依赖 query lifecycle 的 processing 中间态。
- 状态及 delivery API 都是异步队列；代码能证明上报请求被排队，不能证明服务端持久化或 prompt 恰好处理一次。

## 范围与限制

- 结论来自仓库当前 Claude Code 源码的静态阅读；没有连接 CCR、观察 claude.ai session list 或模拟进程崩溃与 event 重放。
- 本课描述的是 env-less CCR v2 Bridge 路径。v1 worker status 推导、RemoteIO 的 command lifecycle ACK 与服务端重放策略不由本课外推。
