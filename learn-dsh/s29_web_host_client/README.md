# 第 29 课：Web Host 与 Client

**目标：** 把 Host 上的 Session 日志和助手流式片段传到浏览器
Client，并更新可渲染的对话投影。

## 本课问题

浏览器打开一段正在运行的 Session
时，怎样同时取得已有历史并接上实时事件？生成中的文本和最终提交的消息，为什么要走不同的数据路径？

## 本课增量

Host 端维护持久事件日志。Client 打开 Remote 流后先收到一份带游标的 Session
快照，再接收有序持久事件和无游标的助手流式片段。Client
按序号投影用户消息、助手草稿与最终回复；每次投影变化都会通知浏览器视图重新渲染。

```text
Host Session log / session/event
  subscribe ──► opening snapshot(cursor=1) ──► Remote stream
       │                                              │
       ├─ durable event(seq=2) ───────────────────────┤
       ├─ assistant chunk(revision=1..n) ─────────────┤ JSON wire frames
       ├─ assistant/message(seq=3) ───────────────────┤
       └─ turn/end(seq=4) ────────────────────────────┘
                                                      ▼
Browser Client ── decode + cursor check ──► SessionProjectionStore
                                                      │ subscribe
                                                      ▼
                                             ConversationView
```

示例先发送一条已有的用户消息，浏览器收到快照后，Host
再开始回合。浏览器会先显示逐块增长的助手草稿；最终 `assistant/message`
到达后，草稿被提交消息替换。助手块使用自己的 revision，不推进持久 Session 游标。

## 源码对照

- [`packages/api/session-controller/src/web/controller.ts`](../../../deepseek-harness/packages/api/session-controller/src/web/controller.ts)：先安装
  Session 事件监听，再读取观察快照；发送带 cursor 的 opening
  snapshot，之后交付队列中的增量。
- [`packages/api/session-controller/src/index.ts`](../../../deepseek-harness/packages/api/session-controller/src/index.ts)：将
  `SessionController.follow()` 声明为 `@Remote({ mode: 'stream' })`。
- [`packages/api/gateway/src/index.ts`](../../../deepseek-harness/packages/api/gateway/src/index.ts)：Gateway
  通过 `/api/remote.mux` WebSocket 升级路由承载多条 Remote 流。
- [`packages/api/gateway/src/client/journal-stream.ts`](../../../deepseek-harness/packages/api/gateway/src/client/journal-stream.ts)：Client
  统一处理 opening snapshot、增量 cursor、重复项、断线后重开和缺口修复。
- [`packages/api/session-controller/src/client/transport.ts`](../../../deepseek-harness/packages/api/session-controller/src/client/transport.ts)：将
  Session `follow` 帧适配为 journal 变化，并校验助手流式 revision。
- [`packages/api/session-controller/src/client/contract/events.ts`](../../../deepseek-harness/packages/api/session-controller/src/client/contract/events.ts)：Client
  事件窗口区分持久 Session 事件与临时助手流式行。
- [`packages/api/session-controller/src/client/sessions/session.ts`](../../../deepseek-harness/packages/api/session-controller/src/client/sessions/session.ts)：接收
  journal 变化，更新 Session 的 observable event source。
- [`packages/client/ui-conversation/src/client/conversation/assembler.ts`](../../../deepseek-harness/packages/client/ui-conversation/src/client/conversation/assembler.ts)：把
  Session 事件投影成对话界面可消费的节点。
- [`packages/client/connection/README.zh.md`](../../../deepseek-harness/packages/client/connection/README.zh.md)：浏览器
  Connection generation 和 Host 重连行为。
- [`packages/host/webserver/README.zh.md`](../../../deepseek-harness/packages/host/webserver/README.zh.md)：Host
  HTTP / upgrade 路由载体；具体 API 和 WebSocket 路由由注册它们的插件拥有。

### 两种流不要混为一谈

本课实现的是 Session 的 `follow` Remote 流。Harness 另有 Gateway
`$events`，用于转发 Cordis Remote Event 通知及 Agent-scoped waterfall；它由
[`packages/api/gateway/src/client/remote-events.ts`](../../../deepseek-harness/packages/api/gateway/src/client/remote-events.ts)
管理。两者都经过 Gateway 流载体，但领域协议、游标和消费方式不同。

## 代码结构

```text
s29_web_host_client/
├── README.md
├── deno.json
└── src/
    ├── async-queue.ts
    ├── browser-session.ts
    ├── host-session.ts
    ├── main.ts
    ├── remote-mux.ts
    ├── session-projection.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：Client 先显示 `cursor=1` 的用户消息快照；Host
开始回合后，视图连续显示增长中的助手文本；最终提交事件让草稿变为普通助手消息；`turn/end`
后状态变为 `completed`，持久游标停在 `4`。

## 关键观察

- **先订阅，再读快照。** Host 先注册实时 listener，再确定 opening
  cursor；快照之后发生的事件暂存在队列里，客户端不会在“读历史”和“接实时流”之间漏事件。
- **持久日志与流式草稿分开计数。** `SessionEvent.seq` 是 durable cursor；助手
  chunk 以 attempt revision 排序，暂时存在于 Client
  视图里，不伪装成已提交历史事件。
- **浏览器拿到的是投影数据。** Host 的 Session 对象不会越过网络边界。Client 收到
  JSON 帧，校验后更新自己的可观察状态；界面从 store 订阅，而不是访问 Host 对象。
- **最终回复完成草稿。** durable `assistant/message` 是权威结果，替换其 attempt
  的临时文本；之后 `turn/end` 才把视图状态设为完成。
- **游标能发现缺口。** 示例忽略已见序号的重复事件，并在跳号时失败。真实
  `RemoteJournalStream` 还会在重连时取新快照、分页修复缺口，再发布替代窗口。
- **Host WebServer 是载体。** 它拥有 HTTP 与 upgrade 注册能力；Gateway 注册
  `/api/remote.mux`，Session Controller 提供 Remote 方法，前端负责消费和显示。

## 简化与边界

- `LocalRemoteMux` 用 JSON 字符串模拟 Gateway WebSocket 帧，但不创建真实 HTTP
  服务器或浏览器页面；运行输出是 Client 视图的文本渲染。
- `HostSession.follow()` 展示订阅先于快照的顺序，没有复刻
  SessionObservation、持久化分页、权限 Peer、TLS、Cookie 认证或 WebSocket
  多路复用控制协议。
- Client 检查 cursor 连续性和助手 revision，但没有复刻 `RemoteJournalStream`
  的断线重连、历史分页、缺口修复、旧 generation 取消及助手流基线恢复。
- 界面只显示 user/assistant 文本与回合状态；真实 Conversation Assembler
  还会处理工具调用、审批、附件、子 Agent、编辑、压缩和其他事件类型。
- 实例只演示普通 Session 的输出方向；真实 Harness 还有从 Client 到 Host 的
  Remote 调用和上行流。

## 后续

[第 30 课：端到端综合——从 Agent 到 Web UI](../s30_end_to_end/README.md) 会把应用启动、工具回合、Session 事件和 Web 投影组合成一条独立可运行的路径。
