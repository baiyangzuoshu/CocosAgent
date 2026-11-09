# 第 23 课：工具结果与完整回合

**目标：** 跑通一次模型工具调用闭环：assistant 请求工具、工具结果回到历史、模型在下一步继续并完成回合。

## 本课问题

工具实现已经能被注册和调用。调用之后，结果怎样与原 Tool Call 配对？下一次模型请求从哪里取得工具结果？什么时候 Agent 才写入 `turn/end`？

## 本课增量

本课把第 21–22 课的注册与执行能力接入一个简化 AgentLoop。Fake LLM 第一步发出 `search_notes` Tool Call；AgentLoop 把 assistant message 写入 Session，执行工具并追加关联的 `tool/call`、`tool/result`；第二步从 Session 派生历史，将 assistant 工具请求和 tool-role 结果一起交给模型，再记录最终回答并结束 turn。

```text
request 1: user
    │
    ▼
assistant(message: tool-call)
    │ append tool/call → execute → append tool/result(role=tool)
    ▼
request 2: user + assistant(tool-call) + tool(result)
    │
    ▼
assistant(message: text) → turn/end(completed)
```

示例打印两个模型请求和完整事件日志。`tool/call` 是记录调用事实的日志事件；模型历史里携带的是 assistant message 中的 Tool Call block 与关联 `tool/result` 形成的 ToolResultMessage。

## 源码对照

- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：将成功的 assistant message 写入 Session；发现 tool-call block 后调用 `ctx.tools.execute()`；普通工具批次完成后返回下一个 step，而不是结束 turn。
- [`packages/core/tools/src/batch.ts`](../../../deepseek-harness/packages/core/tools/src/batch.ts)：在工具开始前写 `tool/call`，完成后写入由 `callId` 关联的 `tool/result`；结果按模型请求顺序结算。
- [`packages/core/session/src/types.ts`](../../../deepseek-harness/packages/core/session/src/types.ts)：定义 `tool/call`、`tool/result` 与 turn/step 边界；`tool/result` 的 `sourceEventSeqs` 指向对应调用事件。
- [`packages/llm/llm/src/types.ts`](../../../deepseek-harness/packages/llm/llm/src/types.ts)：`ToolCallBlock` 保留模型给出的原始 JSON arguments。
- [`packages/llm/llm/src/message.ts`](../../../deepseek-harness/packages/llm/llm/src/message.ts)：`ToolResultMessage` 以 `toolCallId` 回答相应调用。
- [`packages/core/session/README.zh.md`](../../../deepseek-harness/packages/core/session/README.zh.md)：`deriveMessages()` 只把 surface message 投影进后续模型历史；`tool/call` 本身不是一条模型消息。
- [`docs/architecture.md#turn-flow`](../../../deepseek-harness/docs/architecture.md#turn-flow)：工具调用在 Agent、Session、LLM 之间的先后关系。
- [`docs/tool-execution-pipeline.zh.md`](../../../deepseek-harness/docs/tool-execution-pipeline.zh.md)：工具结果如何经过规范化并成为单一模型可见结果。

## 代码结构

```text
s23_tool_round_trip/
├── README.md
├── deno.json
└── src/
    ├── agent-loop.ts
    ├── fake-llm.ts
    ├── main.ts
    ├── session-log.ts
    ├── tool-registry.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：模型调用两次。第一个请求只含 user 消息；第二个请求包含 user、assistant 的 tool-call 和 role 为 `tool` 的结果。Session 日志中，`tool/result` 的 `sourceEventSeqs` 指向 `tool/call` 的序号，最终 turn 以 `completed` 结束。

## 观察结果

- Tool Call 是 assistant 内容中的结构化 block，不是工具返回值。调用 id 把 ToolResultMessage 与发起请求配对。
- `tool/call` 在执行前记录原始 JSON 参数；执行后追加 `tool/result`，且 Session 事件引用对应 call 序号。
- ToolResultMessage 使用 `role: "tool"` 并保留 `toolCallId`。下一次模型请求通过派生历史看到工具输出，不是通过 AgentLoop 临时变量直接拿到。
- 一次 turn 可以跨多个 `step`：收到工具请求并执行后，当前 step 结束，模型历史继续驱动下一 step；只有不再需要工具且模型返回最终文本后才完成 turn。
- 工具失败也会形成 `isError: true` 的 tool-role 结果，让模型根据错误继续或结束；它不会天然变成 AgentLoop 的 turn error。
- `tool/call` 是诊断和关联事实；assistant tool-call block 与 tool result surface message 才进入模型上下文。
- 示例为避免无限循环设置了本地 `maxSteps` 上限；真实 Session `TurnEndReason` 没有名为 `max-steps` 的结束原因。

## 简化与边界

- Fake LLM 直接返回完整 assistant message，不复刻第 19–20 课的 Provider 适配与流式 chunk 组装。
- 只执行一个串行调用；真实批次支持多个 call、并行安全分类、执行上限、取消结算和模型顺序提交。
- ToolRegistry 不复刻第 21–22 课的完整 schema 编译、参数校验、输出校验和 timeout-policy，只保留闭环所需的最小调用面。
- SessionLog 只投影 user/assistant/tool-result 消息，没有真实 message id、compact stream、surface replace 和 persistence。
- 省略 `concludesTurn` 工具、工具审批、Inbox 更新、pre-step hooks 和模型请求错误重试。

---

下一课预告：第 24 课会在工具执行前加入一次性人工审批，观察允许与拒绝两条路径。
