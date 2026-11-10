# 第 45 课：Managed Agents 自托管 Worker 如何选择轮询、Webhook 与每会话沙箱？

**目标：** 能分别选择 Worker 的任务领取方式和 Session 执行隔离方式，理解 `ant` CLI 与 SDK 的能力差异，并在部署时处理 Webhook 验签、Session 文件暂存、工作项密钥转发和优雅停机。

## 本课问题

自托管 Worker 一定要常驻轮询吗？能不能收到 Session 启动事件后再启动 Worker？多个 Session 要不要共享同一个进程和工作目录？如何让隔离运行的 Session 输出在沙箱退出后仍可取回？

## 官方资料

- [Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)：常驻轮询、Webhook 触发、每 Session 沙箱、CLI/SDK 能力和文件暂存。
- [Subscribe to webhooks](https://platform.claude.com/docs/en/managed-agents/webhooks)：注册 HTTPS endpoint、签名验证、事件字段和投递重试行为。
- [Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)：Worker 队列、Session 创建、资源限制和 MCP tunnel。
- [Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)：Worker 凭据、工作项 Session `secret`、数据及隔离责任。
- [第 35 课：Memory Stores](../s35_agent_memory_stores/README.md)、[第 43 课：文件输入与输出](../s43_managed_agents_files/README.md)、[第 44 课：自托管沙箱与 Worker 队列](../s44_managed_agents_self_hosted_sandbox/README.md)。

核对日期：2026-11-11。自托管 Worker 属于 Beta，要求 `managed-agents-2026-04-01` Beta Header。本课的 CLI/SDK 能力表按部署指南所列的 Claude API 与 Claude Platform on AWS 范围整理；Google Cloud Anthropic managed 的限制见第44课及平台文档。

## 1. 先分清两个部署选择

Worker 部署有两个互相独立的维度：**Worker 如何被唤醒以领取工作**，以及**领取后在哪里执行这个 Session**。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

| 维度 | 选项 | 运行方式 |
| --- | --- | --- |
| 领取工作 | Always-on | 常驻进程持续轮询 Environment 队列。 |
| 领取工作 | Webhook-triggered | Session 触发 `session.status_run_started` Webhook，服务端收到并验证事件后启动 poller 领取队列工作。 |
| 执行 Session | In-process | 领取工作的 Worker 直接在同一进程和工作目录执行工具调用。 |
| 执行 Session | Sandbox per session | 主机上的 poller 领取工作项，为该 Session 启动一个新的沙箱，处理完成后退出。 |

可将流程画成两段：

```text
任务触发：常驻 poller ─────────┐
                             ├─→ Worker 领取 work item
Session Webhook → poller ────┘              │
                                            ├─→ 同一进程执行工具
                                            └─→ 启动独立 Session 沙箱
```

选择触发方式不会自动决定隔离方式。例如常驻 Worker 既可在自己的进程执行，也可以为领取的每个 Session 启动独立沙箱。根据并发、隔离、空闲资源和网络入口要求分别做决定。

## 2. 常驻轮询与 Webhook 触发

### 常驻轮询

Always-on Worker 在后台进程或服务中持续轮询队列；Quickstart 的 `ant` 示例为：

~~~bash
ant beta:worker poll --workdir /workspace
~~~

官方将它作为最简单的设置：Worker 只需出站 HTTPS，不要求 Anthropic 能回连 Worker 主机。适合已有常驻 Worker 服务的部署。部署者仍需管理进程运行、健康状态、并发和升级。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)、[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)

### Webhook 触发

Webhook 模式订阅 `session.status_run_started`。Anthropic 将事件发送到客户的可达端点，接收服务验证签名后启动 poller，由其领取并处理队列工作。该模式可以避免一直运行空闲 poller，但需要提供 Anthropic 可访问的 Webhook endpoint，并保护签名密钥。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

Webhook 是唤醒信号；实际要执行的工作仍从 Environment 队列领取。处理器应验证事件签名，不要把未经验证的请求体当作可信 Session 指令。SDK 示例使用 Webhooks SDK 的事件解析/验签流程，然后启动 Worker 并 drain 队列。Webhooks 和 Worker 各自的错误、超时与重试要按部署指南分别处理。

Webhook 事件只包含事件类型与资源 ID，不包含完整 Session；需要时应按 ID 读取资源。一个事件的多次投递使用相同的顶层 `event.id`，可以按此值去重。官方说明每个 endpoint 最多尝试投递三次；尝试耗尽后事件会丢弃，因此 Webhook 不是耐久事件日志。部署上应先订阅所需事件，并用 API 读取当前资源状态或对账，补足漏掉的通知。[Subscribe to webhooks](https://platform.claude.com/docs/en/managed-agents/webhooks)

## 3. 同一进程还是每 Session 独立沙箱

### In-process：部署简单，工作区需要隔离管理

Worker 在自己领取工作项的进程中运行 Session 工具调用；工作目录由该 Worker 使用。若多个 Session 复用同一 Worker 或挂载同一共享路径，就需要评估文件、进程、凭证、并发写入和 Memory Store 副本之间的相互影响。官方特别提示，共享同一 Memory Store 的 Session 要检查隔离方式。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

### Sandbox per session：创建边界清晰，启动器要管理生命周期

常驻 poller 先领取工作项，再通过脚本或 SDK 为 Session 启动新沙箱。一个沙箱运行一个 Session 的工具调用，结束后退出。适合需要新文件系统、资源限制或每 Session 网络控制的情形；相应地，部署方要准备镜像、分配资源、清理沙箱并单独保存要保留的交付物。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

文档给出的 `ant` CLI 示例可用 `--on-work` 将领取的工作项交给启动脚本：

~~~bash
ant beta:worker poll --on-work ./spawn.sh
~~~

脚本可启动以 `ant beta:worker run` 为入口的容器；官方示例把主机输出目录挂载到沙箱工作目录，以便容器退出后仍能取回文件。若仅将文件写到易失沙箱内，Session 退出后这些内容不一定仍可用，因此应明确交付物持久化位置。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

## 4. CLI 与 SDK 能力并不相同

部署指南当前列出的 Worker 能力如下：

| 能力 | `ant` CLI | Python / TypeScript / Go SDK |
| --- | --- | --- |
| 常驻轮询 | 支持 | 支持 |
| Webhook 触发 | 不支持 | 支持 |
| 每 Session 沙箱 | 支持 | 支持 |
| Memory Store 同步 | 支持默认同步设置 | 支持配置同步方式 |
| Custom Tools | 不支持 | 支持 |

如果只需要常驻 poller 和内置工具，CLI 流程更直接；若要让 Worker 端提供 Custom Tools、定制 Memory Store 同步或自行处理 Webhook 生命周期，应检查 SDK Worker 能力。表格是官方指南当前能力范围，不代表所有 Cloud Platform 端点和未来版本都完全相同。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)

## 5. 文件和凭据要随工作项进入正确的 Session

自托管环境不会自动把 Files API 文件或 GitHub 仓库挂入沙箱。部署指南建议在 Session `metadata` 中放置受控文件引用、对象存储路径或 commit SHA；Worker 收到工作项后按 `session_id` 读取 Session metadata，并在工具执行前把对应材料暂存到该 Session 的工作目录。工作项本身包含 Session ID，但不包含完整 metadata。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)、[第 43 课](../s43_managed_agents_files/README.md)

每个工作项可以附有 Session `secret`。若 poller 自己领取工作，再把任务交给容器或 SDK Worker，启动器必须只把该工作项的 secret 转发给对应 Session 沙箱；不要写日志、放进共享镜像或交给其他 Session。Environment Key 是 Worker 访问队列的凭据，不能替代 per-session secret 来访问 Memory Store。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)、[Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)

## 6. 关停 Worker 时要完成工作项清理

SDK Worker 示例在收到 `SIGINT` 或 `SIGTERM` 时取消运行任务，而不是直接终止整个进程。这样 Worker 有机会停止正在处理的工作项、同步已更改的 Memory Store 文件并移除临时 Store 目录。Webhook Handler 也应在服务关停期间等待正在进行的任务清理完毕；强制杀进程可能中断这些步骤并留下本地会话数据。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)、[Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)

发布新 Worker 版本或缩容时，先停止领取新工作，再让已领取任务走完或按 SDK/Worker 支持的取消路径收尾；确认输出文件已保存，Memory Store 同步已完成，临时目录已清理后，再销毁执行环境。这是根据官方 Worker 关停行为整理的运维顺序。

## 练习：为三种任务选择部署组合

1. 一个常年有任务的 Agent，工作负载可信，需要以最少的服务部件先上线。
2. 一个低频任务服务，不希望一直运行 poller，已有公网 Webhook 接收服务。
3. 多客户任务可能执行不可信代码，每个 Session 都要求独立文件系统与网络规则。

**参考答案：** 第一种可从常驻 poller 加 in-process Worker 开始，并按并发和文件共享风险补足隔离；第二种可评估 SDK Webhook-triggered Worker，验证签名后启动 poller 并处理队列；第三种应在触发方式之外，另选每 Session 独立沙箱，并将 Session 工作项 secret 与输入材料只传给对应沙箱。三种组合都要明确工具结果和交付文件的回传、保存与清理路径。

## 本课结论

Worker 的“何时启动”与“Session 在哪里执行”是两组独立选择：常驻轮询减少依赖公网回调；Webhook 可按 Session 启动事件唤醒 SDK Worker；in-process 部署较简单，每 Session 沙箱提供更清楚的文件系统、资源和网络隔离。选择模式后，还要处理 Worker/SDK 能力差异、Webhooks 签名校验、Session 文件暂存、每工作项 secret 转发和优雅关停。

## 范围与时效

- 官方资料核对日期：2026-11-11；Managed Agents 自托管 Worker 当时为 Beta。
- Worker 能力表按 Deploy self-hosted workers 页面核对；Claude Models on Google Cloud（Anthropic managed）要求自行实现 Worker，不在预构建 CLI/SDK Worker 的适用范围内。
- SDK 选项、Webhook 事件、Beta Header 和平台可用性可能变化；按目标端点当前官方文档复核。
