# 第 30 课：端到端综合——从 Agent 到 Web UI

**目标：** 把插件启动、Agent 工具回合、Session 事件和 Web 投影组合成一条可独立运行的路径。

## 本课问题

前 30 个示例逐步拆开了 Harness 的能力。现在把代表性机制接起来：启动时怎样安装工具和 Agent；模型如何请求工具；工具结果如何进入 Session 并回到模型；浏览器怎样在不直接持有 Host 对象的情况下收到更新？

## 本课增量

本课在同一个小应用中组合启动器、工具注册表、AgentLoop、Fake LLM、Session 日志和 Web 投影。模型先请求 `search_notes`，Agent 执行工具并记录结果，再次请求模型生成最终答复；Session 的有序事件通过 JSON 帧流给浏览器端，浏览器校验游标并更新对话视图。

```text
Application boot
  ├─ search-tool plugin ──► ToolRegistry ──► model ToolSchema
  ├─ agent-loop plugin ───► AgentLoop ─────► FakeLlm
  ├─ web-client plugin ───► LocalWebTransport
  └─ conversation-view plugin
                               ▲
FakeLlm ──► tool call ──► AgentLoop ──► ToolRegistry
                              │              │
                              └── events ───► SessionLog
                                                │ snapshot + ordered events
                                                ▼
                                      BrowserConversation ──► View
```

## 源码对照

- [`packages/boot/app-boot/src/index.ts`](../../../deepseek-harness/packages/boot/app-boot/src/index.ts) 与 [`packages/boot/plugin-manager/src/index.ts`](../../../deepseek-harness/packages/boot/plugin-manager/src/index.ts)：真实应用启动和插件组合入口。本课的 `Application` 只保留有序安装与逆序清理。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：真实 Agent driver 从 Session 派生请求，并协调 Turn、Step、模型和工具。本课每次请求都从事件投影重建简化历史。
- [`packages/core/tools/src/batch.ts`](../../../deepseek-harness/packages/core/tools/src/batch.ts)：真实工具批次安排并发、执行策略及模型顺序结算。本课只执行一个工具调用。
- [`packages/core/session/src/types.ts`](../../../deepseek-harness/packages/core/session/src/types.ts) 与 [`packages/llm/llm/src/message.ts`](../../../deepseek-harness/packages/llm/llm/src/message.ts)：真实 Session 事件和模型消息的数据合同。本课用小型联合类型展示两者之间的投影。
- [`packages/api/session-controller/src/web/controller.ts`](../../../deepseek-harness/packages/api/session-controller/src/web/controller.ts)：真实 Session follow 先安装观察，再发送 opening snapshot 和增量。
- [`packages/api/gateway/src/client/journal-stream.ts`](../../../deepseek-harness/packages/api/gateway/src/client/journal-stream.ts)：真实 Client 处理重连、游标、分页和缺口修复。本课只检查单次连接中的快照尾游标和增量连续性。
- [`packages/client/ui-conversation/src/client/conversation/assembler.ts`](../../../deepseek-harness/packages/client/ui-conversation/src/client/conversation/assembler.ts)：真实 Conversation Assembler 把事件组织为界面节点。本课按少数事件类型生成文本行。

## 代码结构

```text
s30_end_to_end/
├── README.md
├── deno.json
└── src/
    ├── agent-loop.ts
    ├── application.ts
    ├── async-queue.ts
    ├── fake-llm.ts
    ├── main.ts
    ├── session.ts
    ├── tools.ts
    ├── types.ts
    └── web-client.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：启动日志列出四个插件；Web 视图从空快照 `cursor=0` 开始接收事件；最终 Session 游标为 `7`，状态为 `completed`，对话包含用户输入、工具调用、工具结果和助手答复；Fake LLM 被调用两次。

## 关键观察

- **插件负责装配，服务对象负责协作。** `Application` 按顺序安装插件并逆序释放清理函数。Agent 和 Web Client 通过演示 Context 中共享的 Session、工具注册表和模型协作，不在插件间硬编码调用顺序以外的依赖。
- **模型看见 Schema，Agent 持有执行入口。** `ToolRegistry.schemas()` 生成模型声明；模型返回工具名与参数后，Agent 再通过注册表执行。模型输出本身不会直接运行任意函数。
- **Session 是跨组件的记录边界。** Agent 将用户输入、工具调用、工具结果和最终消息追加为带序号的事件；下一次模型请求从这些记录派生历史。
- **Web 收到线协议帧，而不是服务端对象。** Host 发送 JSON 快照与事件；Client 检查序号连续性，把事件投影为自己的状态；View 订阅 Client 状态变化。
- **清理顺序与启动顺序相反。** View 先停止订阅，再关闭 Web 流，最后清除工具注册，避免消费者仍在使用服务时服务已被撤销。

## 简化与边界

- `Application` 是教学用插件组合器，不是 Cordis，也没有 Profile、Bundle、配置校验、热更新或依赖就绪机制。
- `FakeLlm` 确定性地产生一次工具调用和一次最终回复；没有网络 Provider、Token 流、取消策略或真实模型凭据。
- `SessionLog` 只保存在内存中，没有持久化、压缩、恢复、并发写保护或 Harness 的完整事件合同。
- `LocalWebTransport` 用 JSON 字符串模拟 Gateway Remote Stream；没有 HTTP/WebSocket 服务器、认证、多路复用、重连、分页或缺口修复。
- Web 投影只处理本例涉及的事件，并以控制台文本代替真实浏览器 UI；没有助手草稿流、审批卡片、附件、子 Agent 和完整 Conversation 组装。
- 示例展示从 Agent 到 Web 的一次完整输出路径，不代表 Harness 的唯一运行模式或完整架构。
