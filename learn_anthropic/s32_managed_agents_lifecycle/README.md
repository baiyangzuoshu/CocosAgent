# 第 32 课：Claude Managed Agents 如何组织配置、运行环境和会话？

**目标：** 能用 Agent、Environment、Session 和 Events 描述 Managed Agents 的运行流程，比较 Anthropic 托管与自托管沙箱，并指出权限、凭证、会话留存由哪些配置控制。

## 本课问题

Managed Agents 和直接调用 Messages API 有什么区别？一个可复用的 Agent 配置如何变成正在工作的 Session？如果选择自托管沙箱，哪些数据与控制仍留在 Anthropic 服务一侧？

## 官方资料

- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)：Managed Agents 的适用任务、核心概念、工具和整体流程。
- [Define your agent](https://platform.claude.com/docs/en/managed-agents/agent-setup)：可复用的版本化 Agent 配置、更新与归档。
- [Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)：云端与自托管沙箱的运行位置和责任区别。
- [Cloud environment setup](https://platform.claude.com/docs/en/managed-agents/environments)：云端沙箱、依赖和网络配置。
- [Start a session](https://platform.claude.com/docs/en/managed-agents/sessions)：Session 创建、Agent 版本固定和初始事件。
- [Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)：发送用户事件、订阅实时更新、重连和中断。
- [Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)：`always_allow`、`always_ask`、`auto` 与确认循环。
- [Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)：为用户或工作负载管理凭证，并在创建 Session 时引用 Vault。
- [Secure your Managed Agents deployment](https://platform.claude.com/docs/en/managed-agents/secure-deployment)：网络、权限、Vault、预算和监控的安全配置建议。
- [Review and monitor agent sessions](https://platform.claude.com/docs/en/managed-agents/secure-deployment-monitoring)：会话事件审阅、Webhook 和留存/删除范围。

核对日期：2026-11-10。Managed Agents 当前标记为 Beta，页面列出的 beta header 为 `managed-agents-2026-04-01`；模型、平台、功能、数据处理和字段要求可能更新，部署前应按目标平台复查。

## 1. 先区分 Managed Agents 与 Messages API

Messages API 提供直接模型调用，开发者自行组织对话历史、工具循环和运行环境，适合需要自定义编排和细粒度控制的应用。Claude Managed Agents 提供 Anthropic 描述的 Agent harness 和运行基础设施，适合长时间、多步或异步任务；会话可在事件交互中继续、暂停或被重新引导。[Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)

| 路径 | 应用编排什么 | Anthropic 文档强调的用途 |
| --- | --- | --- |
| Messages API | 应用维护对话轮次、客户端工具执行、会话状态和运行时。 | 定制 Agent loop、直接控制模型交互。 |
| Managed Agents | 应用创建 Agent 与 Environment、启动 Session、发送事件并处理流式状态和权限请求。 | 长时间任务、异步运行、托管或自托管沙箱。 |

Managed Agents 并不替应用决定业务授权、允许哪些外部系统或是否向最终用户展示高影响动作。它托管 Agent 运行循环和工具环境；应用仍需决定谁能启动任务、传入什么数据、哪些操作要确认以及如何保存结果。

## 2. 用四类资源描述一次任务

| 概念 | 主要作用 | 生命周期关系 |
| --- | --- | --- |
| **Agent** | 版本化、可复用的配置：模型、system prompt、工具、MCP servers、Skills 等。 | 可创建一次供多个 Session 引用；配置发生变化时生成新版本。 |
| **Environment** | 指定工具和代码运行在哪里，以及运行环境的网络和依赖设置。 | 多个 Session 可以引用同一个 Environment；云端模式下每个 Session 获得独立沙箱。 |
| **Session** | 某个 Agent 在一个 Environment 中运行的一次任务实例，保留多轮会话历史。 | 创建时必须引用 Agent ID 和 Environment ID；可以用 Agent ID 默认指向最新版本，也可以固定具体版本。 |
| **Events** | 应用与运行中 Agent 交换的用户消息、工具结果、状态更新和确认。 | 用户事件可启动、补充或引导任务；服务端的 Session event stream 输出运行进度。 |

资源创建顺序可以记为：

```text
Agent 配置 + Environment 配置
              ↓
     创建 Session（引用两者 ID）
              ↓
打开事件流 → 发送 user.message / 其他事件
              ↓
读取 agent、tool、status 等事件并按需审批/继续
              ↓
检查结果、归档所需日志、下载文件、按保留要求删除 Session
```

Agent 负责“Claude 如何工作”，Environment 负责“工具和代码在哪里运行”，Session 负责“这一次任务及其状态”，Events 负责“应用如何和它互动”。把 Agent 与 Environment 分开后，同一份 Agent 配置可以在多个 Session 中复用，也可以分别指定云端或自托管运行方式。[Overview](https://platform.claude.com/docs/en/managed-agents/overview)、[Define your agent](https://platform.claude.com/docs/en/managed-agents/agent-setup)、[Start a session](https://platform.claude.com/docs/en/managed-agents/sessions)

## 3. 为每个 Session 选择运行位置

| Environment | 工具与代码运行地点 | 应用负责的事项 | 必须理解的数据边界 |
| --- | --- | --- | --- |
| **Cloud** | Anthropic 管理的沙箱；每个 Session 使用自己的新 Linux 容器。 | 配置网络可达范围和需要安装的包；选择要挂载的文件或代码资料。 | 会话历史、工具结果、沙箱文件与状态会发送到 Managed Agents 服务。 |
| **Self-hosted** | 组织自己的基础设施；应用部署 Worker 执行 bash/file 工具，再把结果送回 Managed Agents。 | 运维和加固 Worker、隔离 Session、限制网络、轮换 Worker 凭证，并负责挂载文件/仓库。 | 代码运行环境留在本方 Worker，但会话历史和工具结果仍发到 Anthropic 服务；自托管不会自动改变留存资格。 |

选择自托管的理由通常是工具必须访问内部网络，或必须由组织自己的主机与网络策略执行。若只是不希望任何会话数据到达 Anthropic，自托管本身并不能满足这个要求；模型仍由 Anthropic 运行，服务端仍需要收到对话和工具结果。[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

云端 Environment 的网络建议从 `limited` 开始，只列出需要的 hosts，并在每次创建配置中显式写网络规则。`allowed_hosts` 控制出站地址范围，不等同于按 HTTP 操作或业务权限做授权；允许访问某个主机仍可能允许读写请求。运行代码、下载依赖或访问外部服务前，应分别核对网络、工具权限和服务器端凭证范围。[Cloud environment setup](https://platform.claude.com/docs/en/managed-agents/environments)、[Secure your Managed Agents deployment](https://platform.claude.com/docs/en/managed-agents/secure-deployment)

## 4. 事件循环负责让长任务可观察、可继续

Managed Agents 使用 event-based 交互：应用创建 Session，发送 `user.message` 等事件，并订阅 Session event stream；Agent 事件报告文本、工具调用/结果和状态。创建 Session 时也可通过 `initial_events` 一起发送第一条消息。连接实时流时先打开 stream 再发送事件，因为新 stream 只传送打开之后产生的事件；重连时要结合历史事件去重，避免漏读或重复处理。[Start a session](https://platform.claude.com/docs/en/managed-agents/sessions)、[Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)

应用至少要处理三类状况：

1. **继续运行：** 读取新的 `agent.message`、工具和状态事件；如需补充指令，通过新的用户事件引导 Session。
2. **需要审批：** 配置为 `always_ask` 的工具在执行前暂停，Session 会报告等待操作的事件 ID；应用展示具体工具和参数，取得授权后再发送允许/拒绝的确认事件。
3. **结束或异常：** 根据 Session 状态和错误事件决定通知、重试或关闭；保存需要留存的事件和输出文件，再按组织策略删除 Session。

对于工具权限，Agent 工具集未配置时当前文档给出的默认策略是 `always_allow`，MCP toolset 默认是 `always_ask`。不要依赖默认差异；针对每个工具明确设置策略。`auto` 由服务端评估调用后允许、拒绝或在无法判断时暂停，它不等于人工审批；若必须由人查看后再执行，使用 `always_ask` 并实现真正的确认循环。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 5. 将凭证和网络权限绑定到 Session 所需范围

Agent 定义中声明 MCP server 或其他工具，不代表应该把用户长期凭证放进 Agent 配置或 prompt。Managed Agents 支持 Vault；应用可按用户或工作负载建立 Credential，在创建 Session/Deployment 时通过 `vault_ids` 引用。MCP OAuth token 可在 Vault 中管理，凭证轮换或撤销不需要把明文放进对话内容。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

安全配置可从以下几项开始：

- 每个 Session 只传入完成当前任务所需的 Vault，凭证仅授权目标用户和目标服务。
- Environment 用 `limited` networking，只开放任务必须访问的主机；不要把 `allowed_hosts` 当作业务授权表。
- 对 Bash、写入文件、外部 MCP 调用或修改业务记录明确选择 `always_ask` 或其他合适策略；检查提示注入可能控制的输入和输出路径。
- 设定 Session 或 Deployment budget，监视运行时长、工具调用与费用。
- 将会话事件作为需要保护的数据，控制查看、导出、保留和删除权限。

## 6. 记录、留存和删除也是运行流程的一部分

截至 2026-11-10，Managed Agents 文档将其标为**不具备 Zero Data Retention（ZDR）资格**及**不具备 HIPAA 资格**。Session history 默认保留至删除 Session；归档 Session 不会删除历史。文档还说明云端沙箱状态会在创建 30 天后清除，Session 生成的文件随 Session 删除，而上传文件、Vault 和 Memory Store 需要单独管理。需要留存审计事件时，在删除前复制到组织自己的日志系统，并设置相应访问控制和保存期限。[Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)、[Review and monitor agent sessions](https://platform.claude.com/docs/en/managed-agents/secure-deployment-monitoring)

这意味着“自托管”改变的是工具执行环境和 Worker 运维责任，不会把 Session 状态变成本地私有，也不会自动改变 Managed Agents 的合规覆盖。数据留存要求若与当前文档资格不相容，需在采用前评估不同架构，而不是仅把 Sandbox 换成自托管。[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

## 练习：客服 Agent 需要查单并发送回复

客服 Agent 要读取工单和订单信息、草拟回复，并在坐席确认后发送邮件。MCP server 提供只读 `search_ticket`，邮件系统提供写入工具 `send_reply`；部分订单查询只能通过公司内网访问。请画出资源关系，并列出 Session 启动、审批、监控和数据留存要检查的条件。

**参考答案：** 创建版本化 Agent，配置模型、指令、最小工具集和 MCP server；创建一个有限网络 Environment，选择云端或需要内网 Worker 的自托管方式。每次工单任务创建一个 Session，引用指定 Agent 版本、Environment ID 和该坐席所需 Vault。对 `search_ticket` 仅授予读范围；`send_reply` 使用 `always_ask`，应用在确认页展示收件人和正文并发送明确确认事件，不能把 `auto` 视为人工审批。先打开事件流，再发送工单任务；处理工具和 Session 状态事件，监视暂停、失败和预算，保存必要审计记录并删除不再需要的会话。若选自托管，说明给团队：Worker 执行地点在公司环境，但对话历史和工具结果仍到 Managed Agents 服务；还要确认 ZDR/HIPAA 资格要求与该产品当前支持范围。

## 本课结论

Managed Agents 把可复用的 Agent 定义、执行 Environment 和有状态 Session 分成独立资源，应用通过事件流启动、引导、审批和监控任务。选择运行位置时，要同时看工具执行在哪里、哪些数据仍流向 Anthropic、网络与 Vault 凭证如何限制，以及 Session 历史和输出如何留存与删除。

## 范围与时效

- 官方文档核对日期：2026-11-10；Managed Agents 当时为 Beta。
- beta header、工具和平台支持、权限默认值、留存方式及保留期限会变；按目标平台和组织条件复核。
- Messages API 自定义工具闭环见第20课；MCP Connector 见第31课；提示注入与确认策略见第27课；生产数据和观测见第28课。
