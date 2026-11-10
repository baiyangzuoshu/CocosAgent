# 第 46 课：自托管 Worker 如何同步 Managed Agents Memory Stores？

**目标：** 能描述 Memory Store 在自托管 Worker 上的本地副本和同步周期，配置同步频率与删除策略，解释只读和并发冲突行为，并规划挂载目录、Session 隔离和优雅关停。

## 本课问题

云端 Memory Store 在自托管 Worker 中不是实时挂载。Worker 什么时候下载、上传和清理本地副本？不同 Session 同时修改同一条记忆时谁胜出？如何避免本地目录、删除同步和意外强制退出造成问题？

## 官方资料

- [Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)：Worker 文件系统要求、同步过程、配置、删除、只读与冲突处理。
- [Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)：Memory Store 的 Session 挂载、权限和版本记录。
- [Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)：自托管 Memory Store 的平台例外。
- [第 35 课：Memory Stores 基础](../s35_agent_memory_stores/README.md)、[第 44 课：自托管沙箱安全边界](../s44_managed_agents_self_hosted_sandbox/README.md)、[第 45 课：自托管 Worker 部署](../s45_managed_agents_worker_deployment/README.md)。

核对日期：2026-11-11。Self-hosted sandboxes 与 Memory Stores 当时为 Beta，当前 Beta Header 为 `managed-agents-2026-04-01`。下文参数和文件系统要求来自当前 Managed Agents Memory Worker 文档；实施前应核对目标平台和 Worker 版本。

## 1. 自托管 Memory Store 是 Worker 管理的工作副本

Session 仍在创建时通过 `resources` 挂载 Memory Store。不同点在于谁提供文件：云端由 Anthropic 的沙箱挂载；自托管由 Environment Worker 下载到 Session resource 返回的 `mount_path`，该路径位于 `/mnt/memory/` 下（例如 `/mnt/memory/user-preferences/`），并负责同步 Agent 的修改。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)、[Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)

```text
Session 创建并附加 Memory Store
            ↓
Worker 领取 work item，取得该 Session 的 secret
            ↓
把 Store 下载到 /mnt/memory/ 下的挂载目录
            ↓
Agent 用普通文件工具读取/修改本地副本
            ↓
Worker 定期调和：远端变化下到本地，本地变化上传到 Store
            ↓
Session 结束时最后同步，再删除 Worker 创建的目录
```

Anthropic 侧的 Memory Store 是权威版本。它不是两份文件夹之间的即时共享盘：一条记忆的变化要经过 Worker 同步，另一个自托管 Session 才会看到。默认同步间隔下，两个仍在运行的 Session 通常在一分钟内看到彼此更新；云端沙箱共享 Store 的变化则几乎立即可见。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)

## 2. 主机和沙箱必须满足挂载前提

当前文档要求：

- Worker 使用 `ant` CLI 1.33.0 或更新版本，或 Python、TypeScript、Go SDK 的 `EnvironmentWorker`。
- 提供 POSIX 文件系统；Windows 主机不受支持，因为 Worker 打开 Memory 文件时使用 `O_NOFOLLOW`。
- 建议使用区分大小写的文件系统。macOS 默认通常不区分大小写，因此路径仅大小写不同的记忆可能互相冲突。
- 预先准备可写的 `/mnt/memory` 父目录。**不要自己创建每个 Store 的挂载目录**：Worker 会在 Session 开始时创建并在结束时删除；若路径已存在，Worker 会拒绝开始该项工作。
- 每 Session 沙箱镜像需要有可写的 `/mnt/memory`。无需把这些 Store 子目录绑定到主机目录，Worker 会在沙箱退出前将变化上传到 Store。

macOS 根卷对 `/mnt` 不可写，官方提供了单独的主机准备流程；没有正确准备目录时，Worker 可能无法创建 Store 目录，Session 会保持 idle 且没有错误事件。遇到此状况时先核对该平台的挂载准备与 Worker 日志，不要误判成 Agent 没有读取记忆。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)

如果两个 Session 同时在同一主机上挂载同一个 Store，它们会争用相同的 Store 目录路径。因此这类共享记忆任务应做到每个 Session 使用独立文件系统；第45课的每 Session 沙箱是一种满足方式。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)、[第45课：Worker 部署](../s45_managed_agents_worker_deployment/README.md)

## 3. 同步频率与删除策略

SDK 的 `EnvironmentWorker` 提供两个 Memory Store 同步选项；`ant` CLI Worker 使用默认值：

| 选项 | 默认值 | 可选值与含义 |
| --- | --- | --- |
| `memory_sync_interval` | 15 秒 | 最小 5 秒；缩短间隔可缩小其他 Session 看到旧记忆的时间窗，但会增加 Memory Store 请求；设为 `None` 会关闭 Worker 的记忆支持。 |
| `memory_sync_deletions` | `"enabled"` | `"enabled"`：确认文件在后续同步时仍不存在后才删除远端记忆；`"log_only"`：执行检查并记录将要删除的内容，但不删除；`"disabled"`：不从 Store 删除记忆。 |

SDK 设置示例：

~~~python
worker = EnvironmentWorker(
    client,
    environment_id=environment_id,
    environment_key=environment_key,
    workdir="/workspace",
    memory_sync_interval=10,
    memory_sync_deletions="log_only",
)
~~~

如果将 `memory_sync_interval=None`，Worker 不会下载或同步任何 Store；某个 Session 即使声明了 Memory Store，也会在没有实际记忆文件的情况下运行，而 System Prompt 仍可能提到 Store。只对确定不会附加 Memory Stores 的 Worker 关闭此功能。若 Session 附加了 Store，但 Worker 领取的 work item 没有对应 Session `secret`，工作项会失败，不会静默退化成无记忆执行。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)

Store 删除策略值得单独观察：默认 `enabled` 会把 Agent 在本地删除的文件同步为远端记忆删除；`log_only` 可先检查日志中将删除的记忆，再决定是否启用；`disabled` 保留远端内容。同步上传和下载不会因删除策略关闭而停止。

## 4. 只读模式和并发冲突的实际含义

### `read_only` 限制同步写入，不代表本地目录不可变

Session 将 Store 设为 `read_only` 后，Agent 的 `write` 和 `edit` 工具会拒绝修改该目录，Worker 也不会上传该 Store 的任何本地变化。但 Bash、自定义工具或 MCP Server 仍可在本地副本上写文件；这些修改不会同步回 Store。后续 Store 端出现新变化时，Worker 会用远端文件覆盖本地修改。

不要把 Store 目录在操作系统层面挂载成只读：Worker 自己需要创建目录并写入下载的记忆。若要求 Agent 在本地也无法更改只读 Store，应关闭 Bash，并且不提供可写入沙箱文件系统的自定义工具或 MCP Server。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)

### 冲突以远端 Memory Store 为准

假设 Session 本地改写了一条记忆，而在本次同步前 Store 端也被另一 Session 更新。下一次同步会保留 Store 端版本、覆盖 Worker 的本地文件并记录警告。Agent 的 `write`/`edit` 工具调用可能已经成功，Agent 不会收到冲突错误；但它刚写入的版本仍可能被同步覆盖。若该修改仍需应用，应在同步后重新读取当前文件，确认远端内容后再决定是否重写。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)

每个 Store 目录有 `.anthropic-memory-store` 标记文件，用于识别 Store 和确认同步目录；不要删除或修改它，否则 Worker 不会同步该目录。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)

## 5. 用优雅关停完成最后同步

Session 结束时，Worker 会执行最后一次同步，最多等待 30 秒上传仍在排队的变化，再清理自己创建的 Store 目录。若 Worker 被强制杀死而未运行 teardown，尚未同步的编辑会丢失，Store 子目录会留在文件系统上。下次工作项可能因为目标挂载路径已存在而拒绝启动。

维护或缩容 Worker 时，应使用第45课介绍的信号处理与优雅停机流程：先停止接受新工作，让正在运行的任务经过 Worker 的结束清理，再确认 Store 已同步、目录已清除。共享主机要检查异常退出留下的目录，但不要直接删除尚有 Session 正在使用的 Store 工作目录。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)、[第45课：优雅停止 Worker](../s45_managed_agents_worker_deployment/README.md)

## 6. 先核对平台支持

Claude API 的自托管 Worker 文档说明可从工作项挂载并同步 Memory Stores。平台选择文档同时列出明确例外：Claude Platform on AWS 和 Claude Models on Google Cloud（Anthropic managed）的自托管 Session 当前不能使用 Memory Stores。不要只根据通用 Memory Store API 或 Self-hosted Memory Worker 页面的产品标签推断目标端点支持，创建 Session 前应按实际平台复核。[Choosing an agent environment](https://platform.claude.com/docs/en/managed-agents/choosing-an-environment)

## 练习：两个 Session 同时更新同一 Store

Session A 与 B 在同一 Store 的 `/project/decision.md` 上工作。A 更新后尚未同步，B 根据旧副本写入新内容；随后 B 先同步，A 再同步。请说明 A 是否会收到文件冲突错误、最终 Store 内容由谁决定，以及如何调整部署避免这次路径争用与数据丢失。

**参考答案：** Worker 同步发现本地和远端同一文件都已变化时，以 Store 端版本为准，覆盖 A 的本地副本并记录警告；A 的 `write`/`edit` 调用可以成功而不会收到冲突错误。应让 Session 使用独立文件系统，缩短同步间隔只能缩短冲突窗口，并不能消除并发编辑冲突。关键更新后重新读取远端版本，必要时由应用排队串行化写入或在业务层合并，再确认最终内容。

## 本课结论

自托管 Worker 把远端 Memory Store 映射为每个 Session 的本地工作副本，再按间隔及 Session 结束阶段同步。远端 Store 是权威源；相互冲突时远端覆盖本地，工具调用不会自动向 Agent 报错。满足 POSIX 文件系统和目录要求、按 Session 隔离共享 Store、配置合适的同步与删除策略，并优雅关停 Worker，才能降低旧记忆、丢失编辑和遗留数据的风险。

## 范围与时效

- 官方资料核对日期：2026-11-11；Memory Stores 与自托管 Worker 当时为 Beta。
- 本课提到的 Worker 版本、同步间隔、目录、平台支持和 Beta Header 可能变化，应按目标平台当前文档核对。
- 若自行调用 API，Memory Store 请求使用 `agent-memory-2026-07-22`，Session 创建/附加资源仍使用 `managed-agents-2026-04-01`；不要在 Memory Store 请求中合并这两个 Header。细节见第35课。
- Store 读写权限、记忆版本与跨 Session 使用见第35课；Worker 领取方式、执行模式和关停见第45课。
