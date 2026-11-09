# 第 26 课：子 Agent 委派

**目标：** 让父 Agent 创建一个有独立 Session 的子
Agent，交付自足任务，并收到子级完成结果。

## 本课问题

Agent 怎样把一项具体工作交给另一个 Agent？新建的子 Agent
会不会看到父级完整对话？它的答案怎样回到父级？

## 本课增量

本课在父 Session 中记录一次 `subagent` Tool Call，由 `SubagentManager` 创建新的
Agent 身份和 Session。子 Agent 的 Session 从空历史开始，只收到委派
prompt；它完成任务后，管理器将完成通知放进父 Agent 的 Inbox。父 Agent
消费该通知后，结果才进入父级后续模型历史。

```text
父 Session                                      子 Session
user: review README
assistant: tool-call(subagent, task) ───────► user: task prompt
tool: started agent-1                         assistant: child result
       ▲                                             │
       └──── parent Inbox ◄── completion notice ◄────┘
             user: agent-1 completed: ...
```

示例启动后先得到子级名称和启动回执，再等待结果。完成通知只携带子 Agent
的最终答案；子级内部历史没有复制到父 Session。

## 源码对照

- [`packages/subagent/subagent/src/manager.ts`](../../../deepseek-harness/packages/subagent/subagent/src/manager.ts)：统一管理子级接纳、创建、运行、结果捕获、清理和父级完成通知。
- [`packages/subagent/subagent/src/types.ts`](../../../deepseek-harness/packages/subagent/subagent/src/types.ts)：定义启动请求、activation
  句柄、结果和投递方式。
- [`packages/subagent/subagent-spawn-in-process/src/index.ts`](../../../deepseek-harness/packages/subagent/subagent-spawn-in-process/src/index.ts)：注册
  `spawn` 后端；其新子级不继承父 transcript，由 manager 通过 Agent 工厂创建。
- [`packages/subagent/tool-subagent/src/index.ts`](../../../deepseek-harness/packages/subagent/tool-subagent/src/index.ts)：把模型工具调用交给
  `ctx.subagents.startActivation()`；工具先返回子级名称，子级完成后再通知父
  Agent。
- [`packages/core/agent/src/index.ts`](../../../deepseek-harness/packages/core/agent/src/index.ts)：`ctx.agents.create()`
  通过已注册工厂创建新的 Agent 与 Session，并返回负责其生命周期的 handle。
- [`packages/core/agent/README.zh.md`](../../../deepseek-harness/packages/core/agent/README.zh.md)：说明
  Agent handle、Session 身份和创建工厂的关系。
- [`docs/subsystems/subagent.zh.md`](../../../deepseek-harness/docs/subsystems/subagent.zh.md)：查看提供方能力、一次性结果和
  parent/caller 投递语义。

## 代码结构

```text
s26_subagent_delegation/
├── README.md
├── deno.json
└── src/
    ├── agent.ts
    ├── fake-llm.ts
    ├── main.ts
    ├── session-log.ts
    ├── subagent-manager.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：父 Agent 与子 Agent 有不同的 Session id。父级原始问题、assistant Tool
Call 和“已启动”工具结果在父 Session；子模型请求只含子任务 prompt；完成通知回到父
Inbox，消费后作为一条新的 user message 进入父 Session。

## 关键观察

- **Session 身份独立。** 子 Agent 通过新 Agent 工厂调用创建新 Session；子
  Session 不等于父 Session 的历史切片。
- **任务输入显式化。** spawn 子级以空历史开始，委派 prompt
  必须带齐完成工作所需的信息。真实实现可继承 cwd、模型路由和
  lineage，但不会因此复制父级对话。
- **立即回执与最终结果分开。** `tool-subagent` 启动成功后先返回名称，后台
  activation 后续将最终结果投递给父级。工作流调用方也可以选择直接等待 activation
  的 `result`。
- **父级只收到被选中的输出。**
  完成通知携带结果摘要，不会把子级所有工具调用和中间消息灌入父级上下文。
- **管理器拥有生命周期。** 子级创建、取消、结果捕获、通知和释放由 subagent
  manager 协调；子 Agent 自己拥有 Session 与 Agent handle。
- 子 Agent 和父 Agent 可以共享同一个 Harness LLM、工具与服务组合，但各自的
  Session 历史仍然独立。

## 简化与边界

- 示例将 `subagent` 服务、spawn Provider 与 `tool-subagent`
  的关键路径合并进一个内存 `SubagentManager`，没有复刻 Cordis
  提供方注册、容量与深度限制、Agent preset 或权限继承。
- `AgentFactory` 和 AgentLoop 被缩成“一条 user prompt → 一条 assistant
  答案”；FakeLLM 只返回预设文本，不发送模型网络请求。
- 父级完成通知直接放入教学用 Inbox，再由 `receivePending()` 追加到父
  Session；真实 AgentLoop 使用 Steer/Queue 准入与生命周期结算。
- 示例只保留最终文本结果，省略结构化输出、子级继续对话、递归委派、取消、失败恢复、持久化以及资源清理等待。
- 真实 `SubagentActivation` 还包含 dispose 能力；本课省略它，只展示独立 Session
  和结果回传的核心关系。
