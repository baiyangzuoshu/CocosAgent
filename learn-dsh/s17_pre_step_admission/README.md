# 第 17 课：输入准入与 Pre-step

**目标：** 看清一批已领取输入如何在 `step/start` 之前被接纳、改写或拒绝。

## 本课问题

Agent 已经从 Inbox 领取输入后，哪些消息会真正进入模型可见历史？怎样让一个监听器观察或修改准入决定，而不意外吞掉默认处理？

## 本课增量

本课在第 16 课的 Turn/Step 事件外加上 `agent/pre-step` waterfall。它接收带坐标的已领取批次；内层默认行为会以 `enter(messages)` 放行。观察型监听器调用 `next()` 并等待下游；策略型监听器可以有意不调用 `next()` 返回 `reject`，也可以在下游放行后替换最终消息批次。

```text
turn/start → claim inbox batch → agent/pre-step waterfall
                                    ├─ reject → turn/end { blocked }
                                    ├─ enter([]) → turn/end { completed }
                                    └─ enter(messages) → step/start
                                         → user/message → Fake LLM → step/end
                                      → turn/end { completed }
```

示例分别运行默认接纳、内容改写、拒绝和空批次四条路径。只有非空 `enter` 才打开 Step、追加 `user/message` 并调用 Fake LLM。拒绝以 `blocked` 结束 Turn；接受空批次则以 `completed` 结束，两者都不会发模型请求。

## 源码对照

- [`packages/core/agent/src/runtime-types.ts`](../../../deepseek-harness/packages/core/agent/src/runtime-types.ts)：`PreStepDecision` 与 `agent/pre-step` waterfall 事件合同。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：领取输入后调用 waterfall，并根据 reject/empty/enter 决定是否打开 Step。
- [`packages/core/agent-loop/tests/interception.spec.ts`](../../../deepseek-harness/packages/core/agent-loop/tests/interception.spec.ts)：默认 next 放行、消息替换、拒绝和空决策的行为示例。
- [`docs/architecture.md#turn-flow`](../../../deepseek-harness/docs/architecture.md#turn-flow)：Pre-step 在 Turn 内、Step 前的位置与事件顺序。
- [`docs/subsystems/core.zh.md#interception-decisions`](../../../deepseek-harness/docs/subsystems/core.zh.md#interception-decisions)：候选批次、最终决策及 `startsRequestSeries` 语义。
- [`docs/cordis-tutorial/04-events.md#waterfall-transform-or-short-circuit`](../../../deepseek-harness/docs/cordis-tutorial/04-events.md#waterfall-transform-or-short-circuit)：Waterfall 的 `next()`、包装与短路规则。

## 代码结构

```text
s17_pre_step_admission/
├── README.md
├── deno.json
└── src/
    ├── fake-llm.ts
    ├── main.ts
    ├── pre-step.ts
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

预期结果：默认接纳和改写两例各有一条 `user/message`、一次模型请求及完整 Step；拒绝例只有 `turn/start → turn/end blocked`；空批次例只有 `turn/start → turn/end completed`。改写保留原消息 id 和 source，只改变内容。

## 观察结果

- 候选消息在进入 Pre-step 前已从 Inbox 领取。拒绝不把它放回队列；最终决策中省略的候选也保持已领取状态。
- Waterfall 是 around-middleware：观察器必须 `await next()` 才能保留下游默认放行；返回而不调用 `next()` 是刻意短路，后续监听器和 fallback 都不会运行。
- `enter` 携带最终进入步骤的完整消息列表。监听器可以改写内容、替换列表或声明 `startsRequestSeries`；包装既有决策时应保留未修改的字段。
- `user/message` 只在非空批次接纳后、Step 已开始时提交。Pre-step 中被拒绝或改写掉的消息不会由本例追加到模型历史。
- 首个 Step 被拒绝以 `blocked` 结束；首个空 `enter` 以 `completed` 结束。两条路径都没有 `step/start`，空批次不是拒绝。

## 简化与边界

- 示例把单条消息当作已领取批次，省略 Session Inbox splice、消息冻结/校验、runtime context、tool schema 组装与 `modelSelection`。
- 示例用一个默认 `enter` 和两层 listener 模拟 Cordis waterfall；没有实现 Cordis 的 listener 注册、作用域过滤、取消 signal 或错误分发。
- Fake LLM 直接返回一条文本。它只在被接纳的非空批次上调用，不处理真实消息 content blocks、流式输出、重试或工具调用。
- `startsRequestSeries` 在类型中保留以映射真实决策字段，但本课不修改 request/header；模型路由和请求构造后续课程再讲。
- 特殊字符串标记只用于驱动教学分支，不是 Harness 内建策略或安全机制。

---

下一课：[Prompt 与运行时上下文](../s18_prompt_runtime_context/README.md) 会继续查看模型请求内容如何组装。
