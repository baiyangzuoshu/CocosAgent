# 第 36 课：Bridge 入站消息解析、路由与 UUID 去重

**目标：** 从 transport 的 data 回调追踪一条入站消息如何被解析、分类和交给 REPL，并说明两组有界 UUID 集合如何阻断回声与重复 prompt。

## 本课要回答的问题

1. transport 收到一帧字符串后，Bridge 按什么顺序识别控制消息和 SDK 消息？
2. 哪些 SDK 消息会被交给 REPL，哪些只记录日志后忽略？
3. `recentPostedUUIDs` 与 `recentInboundUUIDs` 分别防止什么重复？
4. 环形存储何时淘汰 UUID，为什么它只是序号恢复之外的安全网？
5. 新 session 建立时，哪些入站去重状态必须重置？

## 从 transport 回调到 REPL

`replBridge.ts` 给 `ReplBridgeTransport.setOnData()` 安装回调，并把原始字符串、两组 UUID 集合和三个处理回调传给 `handleIngressMessage()`。v1/v2 的读取实现由 transport adapter 隔开；本课从共同的入站解析边界开始，不重讲 transport 选择与 work poll。

~~~mermaid
flowchart TD
  A[transport 收到 data 字符串] --> B[jsonParse 并规范控制消息键]
  B --> C{control_response?}
  C -->|是| D[onPermissionResponse 后返回]
  C -->|否| E{control_request?}
  E -->|是| F[onControlRequest 后返回]
  E -->|否| G{SDKMessage: object 且 type 为字符串?}
  G -->|否| H[忽略]
  G -->|是| I{UUID 在 recentPostedUUIDs?}
  I -->|是| J[忽略本地发送回声]
  I -->|否| K{UUID 在 recentInboundUUIDs?}
  K -->|是| L[忽略重复投递]
  K -->|否| M{type 是 user?}
  M -->|是| N[登记 inbound UUID、记事件并调用 onInboundMessage]
  M -->|否| O[记录日志并忽略]
  B -. 解析或处理异常 .-> P[记录失败日志]
~~~

`handleIngressMessage()` 先对 JSON 解析结果调用 `normalizeControlMessageKeys()`，再依序检查 `control_response` 和 `control_request`。两种控制消息分别交给独立 callback 并立即返回，所以不会进入普通 SDK 消息的 UUID 去重和 user prompt 路由。控制请求的具体 subtype 和应答语义见第31课。

接下来 `isSDKMessage()` 只判断输入是非空对象且 `type` 为字符串；它没有在这里逐字段校验完整 SDK schema。无法通过这层判断的值直接忽略。解析或后续同步处理抛错时，外层 catch 记录失败日志，不把异常继续抛给 transport。

取得可用的 SDK 消息后，代码只在 `uuid` 是字符串时进行去重：

1. 若 UUID 存在于 `recentPostedUUIDs`，将消息视作本地写往服务器后回送的 echo 并丢弃。
2. 若 UUID 存在于 `recentInboundUUIDs`，将消息视作已经转交过的 prompt 再投递并丢弃。
3. 未命中且 `type === 'user'` 时，先登记 UUID，再记录接收事件并调用 `onInboundMessage`。回调可能返回 Promise，但这里用 `void` 调用、不等待它完成。
4. 其他 SDK 消息只记调试日志，不交给 REPL。没有 UUID 的 user 消息仍会被转交，但无法由这两组集合去重。

因此，入站 WebSocket/SSE 事件流并不是把所有 SDK 事件都塞进本地对话；这个入口主要负责将远端 user prompt 输入 REPL，同时把控制流交给专用处理器。

## 两组 UUID 集合如何配合

`BoundedUUIDSet` 用固定长度数组保存 FIFO 顺序，并用原生 `Set` 提供成员查询。达到容量后，下一次新增会删掉写入位置上的旧 UUID，再覆写该槽位；重复添加已有 UUID 是 no-op，不会刷新其淘汰顺序。REPL core 为两组集合都配置容量 2000。

| 集合 | 写入来源 | 入站命中时 | 主要用途 |
| --- | --- | --- | --- |
| `recentPostedUUIDs` | 启动时从初始消息 UUID 初始化；发送路径在 `writeBatch()` 前登记消息 UUID | 忽略服务端回送的本地消息 | 防止消息回声再次进入本地消息流，也补充发送侧去重 |
| `recentInboundUUIDs` | user 消息通过检查、调用 handler 前登记 | 忽略已转交过的远端 prompt | transport 恢复或服务端重放时避免同一 prompt 再入 REPL |

发送侧的 `writeMessages()` 先筛出允许同步的消息，排除初始消息 UUID 和近期已发送 UUID；准备调用 `transport.writeBatch()` 前，把待发 UUID 加入 `recentPostedUUIDs`。这样服务器即使很快回送该消息，入站检查也已能识别它。daemon 的 `writeSdkMessages()` 也使用这组集合做 echo 过滤，但它直接处理 SDK 消息。

入站 UUID 去重是有界且内存内的：超过窗口后，较旧 UUID 会被淘汰，未来若再次出现就可能通过这层检查。代码注释把 transport sequence number carryover 作为历史重放的主要处理方式，`recentInboundUUIDs` 是序号协商失败、transport 切换竞态等情况下的第二道防线。session 被重建时，代码将 transport sequence 归零并清空 inbound UUID 集合，因为二者都属于旧 session；work poll 与 session 恢复时序见第35课。

## 与相邻课程的边界

- 第31课解释控制消息协议；本课只确认控制消息在入口被优先分流，不重复解释 subtype 语义。
- 第33课讲 RemoteIO 传输类型及事件生命周期；本课只使用 `ReplBridgeTransport.setOnData()` 作为公共入站边界。
- 第35课讲 work poll、transport 接管、sequence 恢复及 session 重建；本课聚焦单帧消息路由和 UUID 去重。

## 静态观察

以下命令只读取当前源码快照：

~~~sh
nl -ba AI/claude-code-analysis-main/src/bridge/bridgeMessaging.ts | sed -n '31,88p;124,208p;418,461p'
nl -ba AI/claude-code-analysis-main/src/bridge/replBridge.ts | sed -n '500,528p;792,806p;1332,1341p;1694,1777p'
nl -ba AI/claude-code-analysis-main/src/bridge/replBridgeTransport.ts | sed -n '23,42p'
~~~

## 观察结果

- 一条入站帧先经过 JSON 解析和控制消息分流；只有普通 SDK 消息才继续做 UUID 检查。
- 回送 echo 与重投递 prompt 使用不同集合；用户消息在 handler 调用前登记，控制消息走独立 callback。
- UUID 环形存储把去重内存限制在固定容量内；淘汰意味着它不能替代 sequence cursor 或持久化去重。
- Bridge 的入站普通消息路径只把 user 类型交给 REPL，其余 SDK 类型不会经此入口回灌。

## 范围与限制

- 结论来自仓库当前 Claude Code 源码快照的静态阅读；没有连接 Remote Control 服务、制造重放或验证消息在运行时的时序。
- 本课说明本地过滤和 callback 接线，不证明服务端 exactly-once 投递，也不覆盖完整 SDK schema 验证。
