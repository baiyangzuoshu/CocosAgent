# 第 44 课：Managed Agents 自托管沙箱如何把工具执行移到自有基础设施？

**目标：** 能说明 `self_hosted` Environment 的 Worker 队列流程，区分应用 API Key 与 Worker 环境凭据，划分 Anthropic 与客户的安全责任，并核对自托管带来的数据边界和功能限制。

## 本课问题

自托管后，究竟哪些部分运行在自己的基础设施？Worker 怎样领取 Session 的工作并把工具结果交回 Agent？自托管会不会让会话数据不再到达 Anthropic？

## 官方资料

- [Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)：工作队列、Worker Quickstart、Session 资源、MCP tunnel 和数据处理说明。
- [Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)：自托管的共享责任、Worker 凭据、沙箱隔离与数据留存。
- [Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)：云端与自托管环境的运行位置、功能差异和平台例外。
- [第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 35 课：Memory Stores](../s35_agent_memory_stores/README.md)、[第 39 课：Vault 凭证](../s39_managed_agent_vault_credentials/README.md)、[第 40 课：MCP 连接](../s40_managed_agents_mcp_connector/README.md)、[第 42 课：GitHub 接入](../s42_managed_agents_github_access/README.md)、[第 43 课：文件输入与输出](../s43_managed_agents_files/README.md)。

核对日期：2026-11-11。自托管沙箱属于 Beta，当前文档要求 `managed-agents-2026-04-01` Beta Header。具体认证方式和平台功能会变，部署前应核对目标 Claude Platform 的最新文档。

## 1. 自托管改变的是工具执行地点

Self-hosted Environment 把工具和代码的执行从 Anthropic 管理的沙箱移到客户控制的基础设施。Agent 定义仍配置模型、提示和工具；Claude 仍由 Anthropic 运行，并根据工具结果决定下一步。客户运行的 Worker 负责在本地执行 Agent 的 Bash、文件工具调用，也可以提供 Custom Tools。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)、[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

```text
应用用 Claude API Key 创建 Session
                 ↓
Anthropic 将 Session 放入 self_hosted Environment 队列
                 ↓
客户 Worker 轮询队列、领取工作项
                 ↓
Claude 在 Anthropic 请求工具调用
                 ↓
Worker 在本地沙箱执行 Bash / 文件 / Custom Tool
                 ↓
工具输入和结果送回 Managed Agents，Claude 决定下一步
```

Worker 是队列消费者，不是本地模型服务器。工具调用和结果要在 Worker 与 Managed Agents 之间往返，Agent 才能继续推理。因而“文件和进程留在自己的主机”不能推导为“模型看不到工具读出的内容”：工具结果仍会传到 Anthropic。Skills 与 Memory Stores 也由 Anthropic 托管，Worker 会为会话取用副本。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)、[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

## 2. Session 进入队列，Worker 领取并执行

典型的 Claude API 流程是：先创建 `self_hosted` Environment；启动 Worker 轮询该 Environment；应用创建引用该 Environment 的 Session 并发送任务；Worker 领取 Session 后执行工具调用并回传结果。Anthropic 的 `ant` CLI 以及 Python、TypeScript、Go SDK 提供预构建 Worker；也可按文档为自己的沙箱平台实现 Worker。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)

文档 Quickstart 的 Worker 启动命令示例：

~~~bash
ant beta:worker poll --workdir /workspace
~~~

创建 Session 时，任务会进入 Environment 的工作队列。若没有 Worker 连接，Session 会保持 queued 等待，不会因为缺少 Worker 自动失败。可以查看队列统计中的 `workers_polling`：至少为 1 表示有 Worker 正在轮询；它不能单独证明目标 Session 已完成或执行健康。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)

~~~python
stats = client.beta.environments.work.stats(environment_id)
print(stats.workers_polling)
~~~

部署诊断时，将“Worker 是否连上”“队列中的 Session 是否被领取”“工具是否在主机执行”“结果是否回到 Session 事件流”作为不同检查点。Worker 未连接时，应用侧看到的排队状态不等于 Agent 已经开始执行。

## 3. 不要混用应用 API Key 和 Worker 凭据

在 Claude API 的文档流程里，两种凭据面向不同的调用方：

| 凭据 | 用途 | 放置位置 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 应用创建 Session、读取队列统计等 Claude API 操作。 | 应用或控制面服务；不要放到 Worker 主机，因为 Agent 的工具调用可能读取 Worker 可访问的凭据。 |
| `ANTHROPIC_ENVIRONMENT_KEY` | Worker 认证并轮询某个 Environment 的工作队列、提交结果。 | Worker 的秘密管理设施；不要写入镜像、仓库、普通环境文件或日志。 |

环境凭据作用于一个 Environment 的队列。若该队列承载不可信工作负载，应评估按信任边界拆分 Environment 和 Worker，避免多个用户共用同一授权范围。怀疑凭据暴露时，立即撤销并轮换。以上变量名和认证方式适用于 Claude API 的文档流程，不可直接套用到其他平台。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)、[Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)

**平台例外：** Claude Platform on AWS 使用 IAM SigV4 或 AWS Console API Key，而不是 Claude Console Environment Key；Claude Models on Google Cloud（Anthropic managed）使用 Google Cloud 凭据，并要求自行实现 Worker，预构建 Worker 不适用。两者的 Memory Stores 和 MCP tunnels 支持情况也有差异，见第 5 节和平台文档。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)、[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

## 4. 自托管把 Worker 的安全责任交给客户

Anthropic 仍负责其服务侧的 Session 与工作队列完整性、多租户隔离和 Agent 上下文最小化。自托管后，客户负责 Worker 主机及其数据、网络和工具执行边界。[Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)

| 范围 | 客户需要控制什么 |
| --- | --- |
| 沙箱 | 固定并审核镜像；以非 root 用户运行、删除不需要的 Linux capabilities、尽可能使用只读根文件系统；按 Session 隔离进程与工作目录。 |
| 网络 | 用 VPC 与防火墙限制出站到工具需要的服务；没有出站控制时，受影响的工具进程可能访问任意外部主机。 |
| 执行权限 | 对 Worker 进程和工具使用最小权限，只挂载必要目录；按信任边界隔离不可信代码。 |
| 数据与日志 | 对 Worker 收到的对话内容和工具输出制定保留、脱敏、访问、删除规则。Anthropic 无法查看 Worker 接收数据后如何被本地记录或保留。 |
| Worker 凭据 | 将环境凭据存入秘密管理设施，限制其可访问的 Environment，暴露时及时撤销轮换。 |
| Memory Store 副本 | Claude API 自托管流程的 Memory Store 工作副本位于 Worker 沙箱的 `/mnt/memory/`，Session 结束后由 Worker 清理；异常退出可能留下副本，客户需检查残留文件及共享文件系统隔离。 |

若 Worker 为 Memory Store 接口转发凭据，使用工作项对应的 Session `secret`；Memory Store 接口不接受 Environment Key。Session `secret` 应只进入承载该 Session 的隔离沙箱，不能写入共享镜像、共享目录或日志。[Security model](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-security)

## 5. 自托管有资源和平台限制

自托管环境不继承所有云端沙箱能力。Claude API 的当前文档仅支持 `memory_store` Session resource；添加 `file` 或 `github_repository` resource 会收到 HTTP 400。输入文件要由客户自行暂存和挂载，仓库也需自行准备与管理，这与第 42、43 课的云端资源流程不同。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)

| 能力 | 自托管影响 |
| --- | --- |
| `file` 与 `github_repository` Session resources | 不可用；由 Worker/客户自行暂存输入文件和检出仓库。 |
| Repository Skill discovery | 不可用；应使用自托管环境支持的 Skill 交付方式。 |
| Vault 中的 Environment variable credentials | 不可用；重新设计 Worker 侧的凭据注入和隔离。 |
| 预装运行时和包 | 不提供云端沙箱的预装集合；Worker 镜像要自行准备工具链和依赖。 |
| Memory Stores | Claude API 自托管可用；AWS 与 Google Cloud Anthropic managed 的自托管场景不支持。 |
| MCP tunnels | 与沙箱执行地点相互独立；受支持的平台可让云端或自托管 Session 通过 Tunnel 访问私有 MCP。AWS 和 Google Cloud Anthropic managed 当前不支持。 |

**边界解释：** 自托管决定 Bash、文件和自定义工具代码在哪里执行；MCP tunnel 决定 Anthropic 服务如何连接位于私有网络的 MCP Server。这是两个不同选择。若目标是让工具执行与 MCP 服务都在自有边界内，需要分别配置并验证这两条路径；使用自托管并不会自动让 Claude 的推理过程或工具结果留在本地。[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)、[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)

## 6. 自托管不改变 Managed Agents 的会话留存资格

截至本课核对日，官方文档标注 Managed Agents（包括 Self-hosted sandboxes）**不具备 Zero Data Retention（ZDR）资格，也不具备 HIPAA 资格**；Session 是有状态资源，会话记录会保留到删除为止。自托管 Worker 上的日志与文件则由客户自行控制。由此应把“运行位置”“发送给模型的内容”“服务端 Session 留存”“Worker 本地日志留存”分开评估，不以 Worker 位于内部网络推断数据处理或合规结论。[Self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes)、[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

## 练习：排查一个一直 queued 的 Session

某 Agent Session 已创建，但事件流没有工具调用事件。请按顺序判断 Worker 连接状态、Session 是否被领取、Worker 是否具备目标平台认证，以及其结果能否返回 Managed Agents；再指出要确认哪些数据仍发送至 Anthropic。

**参考答案：** 先查 Environment 队列统计的 `workers_polling`，再检查 Worker 轮询日志、认证身份与连接目标。若没有 Worker，Session 可以保持 queued；这不等于 Agent 正在运行。确认 Worker 领取后，再看 Session 事件流和 Worker 的工具执行结果回传。核对 Claude API、AWS 或 Google Cloud 的具体认证方式，不混用环境 Key。无论工具在哪执行，Claude 仍在 Anthropic 侧运行，对话历史和工具结果仍会传到 Managed Agents；Worker 主机上的文件、进程和本地日志则属于客户控制范围。

## 本课结论

Self-hosted Environment 是由客户 Worker 消费的工作队列：Anthropic 运行 Claude 并发送工具调用，Worker 在本地执行并回传结果。部署时要区分应用 API Key 和 Worker Environment Key，按平台选择正确认证方式，并承担沙箱隔离、出站网络、凭据、数据日志和副本清理责任。自托管改变工具执行地点，不改变工具结果发送、Session 留存资格或平台资源限制。

## 范围与时效

- 官方资料核对日期：2026-11-11；Self-hosted sandboxes 当时为 Beta。
- 本课的平台差异依据 Claude API、Claude Platform on AWS、Claude Models on Google Cloud（Anthropic managed）的官方文档；不要将 Claude API 的凭据和功能表直接推广到其他端点。
- Worker API、Beta Header、平台认证和功能可用性可能变化；实施前以目标平台当前文档为准。
