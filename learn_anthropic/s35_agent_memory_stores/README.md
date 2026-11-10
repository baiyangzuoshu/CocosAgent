# 第 35 课：Claude Managed Agents Memory Stores 如何让 Agent 跨 Session 记住信息？

**目标：** 能区分一次 Session 的短期上下文和跨 Session 使用的 Memory Store，说明存储如何挂载、谁能读写、版本如何审计，以及 Cloud 与 Self-hosted 环境的同步和支持边界。

## 本课问题

Agent 如何把用户偏好、项目规范和过去的经验带到下一次 Session？Memory Store 是否会自动成为模型上下文？如何避免共享记忆被不可信输入污染？

## 官方资料

- [Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)：Memory Store 创建、挂载、读写、权限、版本和管理建议。
- [Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)：Worker 如何下载并同步 Memory Store，以及 Self-hosted 的主机要求。
- [Dreams](https://platform.claude.com/docs/en/managed-agents/dreams)：将历史 Session 与 Memory Store 汇总成新的记忆库（Research Preview）。
- [Create a Memory Store API](https://platform.claude.com/docs/en/api/beta/memory_stores/create)：创建参数、Workspace 范围及 Beta Header。
- [第 32 课：Managed Agents 资源与生命周期](../s32_managed_agents_lifecycle/README.md)：Agent、Environment、Session、Vault 与留存基础。
- [第 34 课：Scheduled Deployments 周期运行](../s34_scheduled_deployments/README.md)：让周期创建的 Sessions 使用一致的配置。

核对日期：2026-11-10。Memory Stores 当前为 Beta。使用指南要求 Memory Store 请求使用 `agent-memory-2026-07-22`，而创建或附加 Memory Store 的 Session 请求继续使用 `managed-agents-2026-04-01`；不要在 Memory Store 请求中同时发送两个 Header。特定 API Reference 可能列出兼容的 Header，按实际 endpoint 文档核对；SDK 通常会按调用设置正确的 Header。

## 1. Memory Store 保存什么，不保存什么

Managed Agents 的每个 Session 默认从新的对话上下文开始。前一次 Session 中形成的状态不会自动进入下一次 Session。Memory Store 是 Workspace 范围内的一组文本资料；把 Store 附加到新 Session 后，Claude 可以使用 Agent 文件工具阅读或更新其中的内容。

这形成两类不同的状态：

| 状态 | 生命周期 | 典型内容 |
| --- | --- | --- |
| **Session 上下文** | 单次 Session 内的对话历史和执行状态。 | 当前任务说明、工具结果、这一轮新发现。 |
| **Memory Store** | 独立于单次 Session，可由之后的 Session 再次挂载。 | 用户偏好、项目规范、稳定的领域背景、复用经验。 |

Memory Store 不是自动注入的完整模型上下文。挂载后，系统提示会告诉 Agent 存储名称、目录和使用指引；Agent 仍需使用文件工具读取与当前任务相关的资料。它是外部的持久文本资料，不会自动替代应用自己的用户授权、数据保留和审计规则。[Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)

## 2. 按所有权拆分 Store，在创建 Session 时挂载

Memory Store 有 Workspace 范围。一个稳妥的组织方式是把生命周期和所有权不同的内容分开放：

| Store | 访问范围 | Session 中的权限 | 示例 |
| --- | --- | --- | --- |
| **共享参考库** | 同一 Workspace 内多个 Agent 或 Session。 | 通常 `read_only`。 | 团队编码规范、产品词汇表、固定流程。 |
| **团队或项目记忆** | 某个团队或项目。 | 只有负责积累信息的 Session 才用 `read_write`。 | 项目架构背景、经过核实的决策摘要。 |
| **用户专属记忆** | 映射到单一用户或明确授权主体。 | 只挂载给该用户的 Session。 | 用户格式偏好、经同意保存的工作偏好。 |

应用通过 Session 创建请求的 `resources` 添加 Store ID，并可提供 `instructions` 告诉 Agent 何时查阅或更新它。Store 挂载路径由服务端返回在 `mount_path` 字段中；使用这个返回值，不要自行推导目录名。Memory Store 只能在创建 Session 时挂载，Session 正在运行时不能再添加或移除。当前文档列出的上限是每个 Session 最多 8 个 Memory Stores。[Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)

~~~text
新 Session
  ├── shared-guidelines / read_only
  │     └── 团队共同参考内容
  └── project-alpha / read_write
        └── 仅该项目可以维护的记忆
~~~

对于 Scheduled Deployment，如果需要跨次运行使用同一份持续资料，应将适用的 Memory Store 配置在 Deployment 创建出的 Session 中；如果没有挂载，后续 Session 不会自然继承前一次的文件状态。不同业务用户的记忆应映射到各自的 Store，避免因为“共享一个 Agent 定义”就顺带共享用户资料。[Scheduled deployments](https://platform.claude.com/docs/en/managed-agents/scheduled-deployments)

## 3. 明确读写模式，防止错误记忆长期传播

Store 挂载的 `access` 当前默认是 `read_write`，也可以设成 `read_only`。只读适合参考资料和共享查阅；读写适合需要经授权积累新信息的 Store。权限在文件系统层面生效，读写产生的修改会回写到 Store。

每次 Memory 内容变更都会建立不可变版本，并记录来自哪个 Session，方便审计和回到某个时间点。应用可以通过 API 或 Console 查看和修改单条记忆，也可建立审批流程，在把 Agent 写入内容分享给后续 Sessions 前先复核。[Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)

持久化会让坏内容传播得更久。官方资料特别提醒：如果 Agent 读取用户输入、网页或第三方工具结果，不可信内容可能通过提示注入诱使 Agent 把错误或恶意信息写进 Memory Store，之后的 Session 又会把它当作可信参考。共享资料默认只读；专属记忆的读写范围按主体划分；对外部输入产生的重要记忆设置人工复核或来源标记。不能把 Agent 自己写进 Store 的内容自动视为已核实事实。

## 4. Cloud 挂载与 Self-hosted 同步不同

| 环境 | Store 如何到达 Agent | 同步和限制 |
| --- | --- | --- |
| **Cloud** | Store 作为 Session 沙箱中的目录挂载，文件工具读写会同步回 Store。 | 直接使用云端挂载；从 Session 获取准确的 `mount_path`。 |
| **Self-hosted** | Worker 在 Session 工作开始前下载 Store 到本地目录，并在运行过程中把变化同步回 Store。 | 当前文档说默认最多每 15 秒同步一次，并在 Session 结束时再同步；不同 Worker 之间的修改可能暂时不同步。 |

Self-hosted 下的 Memory Store 是 Worker 管理的本地副本，不是共享文件系统上的实时目录。只要并发 Session 可能改写同一记忆，就要考虑同步间隔和冲突处理；不要把本地 copy 中的每次修改都当作已立即写回。Worker 还需要符合当前文档的运行环境要求。

Self-hosted 的 `read_only` 会让 Agent 的 `write`/`edit` 工具拒绝修改，并阻止 Worker 上传该目录的变化；它不会阻止 `bash` 或可写文件系统的自定义工具更改本地副本。此类改动不会同步到 Store；若必须保证本地副本也不变，需要同时禁用 Bash 和可写自定义工具。发生并发冲突时 Store 端版本优先，本地修改可能在同步时被覆盖；关键写入后应重新读取以确认内容。

Memory Store 对 Self-hosted 的支持也取决于平台：当前 Memory 文档列出 Claude Platform on AWS 和 Claude Models on Google Cloud（Anthropic managed）的 Self-hosted Sessions 不支持挂载 Memory Stores。部署时要逐一核对当前目标平台的能力表，不能只因通用 Self-hosted 文档介绍了 Worker 同步，就推断每个云平台都支持。[Memory stores in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-memory)、[Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)

## 5. 审计、整理、归档和留存

Memory Store 中每一项记忆以路径对应文本内容，API 支持列出、读取、修改、删除以及查看版本。创建、读写与版本管理属于 Beta 能力。当前文档列出的上限是每个 Store 10,000 条记忆；到达上限后，新路径写入会失败，所以需要定期清理过时或重复信息，并把稳定的共识压缩成更少的文档。

Store 可以独立于 Session 归档或删除：归档会令它只读，并阻止挂载到新 Session；归档不可撤销。永久删除则会删除 Store、内容和版本记录。Session 被删除不会自动清除 Memory Store，反过来，删除 Store 也会影响之后依赖它的任务。制定保留时间和删除流程时，分别检查 Session 与 Memory Store。

如果要把多次 Session 形成的片段整理成新的记忆库，官方还提供 Dreams。它读取一个既有 Store 和若干历史 Session，生成**新的**输出 Store，不直接修改输入；该功能目前是 Research Preview，适用模型、数据处理和成本须按当前页面复核。发布前应检查输出内容，再把新 Store 挂到后续 Session；不要未经审核自动覆盖旧记忆。[Dreams](https://platform.claude.com/docs/en/managed-agents/dreams)

Memory Stores 和 Managed Agents Sessions 当前都不具备 Zero Data Retention（ZDR）资格，也不具备 HIPAA 资格。把数据改为 Memory Store 或切换到 Self-hosted 环境不会自动改变这些条件。跨 Session 保留的数据必须纳入访问控制、审计、保留期限和删除策略。[Using agent memory](https://platform.claude.com/docs/en/managed-agents/memory)

## 练习：让每个项目 Session 复用团队规范

开发团队希望 Claude 在每个新 Session 开始时遵循相同的代码规范；项目 Alpha 还需记住该项目独有的目录结构和已确认决策。Agent 也会分析开发者提交的网页资料。请设计 Store 划分与访问权限，并说明怎样检查写入内容、如何处理 Self-hosted 同步、何时归档或删除记忆。

**参考答案：** 创建一个团队共享的只读规范 Store，以及一个只给 Alpha Session 挂载的读写 Store。创建 Session 时将两个 Store 一起放入 `resources`，从 Session 对象读取各自 `mount_path`，并给 Agent 说明何时读取和如何记录项目决策。网页资料保持不可信；Agent 不应直接把其中的指令或未经核实的结论写成团队长期规范。由项目负责人复核读写 Store 的新版本，并保留来源与适用范围。若使用 Self-hosted，确认目标平台支持 Memory Stores，再等待 Worker 同步完成后，才假设其他 Session 可见更新。停用项目或用户访问时，分别检查相关 Sessions 和 Memory Store，并按组织保留策略归档或删除。

## 本课结论

Memory Store 让 Agent 在不同 Sessions 中重新读取和更新一组持久文本资料。通过在 Session 创建时挂载、按所有权拆分 Store、对共享资料使用只读、审查读写版本，以及核对 Self-hosted 同步与平台支持，可以保留有用的长期资料，同时降低错误记忆跨任务传播的风险。

## 范围与时效

- 官方文档核对日期：2026-11-10；Memory Stores 当时为 Beta，Dreams 为 Research Preview。
- Beta Header、Store 数量与容量、平台支持、Worker 同步行为及 Dreams 支持范围可能调整；按 API Reference 与目标平台重新核对。
- Session 与 Agent 的留存边界见第32课；周期 Deployment 使用 Memory Store 的配置与运行关系见第34课。
