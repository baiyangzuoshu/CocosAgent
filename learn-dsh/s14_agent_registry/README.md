# 第 14 课：Agent 接口与注册表

**目标：** 看清消费方怎样通过统一的 Agent 服务创建、查找实时 Agent，同时不依赖具体驱动器。

## 本课问题

UI、插件和编排器怎样使用同一种 Agent 接口？谁负责创建 Agent，谁能查到它，谁有权结束它？

## 本课增量

注册表把“创建能力”和“查找能力”收在稳定入口后面。消费方调用 `create()`，注册表委托当前工厂；具体工厂构建 Session 与 Agent，并把 Agent 发布到注册表。`get()` 和 `list()` 只返回当前已发布的 Agent。创建者拿到的 `AgentHandle` 还带有 `dispose()`，而查找者只拿到 Agent 本身。

```text
consumer ── create(options) ──> AgentRegistry ──> AgentFactory / AgentLoop
   │                                ▲                     │
   │                                └──── enter(agent) ───┘
   ├── get(id) / list() ──> live Agent
   └── AgentHandle.dispose() ──> 移除自己创建的 Agent
```

示例用两个不同的模拟工厂依次提供 Agent。消费函数始终只调用注册表 API，展示具体驱动实现可以替换；注册表按 Session id 找 Agent，创建者的 handle 则是释放它的能力凭据。

## 源码对照

- [`packages/core/agent/README.zh.md`](../../../deepseek-harness/packages/core/agent/README.zh.md)：`ctx.agents` 的创建、恢复、查找入口与创建者 handle 语义。
- [`packages/core/agent/src/types.ts`](../../../deepseek-harness/packages/core/agent/src/types.ts)：公开 `Agent` 的基础身份接口；运行时实现还会提供更多能力。
- [`packages/core/agent/src/index.ts`](../../../deepseek-harness/packages/core/agent/src/index.ts)：`AgentRegistry.create()`、`setFactory()`、`enter()`、`get()` 和 `list()`。
- [`packages/core/agent-loop/src/index.ts`](../../../deepseek-harness/packages/core/agent-loop/src/index.ts)：默认循环实现注册 AgentFactory，并创建具体 Agent。
- [`docs/subsystems/core.md`](../../../deepseek-harness/docs/subsystems/core.md)：`agent` 契约与 `agent-loop` 实现的依赖边界。

## 代码结构

```text
s14_agent_registry/
├── README.md
├── deno.json
└── src/
    ├── demo-factory.ts
    ├── main.ts
    ├── registry.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：`loop-A` 和 `loop-B` 分别创建一个 Session id 不同的 Agent；消费方每次都能从 `get()` 找到同一实例，`list()` 显示实时项。创建者调用 `dispose()` 后，该 Agent 不再能通过 `get()` 查到。

## 观察结果

- `Agent` 是扩展点的稳定面；具体驱动器负责创建并驱动它。消费方依赖 Agent 契约和注册表，不必依赖默认 `agent-loop` 包。
- 创建时由调用方给出 Session id；Agent 与 Session 共享这个身份。注册时检查两者 id 一致，并拒绝仍在注册表中的重复 id。
- `get(id)` 返回 `Agent | undefined`，`list()` 返回当前实时 Agent 的新数组。两者都不暴露创建者的释放能力。
- `create()` 返回 `AgentHandle`。只有创建者持有这个 handle；`get()` 找到对象并不意味着可以拆除它。
- 工厂提供创建，注册表提供统一发现。示例通过依次更换工厂显示消费者代码不变。

## 简化与边界

- 真实 `Agent` 是 Session 支撑的运行对象，公开类型还通过运行时扩展提供消息、模型、状态和 Agent Context 等能力；本例只保留身份及关联 Session。
- 真实 `AgentRegistry.create()` 把调用者 Context 一并交给 `AgentFactory.createAgent()`；默认 `agent-loop` 自己完成 Session 初始化、setup、发布、事件通知和回滚。本例只演示工厂委托与发布。
- 真实 registry 还处理有序创建/销毁通知、作用域归属、工厂卸载和异步发起方链。本例不实现 Cordis、并发生命周期、`resume()`、Inbox 或 Turn；这些在后续课程展开。
- 本例的 `dispose()` 只撤销注册表条目，不停止循环或删除 Session 持久化数据。

---

下一课：[Agent 生命周期与 Inbox](../s15_agent_lifecycle_inbox/README.md) 会继续观察创建、输入排队和关闭过程。
