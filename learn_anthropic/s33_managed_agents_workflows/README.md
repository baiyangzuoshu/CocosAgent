# 第 33 课：Claude Managed Agents Workflow Runs 如何并行编排复杂任务？

**目标：** 能比较 Subagents、Dynamic Workflows 和 Advisor 三种协作方式，并说明 Workflow Run 如何分阶段并行工作、如何观测完成状态，以及启动审批、预算、失败和中断的边界。

## 本课问题

一个 Agent 何时应把任务交给其他 Agent？Workflow Run 与普通 Subagent 有什么区别？为什么 Session 变成 idle 或某个 Run 显示 completed，都不足以单独证明工作已完整且正确？

## 官方资料

- [Multiagent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)：Subagents、Dynamic Workflows、Advisor 及其配置边界。
- [Workflow runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)：工作流阶段、事件、结束条件、中断、预算和限制。
- [Session threads](https://platform.claude.com/docs/en/managed-agents/session-threads)：多 Agent 子线程、活动状态、审批事件和归档。
- [Session budgets](https://platform.claude.com/docs/en/managed-agents/budgets)：跨线程共享的 Session 预算与暂停行为。
- [第 32 课：Managed Agents 资源与生命周期](../s32_managed_agents_lifecycle/README.md)：Agent、Environment、Session、Vault 与数据留存基础。

核对日期：2026-11-10。Multiagent orchestration 和 Workflow Runs 当前仍标记为 Beta，并使用 beta header `managed-agents-2026-04-01`。模型、字段、预算限制、事件和平台支持可能更新；接入前应重新核对目标平台的官方文档。

## 1. 先决定要委派哪一种工作

Managed Agents 提供三种协作方式，控制权和执行结构不同：

| 方式 | 工作如何推进 | 适合的情况 | 需要记住的边界 |
| --- | --- | --- | --- |
| **Subagents** | 主 Agent 将具体任务交给子 Agent，接收结果后可以继续追问。每个子 Agent 有自己的 Session Thread。 | 需要一个或少数专家分别处理有边界的子任务，主 Agent 要复查或追问。 | 主 Agent 决定下一步；上下文分离，但线程在归档前可继续使用。 |
| **Dynamic Workflows** | 主 Agent 编写 Workflow 程序；服务端在后台运行多个 Agent，按阶段收集和传递结果。 | 多个可并行任务、长流程或需要重复检查与汇总的工作。 | 每个 Run 会消耗 Session 预算；Agent 创建 Run 前没有单独的审批步骤。 |
| **Advisor** | 主 Agent 在关键节点咨询另一个模型，然后仍由主线程继续完成任务。 | 希望对规划或结果做第二意见，但只需要一个 Agent 实际执行。 | Advisor 提供判断，不接管任务流程；咨询也会产生用量。 |

这些能力在 Agent 的 `multiagent` 配置中声明。可用的 Subagents 和 Workflow Agent 可以是预先定义的 Agent，也可以由主 Agent 或 Workflow 临时定义。系统提示可以说明何时应使用 Workflow Run、任务如何切分以及失败如何处理；如果需要限制可调用的 Agent，应在配置中列出允许的 Agent。[Multiagent orchestration](https://platform.claude.com/docs/en/managed-agents/multiagent-orchestration)

## 2. 理解 Workflow Run 的组成

Workflow 是 Agent 为当前任务写出的程序；Workflow Run 是该程序的一次执行。服务端在后台运行它，主 Agent 可以继续与用户交互或查看进度。一个 Run 可以按阶段安排工作：

~~~text
Session 的主 Agent
       │ 启动
       ▼
Workflow Run（后台程序）
       ├── 阶段一：Agent A 与 Agent B 并行检查不同资料
       ├── 阶段二：汇总结果，处理不一致
       └── 阶段三：Agent C 复核遗漏并形成报告
                  │
                  ▼
            主 Agent 读取 Run 结果
                  │
                  ▼
            回复用户或继续下一步
~~~

每个 Workflow Agent 在自己的 Session Thread 中运行。Thread 有独立的对话历史；Run 中的 Agent 共用 Session 沙箱中的文件。Workflow 程序决定下一步由谁工作，并把前一阶段结果传给后续 Agent。它可以并行分派任务、根据返回结果选择分支、重复一个检查阶段，或定义失败后的处理方式。[Workflow runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)、[Session threads](https://platform.claude.com/docs/en/managed-agents/session-threads)

因此，上下文隔离不等于执行环境隔离：不同 Agent 虽有各自的对话历史，但会在同一个 Session 沙箱处理文件，且会使用 Session 可解析的凭证。委派前应给每个 Agent 只传完成子任务所需的输入，并确认共享文件与凭证的可见范围。

## 3. 让应用能跟踪 Run，而不只看 Session 状态

Workflow Run 的进度事件会进入 Session 主事件流。常见事件可以这样理解：

| 事件 | 含义 | 应用处理方式 |
| --- | --- | --- |
| **workflow_run.created** | Run 已启动，包含 Run ID、名称、描述和声明的阶段。 | 建立 Run 记录、展示阶段；这代表工作已经开始，不是启动前审批通知。 |
| **workflow_run.phase_started / phase_ended** | 阶段开始或结束。 | 按 Run ID 与阶段 ID 更新进度；不要仅凭阶段结束事件判断结果质量。 |
| **session.thread_created** | 某个 Agent Thread 已创建；可用其中的 workflow_run_id 归属到 Run。 | 跟踪对应 Thread 的运行、审批等待与错误。 |
| **workflow_run.status_idle** | Run 暂停，例如达到 Session 预算。 | 说明运行暂歇；核实暂停原因与后续恢复条件。 |
| **workflow_run.error** | Run 启动被拒或运行中出现错误。 | 记录安全的错误信息；如果 Run 已创建，继续跟踪到最终结束事件。 |
| **workflow_run.status_ended** | Run 已结束，并提供结果类型。 | 检查结果与各 Thread 的事件，再决定向用户报告什么。 |

Workflow Run 事件进入 Session event stream，但不会触发 Webhook。若应用重连，新的事件流不会重放断线期间的事件；应通过 Session 历史事件补齐 Run 状态。事件流适合观察实时过程，历史事件用于重连后恢复状态。[Workflow runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)

**不要把 Session idle 当作完成信号。** 达到预算后，Run 可以暂停，Session 变成 idle，但 Run 仍处于 open 状态。较完整的完成判断是：已观察到的每个 Run 都有 `workflow_run.status_ended`，随后 Session 又以 `stop_reason: end_turn` 进入 idle。若 Agent 读取 Run 结果后启动了新 Run，还要继续跟踪新 Run。

**也不要把 completed 当作质量结论。** `result.type: completed` 说明 Workflow 程序结束；即使个别 Thread 执行失败或没有创建，Run 仍可能报告 completed。需要查看各 Thread 的事件、结果与异常，再由应用自己的评估或人工复核判断任务是否通过。

## 4. 把启动审批和停止控制放在正确的位置

Workflow Run 在 Agent 编写 Workflow 的同一轮就会启动；API 没有一项自动的“先展示计划、等待用户批准、再开始”步骤。因此，对发邮件、改数据或大规模处理文件等操作，应在系统提示中要求 Agent 先说明计划和阶段，并明确等待授权后再创建 Run。等到收到 `workflow_run.created` 时，Run 已经启动了。

工具权限策略仍然适用于工作流内的工具调用。需要人工批准的操作应由应用接收确认请求、展示具体操作和参数，再决定是否允许；并行运行时，请求属于具体 Thread，应记录 Thread ID 与工具调用 ID。把启动计划批准和运行中工具批准分别建模，避免把其中一种误当成另一种。

调用 `user.interrupt` 会中断主 Agent 当前轮次，但不会自动结束后台 Run；Run 可能继续，也可能暂停。需要停止 Run 时，应让 Agent 停止该 Run，并跟踪到 `workflow_run.status_ended`。若有 Thread 正等待应用返回工具结果或确认，先处理或拒绝该待办请求；不要因为主 Session 已 idle 就认为资源全部停止。[Workflow runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)

## 5. 用预算、限制和结果检查控制并行成本

所有 Workflow Thread 的模型用量计入同一个 Session 预算；不同 Thread 可使用不同模型，费用按各自模型的用量计算。达到预算后，开放中的 Run 会暂停；提高或移除预算可能恢复这些 Run。暂停期间 Run 的生命周期仍在流逝，长时间等待也可能最终超时。[Session budgets](https://platform.claude.com/docs/en/managed-agents/budgets)、[Workflow runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)

| 官方文档核对时的限制 | 课程中的使用提醒 |
| --- | --- |
| 单个 Run 同时运行的 Thread 数量列为 64，但文档说明接口不保证一定达到。 | 不要用并行数量作确定性的延迟承诺。 |
| 单个 Run 生命周期内最多启动 1,000 个 Agent。 | 大批量任务应切批、抽样复核并设置明确预算。 |
| Run 默认生命周期为 24 小时，可由 Agent 设置。 | 等待用户或工具的时间也计入生命周期。 |
| 单个 Session 默认最多同时有 10 个开放 Run，idle 的 Run 也计入。 | 应用需要限制并发并清理或结束不再需要的任务。 |

以上数字是 2026-11-10 官方文档快照，平台可能调整；生产实现应查当前 Limits 页面，并基于账户实际限额做容量设计。

## 练习：审查一批供应商安全问卷

团队要审查 80 份供应商问卷，关注数据留存、访问控制、事件响应三类风险，并对高风险结论进行交叉复核。请设计 Workflow 阶段和 Agent 分工；说明用户审批、预算、事件跟踪、部分 Agent 失败和最终验收应如何处理。

**参考答案：** 先让 Agent 提出阶段与分工计划并等待确认；获得授权后启动 Run。第一阶段让三个专门 Agent 并行读取不同问卷或风险维度，且只获取完成任务所需的资料；第二阶段汇总发现并标记证据与冲突；第三阶段由独立复核 Agent 检查高风险项和遗漏。应用打开 Session stream，按 Run ID 和 Thread ID 追踪创建、阶段、工具确认、错误与最终状态；将所有 Thread 用量纳入 Session 预算。Run 即使结束为 completed，也逐项查看失败 Thread 和引用依据，再按既定判据验收。主线程被 interrupt 后仍确认 Run 已终止，最后保存审计需要的输出并按第32课的数据留存边界删除 Session。

## 本课结论

Workflow Run 把多个 Agent、阶段与结果汇总组织为一段后台执行程序，适合可切分并行且需要阶段性复核的长任务。设计时同时确认共享沙箱与凭证范围、启动前的计划批准、运行中的工具确认、事件流恢复、Session 预算、Run 停止条件和对 Thread 结果的独立验收。Run 的完成状态描述流程是否结束，不自动证明结论正确。

## 范围与时效

- 官方文档核对日期：2026-11-10；Multiagent orchestration 和 Dynamic Workflows 当时为 Beta。
- 并发数量、生命周期、事件与配置字段均可能变化；按部署平台复核最新文档。
- Agent、Environment、Session、Vault 与保留范围见第32课；常规工具权限和人工确认设计见第27课。
