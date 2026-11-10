# 第 43 课：Managed Agents 如何把文件装入 Session 并取回输出？

**目标：** 能用 Files API 上传输入文件并挂载到 Session 沙箱，管理运行中 Session 文件资源，按 Session 范围列出和下载 Agent 输出，并理解文件 ID、路径、留存和异步可见性边界。

## 本课问题

怎样把上传的文件交给 Agent 在沙箱中读取？Session 挂载副本与 Workspace 文件是什么关系？Agent 写出的结果又如何按 Session 安全列出并下载？

## 官方资料

- [Adding files](https://platform.claude.com/docs/en/managed-agents/files)：Files API 上传、Session resource 挂载与管理、路径、输出列出和下载。
- [Files API](https://platform.claude.com/docs/en/build-with-claude/files)：Workspace 文件的创建、管理和生命周期。
- [第 22 课：Messages API 多模态与 Files API](../s22_multimodal_inputs/README.md)、[第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 37 课：Managed Agents Outcomes](../s37_managed_agent_outcomes/README.md)、[第 42 课：GitHub 仓库挂载](../s42_managed_agents_github_access/README.md)。

核对日期：2026-11-11。Managed Agents 文件挂载当前为 Beta，使用 `managed-agents-2026-04-01` Header；官方页面注明该产品不符合 ZDR 和 HIPAA 资格。文件限制、SDK 调用、保留方式和平台支持会变化，实施前应核对目标平台最新文档。

## 1. 上传文件，再把它挂载到 Session

输入文件先通过 Files API 上传到 Workspace，再以 file resource 加入 Session 的 `resources`。挂载路径以 Session 的 uploads 目录为根；例如 `mount_path` 写为 `/data.csv` 后，沙箱中的完整路径是 `/mnt/session/uploads/data.csv`。[Adding files](https://platform.claude.com/docs/en/managed-agents/files)

~~~python
from pathlib import Path

uploaded = client.files.upload(file=Path("data.csv"))

session = client.beta.sessions.create(
    agent=agent.id,
    environment_id=environment.id,
    resources=[
        {
            "type": "file",
            "file_id": uploaded.id,
            "mount_path": "/data.csv",
        },
    ],
)
~~~

如果省略 `mount_path`，文件会使用 `file_id` 作为 uploads 目录下的路径名；路径应以 / 开头，父目录会自动创建。一个 Session 最多支持 500 个文件资源。挂载会在 Session 中创建引用该文件实例的新 `file_id`；官方说明这些 Session 副本不计入 Workspace 存储限制。[Adding files](https://platform.claude.com/docs/en/managed-agents/files)

## 2. Workspace 文件和 Session 副本不是同一作用域

| 对象 | 作用域 | 本课如何使用 |
| --- | --- | --- |
| Files API 上传文件 | Workspace | 上传后得到原始 `file_id`；应用可按自身用户权限映射并维护。 |
| Session file resource | Session | 引用上传文件并挂载到沙箱路径；资源 ID 用于在该 Session 中管理挂载。 |
| Agent 输出文件 | Session | 写入约定的输出目录后，按 Session `scope_id` 列出并下载。 |

Workspace 中的 `file_id` 不会自动成为某位终端用户的授权凭证。复用第 22 课的边界：由服务端校验当前用户有权使用哪个文件 ID，不要信任客户端直接提交的任意 `file_id`。为不同用户处理数据时，应用要负责将用户身份、允许的 Workspace 文件和 Session resource 关联起来。[Files API](https://platform.claude.com/docs/en/build-with-claude/files)、[第 22 课](../s22_multimodal_inputs/README.md)

Session resource API 可以在会话运行期间增删文件。添加会得到一个 resource ID；先列出现有 `resources`，再用指定 resource ID 删除挂载：

~~~python
resource = client.beta.sessions.resources.add(
    session.id,
    type="file",
    file_id=uploaded.id,
)

listed = client.beta.sessions.resources.list(session.id)
for entry in listed.data:
    print(entry.id, entry.type)

client.beta.sessions.resources.delete(resource.id, session_id=session.id)
~~~

删除操作作用于 Session resource。若还要删除 Workspace 中的原始上传文件或设置其过期时间，应按 Files API 的文件生命周期另行处理；不要把解除挂载等同于原始文件已删除。

**生命周期判断：** 删除资源 API 处理的是 Session resource；Workspace 原始上传文件有自己的 Files API 生命周期。若要删除原文件，也应单独调用 Files API 的文件删除流程。

## 3. 选择 Agent 能处理的文件形态

Managed Agents 可以挂载源代码、CSV、JSON、文本、压缩包和二进制文件。文件被挂载并不代表 Claude 会自动理解任意二进制格式：应根据内容选择适当工具。文本和代码可由文件工具读取；压缩包可通过 Bash 解压；其他二进制内容可能需要专用解析器或自定义工具。[Adding files](https://platform.claude.com/docs/en/managed-agents/files)、[Tools](https://platform.claude.com/docs/en/managed-agents/tools)

对外部文件，应在传入 Session 前决定应用是否允许该 Agent 读取或处理它。文件名、文档内容和压缩包中的指令都属于不可信输入；它们不会因为挂载到沙箱就自动变成更高优先级的授权指令。仍需按第 27 课的方法考虑提示注入、外部代码运行和输出审核风险。[第 27 课：工具权限与提示注入](../s27_tool_security_prompt_injection/README.md)

## 4. 输出写入 outputs，再按 Session 下载

让 Agent 将要交付的文件写入 `/mnt/session/outputs/`。应用可通过 Files API 使用 `scope_id=session.id` 查询该 Session 的输出，再按文件 ID 下载：

~~~python
files = client.beta.files.list(
    scope_id=session.id,
    betas=["managed-agents-2026-04-01"],
)

for item in files.data:
    print(item.id, item.filename)

download = client.files.download(files.data[0].id)
download.write_to_file("result.txt")
~~~

`scope_id` 筛选需要 `managed-agents-2026-04-01` Beta Header。只查 Session scope 可避免将 Workspace 中其他文件与这次任务的产物混在一起；下载前仍应确认该 Session 属于当前已认证的用户或工作负载。[Adding files](https://platform.claude.com/docs/en/managed-agents/files)

Agent 写完文件后，输出可能在 Session 进入 idle 的几秒之后才出现在 Files API 列表中。若预期文件暂时没出现，短暂等待后重新列出；一旦文件出现在列表中，上传已完成。一次查询没找到文件不能直接证明 Agent 未生成产物，也不能只依据 Session idle 状态通知用户下载已经就绪。

## 5. 区分挂载、删除、下载与留存

| 操作 | 影响对象 | 应核对什么 |
| --- | --- | --- |
| 创建 file resource | 当前 Session 的沙箱文件实例 | `file_id`、`mount_path`、用户授权和文件数量上限。 |
| 删除 resource ID | 当前 Session 中的挂载关系 | 需要时另行处理 Workspace 原始上传文件。 |
| 删除 Files API 文件 | Workspace 中的文件记录 | 其他 Session 或任务是否仍要复用该 `file_id`。 |
| 下载 Session 输出 | 由 Files API 返回的文件内容 | Session 归属、输出名、业务验收及应用侧保存位置。 |

文件挂载提高 Agent 处理材料的便利性，但 Session 对文件的读取能力由工具和运行环境共同决定。输入、Session 沙箱副本、Agent 输出与 Workspace 原始上传文件可能有不同的生命周期；应用应分别记录它们的 ID 与归属，并遵循组织的数据留存和删除政策。[Adding files](https://platform.claude.com/docs/en/managed-agents/files)、[Files API](https://platform.claude.com/docs/en/build-with-claude/files)

## 练习：总结合同并保存审阅结果

一个用户上传合同 PDF，Agent 要提取主要义务并生成 `summary.md` 和 `risks.csv`。请说明应用怎样选择并挂载输入文件、Agent 如何放置输出、应用怎样下载结果，以及怎样避免把其他用户文件混入 Session。

**参考答案：** 服务端先确认用户有权处理该合同，再从受控映射中取到其 Workspace `file_id`；创建 Session 时添加 `type` 字段为 `file` 的资源，并指定如 `/contract.pdf` 的绝对挂载路径。Agent 读取 `/mnt/session/uploads/contract.pdf`，经合适工具解析后把两个交付文件写入 `/mnt/session/outputs/`。Session idle 后按 `scope_id=session.id` 查询；若文件刚写完暂未出现，稍等后重试。文件出现在列表后下载并分别核对 `filename`、Session 归属和内容。输入与输出的 IDs 由应用维护；删除 Session resource 不要误当成原始 Workspace 文件已被删除。

## 本课结论

Managed Agents 文件流程包含 Workspace 上传、Session 挂载、沙箱处理和 Session 输出下载四个环节。Session resource ID 用于增删会话内挂载；Files API `file_id` 关联源文件或可下载产物。按 Session 范围查询输出、维护应用侧文件授权映射，并区分解除挂载与文件删除，能降低跨用户混用和误删风险。

## 范围与时效

- 官方资料核对日期：2026-11-11；Managed Agents 文件资源当时为 Beta。
- 每 Session 500 个文件、Session 输出路径、Files API Beta Header 和异步可见时间可能变化；以目标平台当前文档为准。
- Messages API 文件输入见第 22 课；Outcome 交付产物见第 37 课；GitHub 仓库资源见第 42 课。
