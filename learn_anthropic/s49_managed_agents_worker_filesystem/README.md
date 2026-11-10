# 第 49 课：自托管 Worker 的工作目录与文件访问范围如何配置？

**目标：** 能区分 Worker 工作目录、Skills、Memory Stores 和 Session 产物的位置，使用 `AgentToolContext` 配置内置文件工具的附加读写范围，并说明这些路径规则与 Bash、Custom Tools 及操作系统沙箱的边界。

## 本课问题

Self-hosted Worker 里的 `/workspace`、Skills 目录、Memory Store 挂载目录和最终交付文件各在哪里？`allowed_roots` 与 `read_only_roots` 能防住哪些访问？为什么这些选项不能替代真正的沙箱隔离？

## 官方资料

- [Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)：CLI `workdir`、文件系统布局、SDK helpers 与 `AgentToolContext` 路径策略。
- [Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)：每 Session 沙箱、输出目录挂载和自托管文件暂存。
- [第 43 课：Managed Agents 文件输入与输出](../s43_managed_agents_files/README.md)、[第 44 课：自托管沙箱安全边界](../s44_managed_agents_self_hosted_sandbox/README.md)、[第 45 课：Worker 部署模式](../s45_managed_agents_worker_deployment/README.md)、[第 46 课：Memory Store 同步](../s46_managed_agents_self_hosted_memory_sync/README.md)、[第 47 课：Custom Tools 与内部 MCP](../s47_managed_agents_self_hosted_custom_tools/README.md)。

核对日期：2026-11-11。Self-hosted sandboxes 属于 Beta，当前文档要求 `managed-agents-2026-04-01` Beta Header。Worker 默认目录、工具路径策略和文件系统布局可能随 CLI、SDK 与目标平台变化。

## 1. 先区分工作目录、Skills、Memory 与输出

| 路径 | 内容与用途 | 管理边界 |
| --- | --- | --- |
| `/workspace` | Self-hosted 系统默认的工具工作目录。 | CLI `--workdir` 可覆盖；默认值是进程当前目录 `.`。若改工作目录，应让 Agent system prompt 明确新位置。 |
| `<workdir>/skills/<name>/` | Worker 下载的 Agent Skills。 | 内置 CLI/SDK Worker 在解包时保留 Skill 里的 executable 权限；手动下载 Skill 时由实现方保留执行位。 |
| `/mnt/memory/<store>/` | Session 挂载的 Memory Store 本地副本。 | Worker 按 resource `mount_path` 创建和同步，并在 Session 结束后清理；不要自行预建子目录。 |
| `/mnt/session/outputs` | Anthropic 托管沙箱提示中常用的产物目录。 | Self-hosted Session 的 system prompt 不会自动包含该目录指示；Agent 把产物写到哪里由 Worker 文件系统和指令决定，通常在工作目录下。 |

`ant beta:worker poll --workdir /workspace` 会将工具工作目录和 Skills 下载位置设为 `/workspace`。CLI `--workdir` 本身省略时使用运行进程的当前目录 `.`；这与工具系统默认的 `/workspace` 不是同一个默认值。自定义目录后，要同步更新 Agent 指令中的 Skill 路径、任务输入路径和输出路径。[Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)

为每个任务明确最终交付位置。若由第45课的 `--on-work` 脚本启动临时 Session 沙箱，可将主机输出目录挂载到沙箱工作目录，并在 Session 退出后从主机路径取回文件；否则临时容器里的文件可能随容器销毁。[Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)、[第 45 课](../s45_managed_agents_worker_deployment/README.md)

## 2. 用 `AgentToolContext` 设置内置文件工具能访问的目录

SDK 的 `AgentToolContext` 为工具调用定义工作目录和路径策略，也可协助下载 Session Skills。`EnvironmentWorker` 默认管理该 Context 与标准 Agent toolset；如果直接使用更底层的 `tool_runner()`，则由 Worker 实现者自行创建 Context 和工具列表。[Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)

| 选项 | 内置文件工具的效果 | 不包括什么 |
| --- | --- | --- |
| `workdir` | 确定工具工作目录；标准工具和 Skill 文件路径以此组织。 | 不限制 Bash 可访问的目录。 |
| `allowed_roots` | 在工作目录以外，额外允许 `read`、`write`、`edit`、`glob`、`grep` 访问的目录。 | 不授予系统用户或其他进程权限。 |
| `read_only_roots` | 内置 `write` 与 `edit` 工具会拒绝修改这些根目录下的文件；读取仍可进行。 | 不会阻止 Bash、Custom Tools 或 MCP Server 写入。 |

配置意图示意（显示路径策略关系，不是 Agent 创建请求体）：

~~~text
AgentToolContext
  workdir: /workspace
  allowed_roots:
    - /srv/reference
  read_only_roots:
    - /srv/reference
~~~

Worker 会自动把 Session Memory Store 目录加入 `allowed_roots`；如果某个 Store 的 `access` 是 `read_only`，Worker 也会把该 Store 目录加入 `read_only_roots`。因此自定义 `AgentToolContext` 或工具列表时，不应误删 Memory Store 的访问策略；优先让 `EnvironmentWorker` 处理这些预设。[Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)、[第 46 课](../s46_managed_agents_self_hosted_memory_sync/README.md)

## 3. 文件工具路径策略不是沙箱

路径策略只限制 Agent 的内置文件工具。官方明确说明 `AgentToolContext` 的隔离**不是沙箱，也不约束 Bash**：Agent 若有 Bash，可以使用命令行程序访问该进程与操作系统权限所允许的文件。相同地，Custom Tool 和 MCP handler 执行自己的代码，不会自动受 `allowed_roots` 或 `read_only_roots` 管理。[Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)、[第 47 课](../s47_managed_agents_self_hosted_custom_tools/README.md)

因此：

- 把共享参考目录加入 file tool roots，可让内置读取工具方便地访问它；但若必须禁止写入，还要限制 Bash 和拥有文件系统权限的自定义工具，或在操作系统层设置只读挂载/账户权限。
- 不要因设置了 `read_only_roots` 就把敏感目录同时挂载给一个可以运行任意 Bash 的 Session。
- 真正的运行隔离仍需依赖 Session 专属容器或虚拟机、最小权限用户、挂载范围、只读文件系统与网络出口规则；Worker 的路径策略只是额外的文件工具护栏。[第 44 课](../s44_managed_agents_self_hosted_sandbox/README.md)

## 4. 选用与需求匹配的 SDK 执行层

Self-hosted Worker SDK 从整合度最高到控制度最低有三层：

| Helper | 负责什么 | 合适的情形 |
| --- | --- | --- |
| `EnvironmentWorker` | 从轮询、Session 准备到工具执行的一站式流程；可通过 `tools` factory 自定义工具列表。 | 大多数自托管任务，以及需要标准 AgentToolContext/Memory Store 行为的场景。 |
| `work.poller()` | 领取工作并交付每个 Session work item；调用方决定沙箱如何启动和结束。 | 需要在 Worker host 上自行启动每 Session 容器或控制工作项分发。 |
| `client.beta.sessions.events.tool_runner()` | 对已经领取的 Session 执行工具调用，接收 Session ID 和工具列表。 | 自己已完成队列领取与 Session 运行管理，只需要调用工具执行层。 |

越往下层，Worker 实现者要负责的会话目录、Skills 准备、工具 Context、Memory Store secret 与停止回执越多。选择低层 helper 时，按 Worker Reference 逐项补齐高层 helper 默认处理的行为；不要把“工具调用可运行”当成完整 work item 生命周期已处理。[Self-hosted worker reference](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-reference)

## 练习：共享参考只读、产物按 Session 保存

多个 Session 可读取 `/srv/reference/` 下的只读业务词汇表，但每个 Session 只能写自己的结果文件。Agent 有内置 `read/write` 和 Bash；Worker 通过 SDK 提供标准工具。请设计路径策略、说明风险边界，并指定 Self-hosted 输出目录。

**参考答案：** 将 `/workspace` 作为工作目录，令 `/srv/reference` 可由文件工具访问，并对该目录设置 `read_only_roots`。每个 Session 把结果写入自己的 `/workspace/outputs/` 或该 Session 专属的持久挂载目录。由于 Bash 不遵守 AgentToolContext 的根目录策略，若必须防止 Agent 修改参考库，应另外撤销 Bash、限制 Worker 用户与目录权限，或将参考目录以操作系统只读方式挂载；`read_only_roots` 自身不能提供这个安全保证。若沙箱是临时容器，先把产物写到独立挂载的主机输出目录，再销毁容器。

## 本课结论

自托管 Worker 的 `/workspace`、Skills、`/mnt/memory` 和交付物应分别规划。`AgentToolContext` 的 `allowed_roots` 与 `read_only_roots` 为内置文件工具设定路径护栏，并自动纳入 Memory Store 路径；它们不限制 Bash、Custom Tools 或底层进程权限。确定输出目录、Session 文件系统和真实隔离措施后，再按控制需求选择 `EnvironmentWorker`、`work.poller()` 或 `tool_runner()`。

## 范围与时效

- 官方资料核对日期：2026-11-11；Self-hosted workers 当时为 Beta。
- Worker flags、SDK helper 层级、Skills 和 Memory Store 路径、工具访问策略可能随版本变化；以目标平台最新 Worker Reference 为准。
- 自托管安全模型见第44课；Worker 部署方式见第45课；Session 文件输入与输出见第43课。
