# 第 50 课：自托管 Worker 的 SDK Poller 如何控制领取、排空与回收？

**目标：** 能用 `work.poller()` 的 `drain`、`block_ms`、`reclaim_older_than_ms` 和 `auto_stop` 配置工作队列循环，并区分常驻轮询、Webhook 排空、未确认工作回收与 Session 停止的责任边界。

## 本课问题

SDK Poller 何时继续等待新任务、何时返回？超时回收针对哪些工作项？使用 Poller 启动外部 Session 沙箱时，谁负责停止该 Session？

## 官方资料

- [Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)：`work.poller()` 各选项及默认行为。
- [Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)：SDK Poller 启动沙箱、Webhook 排空队列和 `handle_item()` 示例。
- [第 45 课：Worker 部署模式](../s45_managed_agents_worker_deployment/README.md)、[第 48 课：队列监控与故障排查](../s48_managed_agents_worker_operations/README.md)、[第 49 课：工作目录与文件访问策略](../s49_managed_agents_worker_filesystem/README.md)。

核对日期：2026-11-11。Self-hosted Worker 当时为 Beta，要求 `managed-agents-2026-04-01` Beta Header。Poller helper 的选项和工作项状态可能随 SDK 版本变化。

## 1. `work.poller()` 是工作项领取循环

`client.beta.environments.work.poller()` 持续向 Environment 队列领取工作项，并把每个已领取 Session 交给调用方。它让应用控制每个 Session 接下来如何运行，例如在外部容器中启动独立沙箱。Poller 控制的是工作项领取和循环行为；它本身不替应用安排容器资源或工具执行步骤。[Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)、[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

| 选项 | 官方语义 | 适用时要想清楚 |
| --- | --- | --- |
| `drain` | 队列为空时停止 Poller，而非继续等待新工作。 | Webhook 唤醒的短任务通常处理当前可领工作后退出；常驻 Worker 通常需要继续等新工作。 |
| `block_ms` | 每次轮询等待新工作到达的毫秒数，范围为 1–999；默认 999，helper 会自动重新轮询。传 `None` 表示非阻塞检查。 | 长驻循环用默认等待可减少空闲检查；非阻塞检查适合与 `drain=True` 组合做一次队列排空。 |
| `reclaim_older_than_ms` | 重新领取已领取、但在指定毫秒内未确认（acknowledge）的工作项。 | 它描述的是未确认领取项的回收门槛，不是 Agent Session 运行时长或工具调用超时。 |
| `auto_stop` | 每个工作项的循环体运行完后，是否由 Poller 自动为该工作项发送 stop signal。 | 若执行工作项的外部沙箱负责发送 stop signal，应设为 `False`；SDK 的 `handle_item()` 会自行发送。 |

选项定义和 999ms 长轮询默认值见 [Worker Reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)。

## 2. 按唤醒方式配置等待和排空

### 常驻 Worker：等待新工作

常驻 Worker 服务在队列暂时为空时仍需继续运行。保留 Poller 默认 `drain=False` 和 `block_ms=999`，让 helper 等待并重复轮询；服务退出时再按 Worker 的优雅关停流程处理活动工作项。这里的配置对应“持续消费队列”，不是每个请求启动后处理一批就结束。[Worker Reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)、[第 45 课](../s45_managed_agents_worker_deployment/README.md)

### Webhook Worker：处理当前队列后返回

Webhook handler 可在收到有效唤醒事件后创建 Poller，并用 `block_ms=None` 进行非阻塞检查、`drain=True` 在队列为空时结束。一个 Webhook 可能对应队列中多个工作项，因此以领取并 drain 当前队列作为工作循环；事件本身是唤醒信号，不是完整任务内容。官方 SDK 示例使用了这一模式。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

这里的“排空”表示 Poller 不再等待**新的**队列项；它不表示所有启动的外部沙箱均已完成。若循环体仅负责启动沙箱，服务还需自行跟踪其生命周期和退出结果。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

## 3. 超时回收只针对未确认的工作项

`reclaim_older_than_ms` 的文档描述针对“已领取但未确认”的工作项。应用应结合自身从领取到确认的实际时间设定门槛；这是部署方依据工作路径做出的配置，而不是官方给定的通用毫秒值。若门槛短于正常确认所需时间，可能造成同一项工作再次被领取，因此上线前应测量领取、分发和确认路径，并关注重复执行的后果。[Worker Reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)

不要把该选项当成 Session 运行期限：官方定义的是未确认工作项的回收，不等于中断已运行中的 Agent、工具进程或外部沙箱。对运行超时应使用适合 Session 或工具的超时与停止机制，并结合第48课的队列统计和停止语义排查。[第 48 课](../s48_managed_agents_worker_operations/README.md)

## 4. `auto_stop` 要与执行责任方匹配

同一进程中的完整 Worker 流程通常由 `EnvironmentWorker.handle_item()` 处理工作并发送 stop。若自定义循环把工作项交给独立容器，则容器内的 Worker 可以在 Session 结束时发送 stop，Poller 侧应设 `auto_stop=False`，避免父级循环体启动完容器后就替尚在运行的 Session 发 stop。官方沙箱启动示例也以 `auto_stop=False` 将停止责任交给沙箱。[Worker Reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)、[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

```python
async for work in client.beta.environments.work.poller(
    environment_id=environment_id,
    environment_key=environment_key,
    block_ms=None,
    drain=True,
    auto_stop=False,
):
    await launch_session_sandbox(work)
```

这段代码仅展示“Webhook 触发、排空当前队列、将 Session 交给沙箱”的选项关系。生产实现还需将每个 work item 的环境变量和专属 `work.secret` 只传给对应 Session 沙箱，并确保该沙箱完成后负责报告停止状态；不要把工作项 secret 记录进日志或共享给其他 Session。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)、[第 45 课](../s45_managed_agents_worker_deployment/README.md)

## 练习：同一 Poller 的两种职责

为下列两种部署分别选取 `drain`、`block_ms` 和 `auto_stop`：

1. 一直运行的 Worker 在本进程里调用 `EnvironmentWorker.handle_item()`。
2. Webhook handler 唤醒后领取当前队列项，再启动每 Session 一个容器，由容器处理 Agent 并负责结束 Session。

**参考答案：** 第一种保留常驻等待（`drain=False`，`block_ms` 默认 999），并由完整 `handle_item()` 生命周期处理 stop。第二种用 `drain=True` 和 `block_ms=None` 在当前队列为空时返回；由于 Session 生命周期由外部容器接管，设 `auto_stop=False`，让容器内 Worker 在 Session 完成后发送 stop。若配置 `reclaim_older_than_ms`，应按实际的领取至确认时间选阈值，而不是照搬其他系统或把它当作工具超时。

## 本课结论

Poller 的 `drain` 与 `block_ms` 决定队列为空后是继续等还是退出；`reclaim_older_than_ms` 回收超时未确认的领取项；`auto_stop` 决定由 Poller 还是工作项执行方发送 stop。把这四项分别对应到常驻服务、Webhook handler、工作项确认路径和 Session 生命周期，才能避免空转、过早停止或错误理解回收行为。

## 范围与时效

- 官方资料核对日期：2026-11-11；Self-hosted Worker 当时为 Beta。
- Poller 选项语义见 Self-hosted worker reference；SDK 启动外部沙箱和 Webhook drain 示例见部署指南。
- Session 停止和队列监控见第48课；部署选择和凭据转发见第45课。
