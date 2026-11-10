# 第 42 课：Managed Agents 如何挂载 GitHub 仓库并协作改动？

**目标：** 能将 GitHub 仓库挂载到 Session 沙箱，选择工作分支或提交版本，理解本地仓库资源与 GitHub MCP 工具的分工，并管理令牌权限和运行中轮换。

## 本课问题

Managed Agents 如何让 Agent 读取项目文件并把改动推送回 GitHub？Session 挂载仓库和 GitHub MCP 工具分别提供什么能力？仓库 URL、`checkout` 与授权令牌该怎样配置和管理？

## 官方资料

- [Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)：仓库挂载、GitHub MCP、Session `resources`、Token 权限、缓存和 Pull Request 工作流。
- [Managed Agents MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)：Agent 中声明 MCP Server 与 Toolset。
- [第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 36 课：Managed Agents Skills](../s36_managed_agent_skills/README.md)、[第 39 课：Vault 凭证](../s39_managed_agent_vault_credentials/README.md)、[第 40 课：Managed Agents MCP 连接](../s40_managed_agents_mcp_connector/README.md)。

核对日期：2026-11-11。GitHub access 当前为 Beta，使用 managed-agents-2026-04-01 Header；官方页面注明 Managed Agents 不符合 ZDR 和 HIPAA 资格。仓库资源字段、平台支持、MCP 工具能力和令牌权限可能变化，实施前要按目标平台核对最新资料。

## 1. 仓库挂载与 GitHub MCP 是两个相关资源

GitHub repository resource 把选定的仓库克隆到 Session 沙箱中，让 Agent 的文件和 Shell 工具能访问工作树。Agent 定义中的 GitHub MCP Server 则提供远程 GitHub 操作能力，例如创建分支、提交、推送和发起 Pull Request。Session 可以同时挂载仓库并启用 GitHub MCP，但两者不是同一个配置字段，也不应把文件访问与远程 API 权限混为一谈。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)、[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)

~~~text
Agent 定义
  └── github MCP Server + mcp_toolset
          └── GitHub API 工具

Session 创建
  └── github_repository resource
          └── 仓库克隆到 Sandbox 的 mount_path
               ├── Agent 读写工作树
               └── 需要时通过 GitHub MCP 创建远端变更
~~~

GitHub 示例中，Agent 定义保存 MCP Server URL，不包含认证 Token；Session 资源另行提供仓库授权令牌。官方将该令牌说明为克隆仓库和向仓库推送所用的凭据。不要仅凭 Agent 能读仓库就推断它已经能执行远端 GitHub 操作。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)

## 2. 在 Session `resources` 中指定仓库和 `checkout`

仓库 URL 必须是 https://github.com/<owner>/<repo> 形式，不要附加 `.git`；SSH URL 等格式会因 `invalid_request_error` 被拒绝。挂载点可以选择 /workspace 下的目录；未指定时使用 /workspace/<`repo-name`>。`checkout` 可指定分支或 commit；省略时使用仓库默认分支。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)

~~~python
session = client.beta.sessions.create(
    agent=agent.id,
    environment_id=environment.id,
    resources=[
        {
            "type": "github_repository",
            "url": "https://github.com/example-org/sample-app",
            "mount_path": "/workspace/sample-app",
            "checkout": {
                "type": "commit",
                "sha": commit_sha,
            },
            "authorization_token": github_token_from_secret_store,
        },
    ],
)
~~~

上例中的授权令牌应由应用服务从安全凭证库读取后传入；不要把个人访问令牌写进 Agent 指令、仓库示例、源代码或日志。固定 commit 可以让 Session 使用可审计的代码快照；若要处理分支上的最新代码，应明确选择对应分支并记录实际 `checkout`。

可以在 `resources` 数组中挂载多个仓库，每项资源使用各自的 URL 和 `mount_path`。Session 建立后，挂载资源会一直附属于该 Session；如需换仓库或改变挂载列表，应创建新 Session。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)

## 3. 区分缺令牌、私有仓库与推送权限

`authorization_token` 是可选字段，且不会在 API 响应中回显：

| 情况 | 文档描述的结果 |
| --- | --- |
| 私有仓库未提供令牌 | Session 可能已创建，但仓库克隆在之后失败。 |
| 公开仓库未提供令牌 | 可以克隆，也可以在 Session 的本地副本提交；不能 `git push` 回远端。 |
| 令牌存在但权限不足 | 克隆、推送或 GitHub API 工具可能无法完成所需操作。 |

官方建议使用最小权限的 fine-grained personal access token，避免覆盖整个 GitHub 账户的宽权限 Token。文档列出的传统 scope 需求包括：克隆私有仓库和创建 PR 需要 `repo`；读取或创建 Issue 时，私有仓库需要 `repo`，公开仓库可用 `public_repo`。按实际任务选择权限，并在组织的 GitHub Token 策略下核对 fine-grained token 的等效权限。[Accessing GitHub: token permissions](https://platform.claude.com/docs/en/managed-agents/github)

GitHub MCP Server 的工具调用权限还要单独审核。仓库 resource 的 `authorization_token` 文档明确覆盖仓库克隆和推送；具体 MCP 工具及其授权方式应按 Server 的当前说明验证。将仓库挂载成功或令牌字段被接受，都不代表 Agent 获准执行任意 Issue、PR 或组织管理操作。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)、[Permission Policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 4. 运行中轮换资源令牌

创建 Session 后，应用可以列出资源并取得 repository resource 的 ID，再通过该 ID 更新 `authorization_token`。API 响应不回显 Token；应用应从自己的安全凭证来源读取新值，而不是尝试从历史响应找回旧值。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)

~~~python
resources = client.beta.sessions.resources.list(session.id)
repository_resource_id = resources.data[0].id

client.beta.sessions.resources.update(
    repository_resource_id,
    session_id=session.id,
    authorization_token=rotated_github_token,
)
~~~

仓库资源在 Session 生命周期内保持挂载，能轮换令牌，但不能通过资源更新改变 Session 挂载的仓库集合。需要新增或替换仓库时，创建新 Session，再传入所需 `resources`。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)

## 5. 版本固定、缓存与仓库 Skills

官方说明 GitHub 仓库会缓存，因此后续 Session 使用同一个仓库时可能启动更快。缓存是启动优化，不应替代显式版本选择；需要复现代码审查时，`checkout` 固定 commit 并记录资源 URL、提交 SHA 和 Session ID。

仓库根目录中的 `.claude/skills` 也会随仓库挂载被发现，但只在 Session 启动时扫描，并根据启动时 `checkout` 的仓库状态加载。更新这些 Skills 后应启动新 Session；Skill 文件、引用的脚本和仓库代码都需要按第 36 课的方法审查来源、版本和执行边界。[Accessing GitHub](https://platform.claude.com/docs/en/managed-agents/github)、[第 36 课：Managed Agents Skills](../s36_managed_agent_skills/README.md)

## 练习：为一次性代码审查挂载仓库

代码审查 Agent 要检查某个私有仓库中的固定提交，生成分支、提交修复并通过 GitHub MCP 发起 PR。请说明 Agent 与 Session 各自需要的配置，令牌放置位置，以及如何让审查结果可复现并在权限失败时排查。

**参考答案：** Agent 中声明 GitHub MCP Server 和匹配 Toolset，按任务只开放必要工具。创建 Session 时传入 HTTPS 仓库 URL、`mount_path`、目标 commit SHA 和由服务端安全凭证库取得的最小权限 GitHub Token。检查私有仓库克隆权限及推送/创建 PR 所需权限，并依据 Server 文档验证 GitHub MCP 操作所需的认证。记录 Agent 版本、仓库 URL、`checkout` SHA 与 Session ID。若 Session 创建成功但仓库不可用，先检查资源克隆状态及 Token 是否有效；若本地可提交但推送失败，检查 Token 的推送权限；若 MCP 工具失败，单独检查 Toolset、调用策略和该 Server 的授权。需替换仓库时创建新 Session；只轮换 Token 时可用资源 ID 更新。

## 本课结论

GitHub access 由 Session repository resource 提供沙箱内仓库副本，GitHub MCP 则提供远程 GitHub 工具。以 Session 资源选择仓库、挂载路径和分支或提交版本；用最小权限 Token 处理私有仓库克隆与推送，并通过资源 ID 轮换令牌。要复现工作状态，应记录 Agent、`checkout` 和 Session；不能把缓存、挂载成功或本地提交误当成远端权限已就绪。

## 范围与时效

- 官方资料核对日期：2026-11-11；GitHub access 当时为 Beta。
- 仓库缓存、`checkout` 支持、资源更新方式、MCP 工具和 Token 权限可能变化；按目标 GitHub 组织策略与 Anthropic 当前文档复核。
- MCP Server 声明与工具 allowlist 见第 40 课；Session Vault 与第三方凭证见第 39 课；GitHub 仓库 Skills 的加载行为见第 36 课。
