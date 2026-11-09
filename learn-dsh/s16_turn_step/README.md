# 第 16 课：Turn 与 Step

**目标：** 用一个确定性的 Fake LLM 观察：一个 Turn 可以跨多个 Step，每个 Step 完成一次模型请求及其工具调用。

## 本课问题

一次用户请求何时开始、何时结束？模型请求和工具调用如何被分到 Step 中？为什么模型调用两次，Session 里仍然只有一个 Turn？

## 本课增量

本课从一条已接受的用户输入开始：Turn 打开后，Step 1 请求 Fake LLM；模型返回一个库存查询调用，driver 记录并执行它；工具结果进入 Session 后，driver 开始 Step 2，第二次模型请求读取更新后的历史并生成最终回答。两个 Step 都落在 Turn 1 中。

```text
turn/start
  step/start 1 → user/message → Fake LLM → assistant/tool-call
             → tool/call → tool/result → step/end 1
  step/start 2 → Fake LLM (history includes tool/result)
             → assistant/message → step/end 2
turn/end { completed }
```

核心边界：Step 是一次模型请求及其请求的工具执行；Turn 是从领取输入到没有后续工作的一段循环。成功回答且无工具调用时，Step 返回 completed；本课的工具步骤产生了后续请求，因此先结束当前 Step，再在同一 Turn 里开启下一个 Step。

## 源码对照

- [`docs/architecture.md#turn-flow`](../../../deepseek-harness/docs/architecture.md#turn-flow)：Turn 与 Step 的完整事件顺序，以及它们与 pre-step、模型流和工具事件的关系。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：`turn()` 控制循环、`step()` 发起模型流并处理工具批次。
- [`packages/core/session/src/types.ts`](../../../deepseek-harness/packages/core/session/src/types.ts)：`turn/start`、`step/start`、`assistant/message`、`tool/call`、`tool/result` 等持久事件合同。
- [`packages/core/agent-loop/README.zh.md`](../../../deepseek-harness/packages/core/agent-loop/README.zh.md)：AgentLoop 的轮次与步骤流程、每步骤请求和关闭条件。

## 代码结构

```text
s16_turn_step/
├── README.md
├── deno.json
└── src/
    ├── fake-llm.ts
    ├── main.ts
    ├── session-log.ts
    ├── turn-runner.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：Fake LLM 收到两次请求，坐标分别为 `1.1` 和 `1.2`；第二次历史包含第一步的 assistant 工具调用与工具结果。Session timeline 中 `turn/start` 与 `turn/end` 各一条，`step/start` 与 `step/end` 各两条。

## 观察结果

- `turn/start` 在领取首批输入前记录；输入通过 step 1 的 `user/message` 进入模型可见历史。
- 每次已接纳的模型请求都有自己的 `step/start` 和 `step/end`。一次 turn 可以有多个 step，但它们共享 turn 编号。
- Fake LLM 的第一条响应包含 `tool-call`。工具执行记录 `tool/call` 与 `tool/result`，然后结束 Step 1；工具结果成为第二次请求历史的一部分。
- 第二条响应不再请求工具，Step 2 返回 completed，Turn 1 随后写入 `turn/end { kind: 'completed' }`。
- 所有 Turn、Step、assistant、工具调用和工具结果都是 Session 持久事件；终端里的 Fake LLM 请求行只是教学观测输出。

## 简化与边界

- 示例不复刻 Cordis、Inbox、pre-step 准入、Prompt 组装、request header/context、流式 assistant frame、取消、重试或 checkpoint；这些边界分别由前后课程展开。
- Fake LLM 直接返回完整响应对象，不模拟 token stream。它的第一条响应固定请求一个工具，便于看清两次模型请求如何归属同一 Turn。
- `lookup_stock` 是硬编码的演示分支。没有工具 schema 注册、参数校验策略、审批、并行执行、结果呈现 hook 或失败恢复；课程 21–23 再逐步覆盖这些机制。
- Session 的消息历史投影只抽取 user、assistant 和 tool/result 三种消息，省略 system prompt、header、上下文投影、表面替换及 token 计量。
- 真实 AgentLoop 还支持无 Step 的空输入/拒绝 Turn、多个后续 Turn、Step 间 steering、取消与结构化失败原因。本例只走一个成功 Turn。

---

下一课：[输入准入与 Pre-step](../s17_pre_step_admission/README.md) 会在 Turn 打开后、Step 开始前处理消息接纳。
