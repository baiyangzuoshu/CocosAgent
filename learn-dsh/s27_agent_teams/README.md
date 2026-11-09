# 第 27 课：Agent Teams

**目标：** 让多个 Agent 通过同一份共享任务板读取进度、认领任务，并在 revision
变化时拒绝过期写入。

## 本课问题

子 Agent 各自有独立 Session。Team
怎样让它们共享任务状态？当两个成员同时尝试认领同一任务时，如何避免后写入覆盖先前状态？

## 本课增量

本课为 Lead root Session 建立一份共享任务日志。Lead、reviewer 和 writer
各有绑定成员身份的任务客户端，但它们都读写同一个
`TeamTaskBoard`。每次创建或状态改变都追加一份完整 `team/task`
快照；更新必须携带读取时的 revision，事务队列按顺序比较并提交。

```text
Lead Session / TeamJournal
  team/task task-1 revision=1 ─┐
  team/task task-2 revision=1  ├──► 同一份任务视图
  team/task task-1 revision=2  │      ├─ Lead
  team/task task-1 revision=3  │      ├─ reviewer
  team/task task-2 revision=2 ─┘      └─ writer

reviewer claim(expected=1) ──► revision 2: 成功
writer   claim(expected=1) ──► TEAM_TASK_STALE_REVISION: 拒绝
```

示例先创建“审查 API”和依赖它的“更新迁移指南”。writer
提前认领文档任务会被阻塞。reviewer 与 writer 随后用同一个 revision
争抢审查任务：一个更新成功，另一个因 revision
已过期失败。审查完成后，依赖任务变为 ready，writer 才能认领并完成它。

## 源码对照

- [`packages/team/agent-team/src/index.ts`](../../../deepseek-harness/packages/team/agent-team/src/index.ts)：注册
  `ctx.agentTeams` 服务及任务板 API。
- [`packages/team/agent-team/src/task-board.ts`](../../../deepseek-harness/packages/team/agent-team/src/task-board.ts)：按当前
  Agent 所属 root 读取同一任务板；检查 ready、owner 权限和 expected revision。
- [`packages/team/agent-team/src/journal.ts`](../../../deepseek-harness/packages/team/agent-team/src/journal.ts)：串行化
  root Session 事务，并将修改持久化为 Session 事件。
- [`packages/team/agent-team/src/types.ts`](../../../deepseek-harness/packages/team/agent-team/src/types.ts)：定义任务快照、revision、owner、依赖与
  `team/task` 事件。
- [`packages/team/tool-agent-team/src/index.ts`](../../../deepseek-harness/packages/team/tool-agent-team/src/index.ts)：提供
  `team_task_create`、`team_task_list`、`team_task_get` 和 `team_task_update`
  工具，并向 Agent 注入协作流程。
- [`packages/team/agent-team/README.zh.md`](../../../deepseek-harness/packages/team/agent-team/README.zh.md)：说明
  Team 模式、Lead 所有权、CAS 更新和任务就绪语义。
- [`packages/subagent/subagent/README.zh.md`](../../../deepseek-harness/packages/subagent/subagent/README.zh.md)：Agent
  创建、发现与成员通信仍由 subagent 运行时负责。
- [`docs/subsystems/agent-team.zh.md`](../../../deepseek-harness/docs/subsystems/agent-team.zh.md)：查看服务
  API、事件记录与完整 Team 语义。

## 代码结构

```text
s27_agent_teams/
├── README.md
├── deno.json
└── src/
    ├── main.ts
    ├── task-board.ts
    ├── team-journal.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：两个成员读取到相同任务列表；依赖未完成时不能 claim；并发更新使用相同
revision 时只会有一个提交成功；旧 revision 返回
`TEAM_TASK_STALE_REVISION`。每次成功变更都作为新的完整快照追加到 Lead 的
TeamJournal。

## 关键观察

- **Team 不负责创建 Agent。** subagent 工具创建和寻址队友；Team 工具共享 task
  state。各 Agent 的对话仍保存在自己的 Session。
- **任务板属于一棵树的 Lead root Session。** 同一树的成员通过 `ctx.agentTeams`
  读取共同状态；这不是任意 Session 之间的全局共享变量。
- **任务状态来自事件日志。** `team/task` 保存完整的有版本快照；Service 从 root
  Session 记录派生当前列表，并由 Session persistence 负责耐久性。
- **修改是 CAS。** 调用者先读取 task revision，再把该值作为 `expectedRevision`
  提交更新。revision
  不匹配会明确失败，调用者应重新读取后再决定，不可盲目重放旧动作。
- **claim 不会启动 Agent。** ready 只说明依赖满足；任务被认领后，Agent
  才按团队流程执行。任务变化本身不唤醒 Agent。
- **写入路径只是提示。** 实际服务会对并行任务的 `writeScopes`
  重叠发出警告，不会将它们当锁或阻止 claim。
- 新根 Session 默认未必启用 Team；实际工具需由 Agent Teams 模式打开。子 Agent
  的创建、消息和中断仍由 subagent 家族负责。

## 简化与边界

- 示例用内存 `TeamJournal` 模拟 Lead Session 的 `team/task` 事件；没有启用 Team
  模式、真实 Session 投影、磁盘持久化或恢复。
- reviewer 和 writer 是预先加入的成员 id；未复刻 subagent tree 发现、Lead/owner
  身份校验或模型可见工具 schema。
- 只实现 create、list、get、claim、complete 和最小依赖就绪检查；没有
  edit、reassign、release、reopen、delete、writeScopes 或完整 DAG 校验。
- Promise
  队列模拟串行事务；没有复刻真实存储的刷盘确认、取消时序、类型化的全部失败状态或
  `maxTasks` 上限。
- 示例展示一个 Agent 成功 claim、另一成员因 stale revision
  失败；没有并发文件写入或隔离工作区。所有成员仍共享同一检出目录。

---

下一课：[第 28 课「MCP 工具」](../s28_mcp_tools/README.md) 会将 MCP Server
的工具注册到 Harness ToolRegistry。
