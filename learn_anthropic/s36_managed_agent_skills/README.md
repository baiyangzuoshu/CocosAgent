# 第 36 课：Claude Managed Agents Skills 如何复用领域工作流？

**目标：** 能说明 Managed Agents 如何发现并加载 Skills，比较 Agent 配置附加与 GitHub 仓库发现两种方式，并为 Skill 选择版本、编写触发描述和建立信任边界。

## 本课问题

怎样让不同 Session 复用团队的工作流程，而不用在每次任务中重贴说明？Skill 的哪些部分会进入上下文？把 Skill 放进代码仓库后，谁能改变 Agent 的指令？

## 官方资料

- [Skills for Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/skills)：内置与自定义 Skill、Agent 配置、GitHub 仓库发现和版本选择。
- [Agent Skills 概览](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)：Skill 文件结构、渐进式披露和不同 Claude 产品的接入方式。
- [Skill 编写最佳实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)：触发描述、内容组织、评测和迭代。
- [Managed Agents 安全边界](https://platform.claude.com/docs/en/managed-agents/secure-deployment-risks)：提示注入、工具、凭证和沙箱的安全限制。
- [GitHub 接入](https://platform.claude.com/docs/en/managed-agents/github)：挂载 GitHub 仓库与会话资源。
- [第 27 课：工具安全与提示注入](../s27_tool_security_prompt_injection/README.md)、[第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 35 课：Memory Stores](../s35_agent_memory_stores/README.md)。

核对日期：2026-11-10。Managed Agents Skills 当前属于 Beta，文档列出的 Beta Header 为 `managed-agents-2026-04-01`；Skills 页面注明 Managed Agents 不符合 ZDR 和 HIPAA 资格。Header、支持平台、预置 Skill、容量与版本规则会变化，接入时应按目标平台的当日文档复核。

## 1. Skill 是可复用的工作方法，不是新的权限

Skill 将领域指引、流程和可选的参考文件、模板、脚本组织成目录，让 Agent 在任务相关时读取。它适合保存稳定且可重复的操作知识，例如代码审查规范或报告格式；一次请求的特殊要求仍应写在该次任务指令里。

| 部件 | 主要作用 | 例子 |
| --- | --- | --- |
| Agent 指令 | 定义 Agent 的总体角色和长期行为方向。 | “你负责协助代码审查。” |
| Toolset、MCP 与环境 | 提供 Agent 获准使用的操作能力。 | 文件读取、Bash、GitHub MCP。 |
| Skill | 提供与具体任务相关的工作步骤和参考资料。 | 审查清单、发布说明模板、验证脚本。 |
| Memory Store | 保留跨 Session 的项目或用户资料。 | 项目约定、经过确认的历史决策。 |

Skill 目录里的脚本可以通过可用工具执行，但把 Skill 附加给 Agent 并不等于把权限策略、网络范围或凭证权限交给 Skill 决定。应由 Agent 工具集、环境、权限策略和密钥侧控制这些能力；这是把 Skills 文档与 Managed Agents 安全边界合并后的设计结论。[Agent Skills 概览](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)、[Managed Agents 安全边界](https://platform.claude.com/docs/en/managed-agents/secure-deployment-risks)

## 2. 逐层加载，控制上下文成本

Skill 有 `SKILL.md`，也可带同目录的参考文件和脚本。Claude 不必一开始就读取所有正文：启动时用名称和描述判断哪些 Skill 可能相关，任务匹配后再读 `SKILL.md`，并按需读取文件或运行脚本。这种渐进式披露让 Skill 库可以复用较完整的资料，又不把每一份资料都预先塞进上下文。[Agent Skills 概览](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

| 层级 | 何时使用 | 应放的内容 |
| --- | --- | --- |
| `name`、`description` | 启动时用于识别与匹配。 | 简短名称；Skill 做什么、何时该使用。 |
| `SKILL.md` 正文 | 任务与描述匹配时读取。 | 清楚的步骤、判断条件、验证要求。 |
| 附属文件与脚本 | 正文引用后按需读取或执行。 | 大型参考资料、模板、示例和重复性验证代码。 |

描述决定发现效果，最好同时包含“做什么”和“什么场景触发”。正文只保留 Claude 不应自行推断的细节；长资料拆成从 `SKILL.md` 直接链接的文件，减少层层跳转和无关上下文。易错且必须一致的操作可由脚本和检查清单固定；需要因任务而调整的工作则提供原则和判断标准。[Skill 编写最佳实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

## 3. 两种 Managed Agents 接入方式

| 接入方式 | 工作区配置 | 适合情况 | 需要留意 |
| --- | --- | --- | --- |
| Agent 的 `skills` 数组 | 预置 Skill 使用 `type: anthropic` 和短 ID；自定义 Skill 先上传到 Workspace，再用 `type: custom` 和返回的 `skill_*` ID。 | 组织管理的稳定能力、多个代码库共用的技能。 | 可选 `version` 固定具体版本；不填时默认为 `latest`。生产工作流固定版本有助于复现变更。 |
| 挂载 GitHub 仓库 | Session 创建时挂载 `github_repository`；仓库根目录的 `.claude/skills/` 会在 Session 启动时扫描。 | 与项目代码同版本维护、只对某个仓库有意义的技能。 | 读取的是本次 Session 挂载的分支或提交；会话中途新推送的改动不会触发重新扫描。 |

Managed Agents 文档目前列出每个 Session 最多 500 个 Skills，按该 Session 中 Agent 的去重集合计算。通过 Agent 数组挂载的技能与仓库技能可以并用；同名技能也可能各自以不同路径出现，因此应避免让同一 Session 同时收到语义冲突的同名指引。[Skills for Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/skills)

注意产品接入形态不同：Messages API 通过 `container` 中的 `skill_ids` 使用 Skills，并需启用 code execution tool；Managed Agents 则在 Agent 定义或挂载的仓库中提供 Skills。目录内容可以遵循共同的 Agent Skills 格式，但请求参数和运行环境不可混为一谈。[Agent Skills 概览](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)

Agent 配置示例：

~~~yaml
name: Code Reviewer
skills:
  - type: anthropic
    skill_id: pdf
  - type: custom
    skill_id: skill_<上传后返回的ID>
    version: latest
~~~

上传自定义 Skill 时，目录里要有 `SKILL.md` 和可选的支持文件；平台返回的 `skill_*` ID 再放入 Agent 配置。CLI 的 `ant apply` 示例会把 Skill ID 记录在 `claude-lock.json`，修改后提交该锁定文件可避免每次更新时意外创建第二个 Skill。[Skills for Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/skills)

## 4. 编写可发现、可维护的 `SKILL.md`

最小结构示例：

~~~markdown
---
name: pr-summary
description: Summarizes pull request changes and risks in the team's review format. Use when reviewing a pull request or drafting a reviewer handoff.
---

# PR summary

1. Summarize what changed and why.
2. List risks and checks a reviewer should inspect.
3. If a claim depends on repository code, cite its file and location.
~~~

`name` 应简短、统一且便于识别；官方最佳实践建议用小写字母、数字和连字符。`description` 应写成清晰的第三人称能力说明，并指出适用任务，而不是使用“我能帮你”等模糊句子。适合的 Skill 还应明确输出格式、边界条件和验证步骤。[Skill 编写最佳实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

在扩充 Skill 前，先观察没有 Skill 时 Agent 在代表性任务中的具体失败，再用少量任务建立基线；优先写最少的必要指引，测试正例、相邻但不该触发的任务和失败输入，比较结果后再迭代。若要支持多个模型，也要在计划使用的模型上复核效果，避免假设同一段指引在所有模型上表现一致。[Skill 编写最佳实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)

## 5. 把 Skill 来源纳入信任边界

从 GitHub 载入的 Skill 是 Agent 指令，不是被动的文档附件。`.claude/skills/<skill-name>/SKILL.md` 会在 Session 启动时被扫描；若仓库接受外部贡献，贡献者可能新增或修改 Skill。平台不会先替团队逐项审阅它，Skill 内的 Bash、文件操作或网络相关指令可能影响 Agent 接下来使用的能力。因此只挂载可信仓库；接入外部仓库前审核整个 `.claude/skills`，并复查 Skill 引用的脚本与数据文件。[Skills for Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/skills)

同样，Workspace 上传的自定义 Skill 也应像代码变更一样审查。不要把密钥写进 Skill 或仓库；Agent 读取网页、Issue 或第三方工具输出时，仍可能受到提示注入影响。可用最小工具集、受限网络、最小权限凭证和高风险操作审批来限制影响范围；模型行为本身不是安全控制。[Managed Agents 安全边界](https://platform.claude.com/docs/en/managed-agents/secure-deployment-risks)

仓库 Skills 仅在 Session 启动时按挂载的 checkout 状态扫描。更新 `.claude/skills` 后需创建新 Session 才会加载新版本；若需要明确锁定或审计版本，选择并记录特定分支或提交，而不是只依赖默认分支的当前状态。[Skills for Claude Managed Agents](https://platform.claude.com/docs/en/managed-agents/skills)、[GitHub 接入](https://platform.claude.com/docs/en/managed-agents/github)

## 练习：团队发布说明 Skill

团队希望 Agent 根据仓库提交与已审核的产品资料撰写发布说明。请决定 Skill 应放在 Workspace 还是仓库中，写出触发描述和流程大纲，并列出上线前的检查。

**参考答案：** 如果该流程只适用于单一仓库且需要随代码审查，可放进仓库根目录 `.claude/skills/release-notes/SKILL.md`；如果多个仓库共享并由平台团队统一发布，可上传 Workspace Skill，并通过 Agent `skills` 数组固定版本。描述应同时提到“生成发布说明”和“收到发布说明、版本摘要或发布整理任务时使用”。流程应先读取可信变更记录与产品资料，区分已确认事实和推断，按模板起草并核对链接；未经授权不应创建 Release 或发布外部内容。检查 Skill 中引用的文件路径、脚本和网络行为；测试匹配的发布任务、不匹配的一般摘要任务，以及包含恶意指令的提交说明；检查产出是否可追溯，再固定版本或固定仓库 checkout。

## 本课结论

Managed Agents Skills 通过简短元数据发现任务，按需加载步骤和附属资源，从而复用领域知识。Workspace Skill 便于集中复用和版本管理；GitHub Skill 便于与项目状态一起审查和发布。Skill 扩展的是 Agent 的工作方法，执行能力仍由工具、环境和权限决定；技能来源、脚本和触发范围都应纳入安全评审。

## 范围与时效

- 官方文档核对日期：2026-11-10；Managed Agents 与 Skills 当时均标为 Beta。
- Skills 数量、平台支持、Beta Header、API 字段及 GitHub 扫描行为可能调整；实施时按目标产品当前文档复核。
- 当前课程聚焦 Managed Agents。Agent Skills 在 Messages API、Claude Code 和 claude.ai 等产品中的装载方式不同，应分别查阅相应文档。
