# 第 40 课：Managed Agents 如何把 MCP Server 注册为可控工具？

**目标：** 能区分 Agent 中的 MCP Server 声明、MCP Toolset 与 Session 凭证引用，按需启用远程工具，并处理网络限制、认证失败和连接重试。

## 本课问题

Managed Agents 怎样连接远程 MCP Server？为什么 Agent 里既要声明 Server 又要添加 Toolset？如何限制 Agent 可见的工具，并在每个 Session 中提供适当认证？

## 官方资料

- [MCP connector for Managed Agents](https://platform.claude.com/docs/en/managed-agents/mcp-connector)：Server 声明、Toolset 配置、Session 认证、连接失败。
- [Managed Agents reference](https://platform.claude.com/docs/en/managed-agents/reference)：支持的 MCP Server 传输及事件类型。
- [MCP tunnels](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/overview)：连接私有网络内的 MCP Server 及其预览阶段边界。
- [第 31 课：Messages API MCP Connector](../s31_mcp_connector/README.md)、[第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 38 课：Permission Policies](../s38_managed_agent_permission_policies/README.md)、[第 39 课：Vault 凭证](../s39_managed_agent_vault_credentials/README.md)。

核对日期：2026-11-11。Managed Agents 当前为 Beta，使用 managed-agents-2026-04-01 Header；官方页面注明该产品不符合 ZDR 和 HIPAA 资格。Server 支持、Toolset 配置、事件与传输方式可能变化，实施前应按目标平台核对最新文档。

## 1. Agent 声明连接，Session 提供认证

Managed Agents 的 MCP 连接分为两个配置阶段：

| 阶段 | 配置什么 | 边界 |
| --- | --- | --- |
| Agent 创建或版本更新 | MCP Server 名称、URL，以及与 Server 对应的 Toolset 和工具开关。 | 可复用 Agent 定义不应包含用户 OAuth Token 或长期密钥。 |
| Session 创建 | 通过 `vault_ids` 引用 Vault，为已声明的 MCP Server 提供认证凭证。 | 应用按已认证用户或工作负载挑选有权使用的 Vault。 |

这种分层允许多个 Session 重用同一 Agent 配置，同时使用各自授权的第三方账户。Messages API MCP Connector 则在 Messages 请求中提供 Server 和 Toolset 配置；Managed Agents 使用版本化 Agent 配置并在 Session 侧引用 Vault。两种 API 的配置位置和生命周期不同，不能直接互换。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)、[第 31 课](../s31_mcp_connector/README.md)

## 2. Server 与 Toolset 必须成对声明

每个 Agent 的 `mcp_servers` 项都要提供 `type`、`name` 和 `url`。当前 `type` 必须为 `url`；`name` 在该 Agent 内唯一，长度为 1–255 个字符；URL 最长 2,048 个字符。一个 Agent 最多声明 20 个 MCP Server。每项 Server 必须被一个 Toolset 引用，每项 MCP Toolset 也必须指向已声明的 Server；缺少配对时 API 会拒绝 Agent 定义。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)

~~~yaml
mcp_servers:
  - type: url
    name: tickets
    url: https://mcp.example.com/

tools:
  - type: mcp_toolset
    mcp_server_name: tickets
    default_config:
      enabled: false
    configs:
      - name: search_tickets
        enabled: true
      - name: get_ticket
        enabled: true
~~~

这里的 tickets 名称必须同时出现在 `mcp_servers.name` 与 `mcp_toolset.mcp_server_name`。Server 报告的工具名称写在 `configs.name` 中，不要添加工具条目没有的 `type` 字段。Agent 配置还可以同时包含 Agent 内置工具集；上例只展示 MCP 连接相关部分。

## 3. 默认关闭 MCP 工具，再开放本任务所需项

如果不指定工具配置，Server 暴露的所有 MCP 工具默认都会启用。Server 后续增加的新工具也可能因此对 Agent 可用。对于具有写入或外部副作用的 Server，建议把 `default_config.enabled` 设为 false，再在 `configs` 中明确启用只读、当前任务需要的工具。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)

若确实需要默认启用大多数工具，也可只用 `configs` 禁用个别工具，将 `enabled` 设为 false。但这属于排除列表：新工具可能仍然默认启用。逐项 allowlist 更适合需要审查 Server 工具变更、或只允许 Agent 执行有限动作的情况。

工具开关与调用审批是两种控制：

| 配置 | 控制什么 | 关联课程 |
| --- | --- | --- |
| `enabled` | Agent 是否能使用某个 MCP 工具。 | 本课 |
| `permission_policy` | 工具被调用时自动执行、等待确认或由服务端评估。 | 第 38 课 |
| Vault 中的第三方凭证与 Server 权限 | Server 能以什么账户、访问哪些业务数据或执行哪些操作。 | 第 39 课 |
| Environment 网络规则 | Session 沙箱可以连接哪些网络主机。 | 第 32、39 课 |

不要把开启 Toolset 理解为用户授权，也不要把权限策略视为网络隔离或第三方数据权限的替代品。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 4. 在 Session 绑定 Vault，并核对网络主机

启动 Session 时传入应用根据已认证用户选出的 `vault_ids`：

~~~python
session = client.beta.sessions.create(
    agent=agent.id,
    environment_id=environment.id,
    vault_ids=[authorized_user_vault_id],
)
~~~

Vault 中的 MCP OAuth 或 `static_bearer` Credential 按 Server URL 匹配。匹配时平台会把 `scheme` 和 `host` 转为小写，并移除默认端口与尾部斜线；URL 的 `path`、子域名或非默认端口不同仍然视为不同 Server。若没有匹配 Credential，平台会尝试不带认证连接；需要认证的 Server 会在运行时拒绝该请求。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)、[Vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

对于 `limited` Environment，Session 创建时会检查每个声明 Server 的主机是否在 `networking.allowed_hosts` 中。未通过检查时 Session 创建以 HTTP 400 失败。Environment 将 `allow_mcp_servers` 设为 true 会关闭这项 MCP Server 主机检查；只有理解该例外并落实所需网络限制后才考虑使用。主机允许列表只决定连接范围，不代表 Server 的 OAuth 身份或工具权限已正确设置。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)

## 5. 区分网络、认证失败并监控重试

Managed Agents 支持使用 HTTP Endpoint 的远程 MCP Server；Server 应支持 Streamable HTTP。仅支持旧 SSE 传输的 Server 仍有自动兼容回退。私有网络内的 Server 可经 MCP tunnels 接入，但 MCP Tunnels 当前标为 research preview，服务承诺与持续性有限；隧道负责建立到内网 Server 的路由，不替代上游 MCP Server 自身的 OAuth 或 Bearer Token 认证。[Managed Agents reference](https://platform.claude.com/docs/en/managed-agents/reference)、[MCP tunnels](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/overview)

创建 Session 时不会验证 Server 是否在线或 Credential 是否有效；创建成功后，Session 仍可能无法使用该 Server。连接和认证错误会出现在 `session.error` 中，并包含受影响的 `mcp_server_name` 和 `retry_status`：

| 错误 | 典型原因 | 应用侧处理 |
| --- | --- | --- |
| `mcp_connection_failed_error` | 网络错误、超时或非认证类 HTTP 错误，Server 未能连通。 | 检查 URL、主机规则、Server 可用性和网络链路。 |
| `mcp_authentication_failed_error` | 凭证无效、缺少匹配凭证、OAuth 刷新失败或 Server 拒绝认证。 | 检查 Vault 与 URL 匹配；按需要更新凭证或让用户重新授权。 |

这些错误本身不会阻止 Session 继续交互。应用可选择阻断依赖此 Server 的后续操作、请求凭证轮换，或在用户知情的情况下允许 Session 继续完成不依赖 MCP 的工作。平台会在 Session 从 `session.status_idle` 转为 `session.status_running` 时重试连接；不要把 Session 创建成功当作 MCP 已可用。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)

当 MCP 工具输出超过 100,000 个字符时，平台会把完整结果写入沙箱文件；模型收到的内容是带文件路径的截断预览，可再读取完整结果。应用应按外部工具结果的信任边界处理内容；如果任务只需要摘要或少量匹配项，可让 MCP Server 缩小输出，避免读取不必要的完整结果。[MCP connector](https://platform.claude.com/docs/en/managed-agents/mcp-connector)

## 练习：只允许客服 Agent 查询工单

客服 Agent 要连接一个提供 `search_tickets`、`get_ticket`、`create_ticket` 和 `delete_ticket` 的 MCP Server。当前任务只允许查找和读取工单；只有管理员之后批准，才会增加写入动作。请写出 Agent 的 Server 与 Toolset 配置，说明 Session 认证及 Environment 主机检查，并列出连接失败时的排查顺序。

**参考答案：** 在 Agent 中声明唯一名称和准确 URL 的 MCP Server，并为它建立匹配的 Toolset。将 `default_config.enabled` 设为 false，只开启 `search_tickets` 与 `get_ticket`。不要把用户的 OAuth Token 写入 Agent 配置；服务端通过登录身份映射用户 Vault，并在 Session 创建时传入允许使用的 `vault_id`。确认 `limited` Environment 的 `allowed_hosts` 包含 MCP Server 主机。收到 `session.error` 后，按 `mcp_server_name` 区分 `mcp_connection_failed_error` 和 `mcp_authentication_failed_error`，分别检查网络链路或 Vault Credential/URL 匹配；在工具实际恢复前，不要把创建 Session 成功显示为连接可用。

## 本课结论

Managed Agents 用 Agent 配置声明 MCP Server 和允许使用的工具，用 Session 的 Vault 引用提供第三方认证。部署时应从工具 allowlist 开始，同时检查 Environment 主机限制、凭证 URL 匹配和 Server 认证；运行时监听 MCP 专属错误，区分网络故障与凭证问题。MCP 工具开关、调用审批、网络访问和业务授权各自控制不同边界。

## 范围与时效

- 官方资料核对日期：2026-11-11；Managed Agents 当时为 Beta，MCP Tunnels 为 research preview。
- MCP Server 上限、URL 匹配、默认工具开关、传输支持与错误重试规则可能变化；以目标平台最新文档为准。
- Messages API 的 MCP Connector 见第 31 课；Managed Agents Vault、调用策略和整体资源关系见第 32、38、39 课。
