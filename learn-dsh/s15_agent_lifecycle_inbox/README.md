# 第 15 课：Agent 生命周期与 Inbox

**目标：** 观察 Agent 何时进入可用状态、输入如何排队，以及关闭时怎样等待运行工作并撤销注册。

## 本课问题

创建一个 Agent 时，Session 初始化、setup 和创建监听器按什么顺序发生？普通 follow-up、上下文注入和关闭会怎样改变 Agent 的收件箱与生命周期？

## 本课增量

本课在第 14 课的注册表基础上加入 AgentLoop 生命周期和两条 Inbox 队列。`next-turn` 保存等待独立轮次的提示，`next-step` 保存等待下一个步骤边界的输入。两类队列都由 Session 中的 `agent/inbox/spliced` 事件持久化；live `agent/inbox/*` 通知则说明消息进入、被领取或被取消。

```text
create:
  session/created → setup → agents.enter → agent/created listeners (awaited)
                                                  ↓ ready: release queued wake
input: followup → next-turn + wake     inject → next-step, no wake
       claim: all next-step first, then one next-turn prompt
close: stop accepting input → wait for driver idle → agent/disposed → session/disposed
```

示例的 `agent/created` 监听器先注入上下文，再排入一条 follow-up。监听器尚未结束时，Inbox 已有两条输入，但 Agent 仍为 `idle`；创建通知完成后才释放 wake，driver 按边界领取输入。之后再次 `inject` 不会唤醒 Agent，`clear()` 则记录取消 splice 并逐条发出 discarded 通知。最后，创建者的 handle 等待 driver 停稳并拆除注册。

## 源码对照

- [`packages/core/agent/README.zh.md`](../../../deepseek-harness/packages/core/agent/README.zh.md)：创建/恢复、handle 所有权、followup、steer、inject 和 Inbox 生命周期语义。
- [`packages/core/agent/src/index.ts`](../../../deepseek-harness/packages/core/agent/src/index.ts)：`AgentRegistry.enter()`、`announce()` 以及有序创建/销毁通知。
- [`packages/core/agent/src/runtime-types.ts`](../../../deepseek-harness/packages/core/agent/src/runtime-types.ts)：Agent 与 Inbox API、`idle`/`running` 状态和 `agent/*` 事件合同。
- [`packages/core/agent/src/types.ts`](../../../deepseek-harness/packages/core/agent/src/types.ts)：`agent/inbox/spliced` 持久事件词汇。
- [`packages/core/agent-loop/src/index.ts`](../../../deepseek-harness/packages/core/agent-loop/src/index.ts)：Session 初始化、setup、Agent 发布、创建通知等待及 disposer 清理顺序。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：输入发送、wake、`whenIdle()` 与 status 转换。
- [`packages/core/agent-loop/src/inbox.ts`](../../../deepseek-harness/packages/core/agent-loop/src/inbox.ts)：Inbox 投影、splice 持久化及逐消息 live 通知。
- [`docs/subsystems/core.zh.md`](../../../deepseek-harness/docs/subsystems/core.zh.md)：Agent 状态、消息路由和 `agent/*` 事件说明。

## 代码结构

```text
s15_agent_lifecycle_inbox/
├── README.md
├── deno.json
└── src/
    ├── agent-loop.ts
    ├── inbox.ts
    ├── main.ts
    ├── session.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：创建监听器先完成；其间插入的上下文和提示暂不驱动 Agent。创建完成后 status 变为 `running`，Session 记录 Inbox 的插入与领取 splice，随后 status 回到 `idle`。空闲时的 `inject` 保持排队且不唤醒；`clear()` 记录 `outcome: canceled` 并发出 discarded。handle 关闭后 `get(id)` 返回 `undefined`，Agent 生命周期事件顺序以 `agent/disposed` 在 `session/disposed` 之前结束。

## 观察结果

- 创建先准备 Session 并完成 setup，再把 Agent 放入注册表并串行等待 `agent/created` 监听器；创建 promise 只有在监听器完成后才返回。监听器可以预装 Agent 专属能力或排队输入。
- `agent/created` 通知期间的 wake 会被暂存。只有发布流程完成后，`agent/status` 才从 `idle` 进入 `running`，避免初始化监听器尚未结束时就开始驱动。
- `followup()` 将消息排入 `next-turn` 并唤醒 driver；`inject()` 将上下文排入 `next-step`，不会自行唤醒。`steer()` 也针对 `next-step`，但会唤醒 driver；正在运行时的具体步骤边界留给后续课程。
- driver 领取一个新轮次的消息时，先取完 `next-step`，再取一条 `next-turn`。领取会记录删除 splice 并发出 `agent/inbox/claimed`，不是取消，因此不会发 `discarded`。
- `agent/inbox/spliced` 是 Session 的持久事件；投影从事件重建待处理队列。live 的 `inserted`、`claimed`、`discarded` 是 UI/协调用途的逐消息通知。
- 可观察状态只有 `idle` 和 `running`。Agent 关闭不是第三种 status：handle 先阻止新工作、等待 driver quiescence，再撤销注册并发出 `agent/disposed`。
- 创建者的 `AgentHandle` 持有 dispose 能力；注册表 `get()` 找到 Agent 并不赋予关闭权限。

## 简化与边界

- 示例用内存 Session 和确定性 driver，不启动 Cordis、不请求模型，也不实现 Session 持久化后端；只保留 Inbox splice 事件，并从事件折叠出待处理列表。
- 创建监听器仅展示串行等待和发布前暂存 wake。真实创建事务还包含持久化写句柄、取消信号、作用域 setup/commit、失败配对通知和完整回滚。
- 示例每次唤醒只领取一个简化边界；真实 driver 支持多个 turn/step、steer 在正在运行的回合中途进入下一步、取消竞态和 `whenIdle()` 跟随替代工作。
- 真实关闭还会取消并排空活动、撤销 Agent scope、关闭 Session 写路径，再 detach Agent 与 Session。本例没有 Cordis scope 与文件句柄，只展示等待、注册撤销和通知顺序。
- 实际 `Agent.inbox` 还提供 `append`、`prepend`、`replace`、`remove` 和 `splice`；示例只保留 `nextTurn`、`nextStep`、`clear` 以及 driver 内部使用的 claim。

---

下一课预告：第 16 课「Turn 与 Step」会把当前简化 driver 换成可观察的多步骤回合。
