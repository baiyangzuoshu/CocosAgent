# 第 48 课：Managed Agents 自托管 Worker 如何监控队列、停止任务并排查故障？

**目标：** 能解释 Environment 工作队列的深度、待确认数、最老工作时间和 Worker 轮询数，按症状排查连接、排队、Memory Store 挂载及工具等待问题，并区分优雅停止 Session、停止 Worker 和强制标记 work item 的效果。

## 本课问题

怎样判断 Worker 没连上、队列积压、工作项停滞，还是 Agent 等待某个工具结果？停止 Session 和关闭 Worker 是否会立刻中断工具执行？为什么 Memory Store 挂载失败时 Session 可能显示 idle 却没有 `session.error`？

## 官方资料

- [Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)：队列指标、Session/Worker 停止和常见故障排查。
- [Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)：Worker 队列、凭据和 Session 运行流程。
- [第 45 课：Worker 部署模式与优雅停机](../s45_managed_agents_worker_deployment/README.md)、[第 46 课：Memory Store 同步](../s46_managed_agents_self_hosted_memory_sync/README.md)、[第 47 课：Worker Custom Tools 与内部 MCP](../s47_managed_agents_self_hosted_custom_tools/README.md)。

核对日期：2026-11-11。自托管 Worker 当时为 Beta，使用 `managed-agents-2026-04-01` Beta Header。停止行为、SDK 细节、队列指标与推荐阈值可能更新，部署前应核对目标平台当前文档。

## 1. 用四个统计字段读懂 Environment 队列

`client.beta.environments.work.stats(environment_id)` 返回某个 Environment 的队列状态。运维或监控服务可使用组织 API Key 读取这些统计；文档同时允许用 Environment Key 请求队列统计，但不要把组织级 `ANTHROPIC_API_KEY` 放到 Worker 主机，因为 Agent 工具调用可能读到它。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)

| 字段 | 官方定义 | 排查用途 |
| --- | --- | --- |
| `depth` | 等待被 Worker 领取的工作项数。 | 看待处理积压；持续增加时评估 Worker 容量或处理速度。 |
| `pending` | 已被 Worker 领取但尚未确认（acknowledged）的工作项数。 | Worker helper 会在处理前确认，正常应接近 0；长期非零可能表示领取后未能确认。 |
| `oldest_queued_at` | 最老的排队工作时间；可能仍待领取，也可能已领取但还未确认。无此类工作时为 `None`。 | 衡量最老任务已经等了多久。 |
| `workers_polling` | 最近 30 秒内轮询过该 Environment 的 Worker 数。 | 判断近期 Worker 活跃度；不代表 Session 已完成。 |

~~~python
stats = client.beta.environments.work.stats(environment_id)
print(
    stats.depth,
    stats.pending,
    stats.oldest_queued_at,
    stats.workers_polling,
)
~~~

建议把几个字段组合起来看：`workers_polling=0` 且 `depth` 增长，优先排查 Worker 连接；Worker 有轮询但 `depth` 长期高，说明工作量超过当前领取/处理能力；`pending` 持续非零则调查领取后确认阶段。单独一个瞬时数值不足以判断某个 Session 的工具执行是否成功。

## 2. 按现象区分连接故障、排队和执行等待

| 现象 | 先检查什么 | 判断边界 |
| --- | --- | --- |
| Worker 不出现 / `workers_polling` 一直为 0 | Worker 主机上的 `ANTHROPIC_ENVIRONMENT_KEY` 和 `ANTHROPIC_ENVIRONMENT_ID` 是否正确；Worker 能否按目标平台认证并出站连接。 | Worker 尚未到达队列，与 Agent 工具代码质量无关。 |
| Session 长时间 `queued` | 同时看 `workers_polling` 与 `depth`，再看 Worker 轮询日志。 | 无 Worker 领取时 Session 会留在队列，并不会自动失败。 |
| `pending` 持续不为零 | 检查 Worker 是否领取工作项后卡在确认或自定义调度逻辑。 | SDK helper 正常会在处理前确认；不要把所有工具耗时都归为 pending。 |
| Session 已被领取但暂停为 `requires_action` | 检查 Agent 声明的工具是否由 Worker 或应用客户端提供。 | 自托管 Custom Tool 缺少 handler 时会等待匹配的工具结果；这和 Worker 失联的 queued 状态不同。 |

Self-hosted Worker 的队列统计与 Session 状态是不同观察面：前者说明 Environment 的工作项和 Worker 活跃度，后者说明某个 Session 的 Agent/工具状态。需要一起查看 Worker 日志、队列统计和 Session 事件，而不是只依据一个状态字段通知任务失败或完成。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)、[第 47 课](../s47_managed_agents_self_hosted_custom_tools/README.md)

## 3. Memory Store 挂载失败可能不会发出 Session 错误事件

如果 Worker 领取 Session 后不能挂载 Memory Store，Worker 会失败该 work item；Session 可能保持 `idle`，而没有 `session.error`。Worker 日志是关键线索。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)

| Worker 日志或 Session 症状 | 可能原因 | 处理方向 |
| --- | --- | --- |
| work item 没有携带 Session secret | 自定义 poller 没有把该 work item 的 `secret` 转给对应 Worker；也可能是组织尚未启用 self-hosted Memory Stores。 | 对照第45、46课确认正确转发；若同进程 Worker 仍出现，按文档联系支持。 |
| Store 挂载路径已存在 | 前一 Session 异常终止，未运行 teardown 并留下目录。 | 确认没有活动 Session 正在使用该目录，再按日志指出的路径清理。未同步的本地修改可能丢失。 |
| 无法在 `/mnt/memory` 下创建挂载目录 | Worker 用户对父目录没有写权限，或主机目录布局未按平台要求准备。 | 检查 `/mnt/memory` 的存在、所有权和目标平台主机准备步骤；macOS 需遵循专门流程。 |
| Session 显示 `idle` + `requires_action`，且刚有 Worker 领取 | Memory Store 挂载工作项失败。 | 修复 Worker 主机问题后，依官方流程发送 `user.interrupt` 让工作重新排队，并确认下一 Worker 成功挂载。 |

这里的关键是区分“Agent 等待用户/工具确认”和“Worker 无法准备 Session”。`idle` 或 `requires_action` 不是足够的排障结论；结合 Worker 日志判断挂载失败、缺少 Tool handler 或真正的审批等待。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)、[第 46 课](../s46_managed_agents_self_hosted_memory_sync/README.md)

## 4. MCP 工具挂起和 Custom Tool 等待要查不同路径

- **Custom Tool 从未返回：** Session 暂停且 `requires_action` 时，检查 Agent 上是否声明工具、Worker 是否注册同名实现，以及 Worker/客户端是否实际领取并提交了结果。自托管 Custom Tools 运行时由 Worker 实现，不会因为 Agent 中已有声明就自动存在。[第 47 课](../s47_managed_agents_self_hosted_custom_tools/README.md)
- **Worker 包装的 MCP Tool 挂起：** 检查 Worker 到 MCP Server 的网络与 MCP Session，再检查是否设置客户端请求超时。官方列出的默认兜底约为 Python 2.5 分钟、TypeScript 约 1 分钟、Go 120 秒；按业务 SLA 设置明确超时，避免长期占住 Session 与 Worker。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)
- **Agent MCP Connector 故障：** 看 Managed Agents 连接错误和 Vault 凭证匹配；这条路径由 Anthropic 服务连接 Server，与 Worker 内的 MCP Client 不同，见第40课。

## 5. “停止 Session”是一次可确认的协作关停

监控或运维工具可调用 `client.beta.environments.work.stop(work_id, environment_id=...)` 请求 Worker 关闭指定 Session 的执行。默认情况下，work item 进入 `stopping`；Worker 在下一次 lease heartbeat 发现请求后取消正在执行的工具调用并确认关停，work item 随后成为 `stopped`。Python SDK Worker 会先等当前工具调用完成，最多约 2.5 分钟。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)

传入 `force=True` 会立即把 work item 状态标记为 `stopped`，但不会让运行中的工具更快停下：Worker 仍要等到下一次 heartbeat 才看到停止请求。因此 `force` 是更快改变服务端状态，不是杀死本地进程或立即终止外部副作用。

stop 和队列统计从运维客户端调用；不要把组织 API Key 放在 Worker 主机。查找 `work_id` 的 List Work Items endpoint 只接受 Environment Key，不接受组织 API Key。请求 stop 时也要按目标平台选择正确身份；AWS/Google Cloud 的 Worker 认证例外见第44课。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)

## 6. “停止 Worker”要给进程留出 teardown 时间

停止一个 Session 的 work item 与关闭 Worker 进程是两种操作。对 Worker 发送 SIGTERM/SIGINT 时：

| Worker 类型 | 收到信号后的处理 |
| --- | --- |
| `ant` CLI | 自动取消正在执行的工具调用、发送错误结果并将工作项标成 `stopped`。 |
| 独立进程中的 SDK Worker | `EnvironmentWorker` 不自动安装信号处理器；进程应在自己的 signal handler 中取消 Worker。 |
| Webhook 服务内的 SDK Worker | 由服务的 shutdown hook 取消 Worker；不要让 Worker 接管整个服务的进程信号。 |

Worker 收到取消时会关闭活动 Session。带 Memory Store 的任务会跳过常规的完整 final sync，但仍上传改动并清理 Store 目录。官方建议发送 SIGTERM 后至少留 30 秒；Python SDK Worker 最多需留 3 分钟，因为它会等待工具完成，Memory Store 上传也可能耗时。Docker 默认 10 秒就会发 SIGKILL，需调高容器或编排器的 termination grace period。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)、[第 45 课](../s45_managed_agents_worker_deployment/README.md)

若进程在 teardown 前被杀，未同步的 Memory 编辑会丢失，长期主机上也可能残留 `/mnt/memory/` Store 目录；下一次挂载可能因目录已存在而失败。只在确认没有活动 Session 使用该路径后清理。每个 Session 结束后即丢弃的独立沙箱通常无需单独回收残留目录。[Monitor and troubleshoot self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-operations)、[第 46 课](../s46_managed_agents_self_hosted_memory_sync/README.md)

## 练习：从指标和状态还原排队问题

监控系统记录某 Environment 的 `depth=7`、`pending=0`、`workers_polling=0`，最老工作项已等待 12 分钟。操作员重启了 Session，却仍未产生工具事件。请判断优先排查点，并说明强制停止是否能修复 Worker 连接。

**参考答案：** 指标显示当前没有 Worker 在过去 30 秒轮询，且有 7 个未领取工作项，Session 长时间 queued 与 Worker 连接缺失一致。优先确认 Worker 上的 Environment ID、目标平台凭据和出站连接，并查看 Worker 启动日志；不要先重启 Agent 或修改工具定义。`force=True` 不能修复 Worker 认证或网络，也不会比默认停止更快中断正在运行的工具；先恢复 Worker，必要时再按工作项状态请求合适的停止或重试流程。

## 本课结论

用 `depth`、`pending`、`oldest_queued_at` 和 `workers_polling` 组合判断积压与 Worker 活跃度，再用 Session 事件和 Worker 日志定位具体工具或挂载错误。Memory Store 失败可能让 Session idle 却没有错误事件；Custom Tool 等待、MCP 调用挂起和 queued 状态也需分路排查。停止 Session 会等待 Worker 协作确认，停止 Worker 则需要信号处理和足够 teardown 时间；`force=True` 不等于本地强杀。

## 范围与时效

- 官方资料核对日期：2026-11-11；Self-hosted workers 当时为 Beta。
- 队列字段含义、停止延迟、SDK shutdown 和工具超时可能随 Worker 版本变化；按目标平台当前文档核对。
- Worker 部署模式见第45课；Memory Store 同步与残留目录见第46课；自托管 Custom Tools 与 MCP Client 见第47课。
