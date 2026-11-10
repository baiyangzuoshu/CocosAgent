# 第 34 课：Claude Managed Agents Scheduled Deployments 如何运行周期任务？

**目标：** 能区分 Deployment、Deployment Run 和 Session，配置周期触发条件，监控每次调度的创建结果，并说明暂停、失败、预算与 Webhook 的边界。

## 本课问题

如何让 Claude Managed Agents 按固定节奏启动工作？计划触发、Deployment Run 和实际 Agent Session 是什么关系？发生暂停或创建失败后，应用应怎样检查下一次执行而不重复或遗漏业务副作用？

## 官方资料

- [Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments)：Deployment 配置、cron 时区、运行历史、失败处理和生命周期。
- [Subscribe to webhooks](https://platform.claude.com/docs/en/managed-agents/webhooks)：Deployment 与 Deployment Run 事件、签名校验、重复投递和补查策略。
- [Session budgets](https://platform.claude.com/docs/en/managed-agents/budgets)：每个 Session 的费用上限及预算暂停行为。
- [第 32 课：Managed Agents 资源与生命周期](../s32_managed_agents_lifecycle/README.md)：Agent、Environment、Session、Vault 与数据留存基础。
- [第 33 课：Workflow Runs 并行编排](../s33_managed_agents_workflows/README.md)：在一次 Session 中拆分并行子任务。

核对日期：2026-11-10。Scheduled Deployments 和 Webhooks 当前均标为 Beta，并使用 beta header `managed-agents-2026-04-01`。调度语法、时区处理、事件名、预算和平台支持会变化；部署前按目标平台复核。

## 1. 分清 Deployment、Deployment Run 和 Session

Scheduled Deployment 是一份可重复使用的执行配置：它把 Agent、Environment、启动事件、可选凭证与预算绑定到一起，并可附加周期 schedule。每次触发后，平台尝试用这份配置创建一次新的 Session。

| 概念 | 代表什么 | 需要追踪什么 |
| --- | --- | --- |
| **Deployment** | 要重复执行的配置及调度状态。 | 当前 Agent 和 Environment、schedule、时区、预算、active/paused/archived 状态。 |
| **Deployment Run** | 一次触发尝试的记录；包括调度触发或手动触发。 | 成功时关联的 Session ID；失败时的错误类型和消息。 |
| **Session** | 某次成功启动后，Agent 实际执行任务的会话。 | Agent 事件、工具审批、结果、预算和会话留存。 |

可以把生命周期看成：

~~~text
Deployment 配置
      │ 到达计划时间
      ▼
Deployment Run（记录这次触发是否成功）
      │ 成功
      ▼
新的 Session（执行初始事件中的任务）
      │
      ├── 追踪 Session 事件、工具确认、预算和结果
      └── 保存所需产物，再按数据策略留存或删除
~~~

Deployment Run 与 Session 生命周期分开记录：Session 创建失败时，仍会有失败的 Run 记录，但不会有关联的 Session；成功时 Run 记录带有 `session_id`。因此，检查调度是否工作要看 Run 历史；检查 Agent 执行过程则要继续看对应 Session。[Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments)

## 2. 配置启动事件、cron 和时区

创建 Deployment 时，至少要指定 Agent、Environment，以及一个启动 Session 工作的初始事件：`user.message` 或 `user.define_outcome`。仅配置 cron 时间不会告诉 Agent 每次要完成什么；应把可重复的任务说明放进启动事件，并把每次需要变化的上下文从安全、可复查的输入来源提供。

当前文档说明 Deployment 的 schedule 使用五段式 POSIX cron：分钟、小时、月内日期、月份、周内日期；最小精度为分钟。Timezone 使用 IANA 名称，例如 `America/Los_Angeles` 或 `UTC`。Cron 按配置时区的本地墙上时间匹配；若运营依赖明确的绝对时间，应仔细选择 UTC 或业务时区，并核对夏令时转换行为。

Deployment 对象中的 `upcoming_runs_at` 可用来确认接下来的计划时间。但平台会为分散负载加入调度抖动，实际 Session 可能在计划时间之后启动；不要把它当成精确到秒的闹钟。手动触发可以先验证配置：它会立即启动一个 Session，并以 `trigger_context.type: manual` 记入 Deployment Run。[Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments)

## 3. 区分周期自动运行和手动运行

手动 Run 适合发布 schedule 前验证 Agent、Environment、Vault 和启动提示能否配合工作。它不会改变 Deployment 的计划下次运行时间，也不会发出 scheduled Deployment Run 的 Webhook 事件；应用仍可通过手动 Run 的 Deployment Run 记录查看关联 Session。

周期运行触发后，需要分别处理两条状态线：

1. **Deployment Run 状态：** 这次计划是否创建了 Session；失败时记录具体 `error.type`。
2. **Session 状态：** 创建成功后，Agent 是否正在运行、等待人工确认、到达预算、正常结束或遇到错误。

例如，收到 `deployment_run.succeeded` 只表示该次 Run 创建了 Session，不代表 Agent 已完成任务。接下来应根据 Run 的 ID 取回 Session ID，订阅或查询 Session 状态，并在需要时安排人工检查。[Subscribe to webhooks](https://platform.claude.com/docs/en/managed-agents/webhooks)

## 4. 用 Run 历史、Webhook 和补查形成监控闭环

Scheduled Deployments 会为每次触发建立 Deployment Run 记录。成功 Run 含 Session ID；失败 Run 含错误类型。可以查询 Run 历史并筛选失败记录，区分调度没启动与 Session 启动后任务失败。

Webhook 能通知 Deployment 生命周期变化和 scheduled Run 的 started、succeeded、failed 事件。Webhook payload 提供事件 ID 与资源 ID；收到后应校验签名，再按资源 ID 读取当前 Deployment 或 Run。相同事件可能重复投递，且不同事件不保证按发生顺序到达；处理器应对 event ID 去重，并以取回的资源状态为准。

Webhook 不是耐久事件日志：投递失败超过重试后，事件可能丢失，之后订阅也不会补发过去的事件。若审计要求覆盖每次运行，定期查询 Deployment Run 列表，并将 Webhook 当作低延迟通知。对事件与列表结果做去重，避免重复生成报告、通知或外部写入。[Subscribe to webhooks](https://platform.claude.com/docs/en/managed-agents/webhooks)、[Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments)

## 5. 维护暂停、归档和失败恢复

| 操作或情况 | 对 schedule 的影响 | 处理方法 |
| --- | --- | --- |
| **Pause** | 后续自动触发停止；已经启动的 Sessions 继续运行。暂停期间仍可手动触发。 | 修复或维护期间使用；同时单独查看在运行的 Sessions。 |
| **Unpause** | 从下一个计划时间恢复；暂停期间错过的触发不会补跑。 | 如需补做，明确调用手动 Run，并在审计中标记原因。 |
| **Archive** | 终止 Deployment 的计划，且不可再修改。 | 仅在确实结束该自动化时使用；若之后还需运行，创建新的 Deployment。 |
| **Session 创建被限流** | 记录 `session_rate_limited_error` 失败 Run，不在本次时间点重试。 | 查看 Run 错误和容量；调度会在下一次计划触发时再尝试。 |
| **不可恢复的资源错误** | 例如 Environment 或 Vault 已归档时，记录失败 Run，并自动暂停 Deployment。 | 修复资源或配置，再明确恢复 Deployment。 |
| **Agent 被归档或删除** | Deployment 会被归档，可能在归档操作时或下一次计划触发时发生。 | 检查 Agent 和依赖版本；需要继续调度时建立可用配置和新 Deployment。 |

不要只监控 Agent Session 的状态：如果创建失败，就没有 Session 可供查询。也不要只看 Deployment 是否为 active：失败 Run 可能已经让它自动暂停。应结合 Deployment 生命周期事件和 Run 历史进行检查。[Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments)

## 6. 预算是每个 Session 的上限，不是周期累计预算

Deployment 可以设置 Session budget。每次触发所创建的 Session 都会复制该上限，所以这个值限制单次运行成本，不会限制一周或一个月所有运行的累计总额。修改 Deployment 的预算只影响后续创建的 Sessions；已启动的 Session 保留原有上限，需要时单独修改。

周期任务应同时估算单次成本、计划频率和累计月成本，并由应用或组织账务策略设置总量监控。预算达到上限会暂停 Session，而不是自动归档 Deployment；下一次 cron 仍可能再次创建一个新的 Session。若 Agent 需要人工确认才能继续，应用要监听 Session 的等待状态并决定如何处理，不能假定无人值守任务会自行完成。[Session budgets](https://platform.claude.com/docs/en/managed-agents/budgets)

周期 Deployment 会重复运行有权限的 Agent，故工具范围、Vault 凭证、网络规则和初始任务必须按最小权限设置。安排写操作前，先决定何处要求人工审批、如何防止重复副作用，以及失败后是否允许手动补跑。Scheduled Deployment 创建的 Session 沿用第32课介绍的留存和合规边界；周期执行不会自动变成无状态或短留存模式。

## 练习：每个工作日生成支持工单日报

团队希望每个工作日早上 9 点读取最近一天的支持工单，生成按严重性排序的摘要。摘要可能有遗漏；Agent 不应自动关闭工单、发邮件或修改客户记录。请列出 Deployment 配置、时区、初始事件、预算和监控条件，并说明暂停或漏跑后如何补偿。

**参考答案：** 创建单独的 Agent 和 Environment，给工单工具只读权限，使用 `user.message` 说明日报范围、严重性规则、输出格式及不得修改业务数据的边界。设定五段式 cron，并指定业务 IANA 时区；检查 `upcoming_runs_at`，同时把启动抖动考虑进交付时限。先触发一次 manual Run，验证权限和摘要质量，再启用 schedule。每个 scheduled Run 都检查对应 Deployment Run 记录；成功后追踪关联 Session，等待结果并由值班人员复核。Webhook 用 event ID 去重并按资源 ID 取回状态，同时定期查询 Run 历史作为补查。暂停后不依赖自动补跑：先查缺失时间窗，再按明确的报告窗口手动补跑并标记补偿记录。预算按每次 Session 设置，并单独计算周期累计支出。

## 本课结论

Scheduled Deployment 是周期执行配置；每次触发都会先形成 Deployment Run 记录，再尝试创建新的 Session。用 Run 历史检查启动结果，用 Session 事件检查 Agent 执行，用 Webhook 接收通知并定期通过 API 补查。明确 cron 时区、暂停和漏跑语义、每次运行预算、写入授权与重复副作用后，周期任务才便于运营和审计。

## 范围与时效

- 官方文档核对日期：2026-11-10；Scheduled Deployments 和 Webhooks 当时为 Beta。
- Cron、DST、抖动、失败恢复、Webhook 事件、部署限制和预算字段可能更新；以目标平台最新文档为准。
- 多 Agent 批量工作流见第33课；Deployment 创建的单个 Session 的凭证、权限和留存边界见第32课。
