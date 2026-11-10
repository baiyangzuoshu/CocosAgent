# 第 39 课：Claude Managed Agents Vaults 如何按 Session 管理第三方凭证？

**目标：** 能区分 Workspace 级 Vault 与 Session 级凭证引用，按 MCP OAuth、固定 Bearer Token 或环境变量选择 Credential 类型，限制凭证的出站范围，并管理轮换、失效与撤销。

## 本课问题

怎样让每个用户的 Session 使用自己授权的第三方账户，而不把 Token 放进 Agent 指令或每次对话？Vault 是否自动按终端用户隔离？环境变量凭证怎样在 Agent 看不到明文的前提下发出请求，又有哪些客户端不适用？

## 官方资料

- [Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)：Vault、Credential 类型、Session 引用、注入位置、轮换、OAuth 校验和归档删除。
- [Secure your Managed Agents deployment](https://platform.claude.com/docs/en/managed-agents/secure-deployment)：凭证网络范围、注入位置、工作区隔离与最低权限建议。
- [Start a session](https://platform.claude.com/docs/en/managed-agents/sessions)：创建 Session 时用 vault_ids 引用凭证。
- [第 15 课：API Key、工作区和认证](../s15_api_keys_workspaces_auth/README.md)、[第 28 课：生产应用运营](../s28_production_operations/README.md)、[第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 34 课：Scheduled Deployments](../s34_scheduled_deployments/README.md)、[第 38 课：Permission Policies](../s38_managed_agent_permission_policies/README.md)。

核对日期：2026-11-10。Vaults 当前为 Beta，使用 managed-agents-2026-04-01 Header；官方页面注明 Managed Agents 不符合 ZDR 和 HIPAA 资格。Credential 类型、自托管支持、轮换行为与注入规则可能变化，实施前应核对目标平台的最新文档。

## 1. Vault 保存凭证，Session 决定本次运行能引用哪些凭证

Vault 是一组与用户或工作负载关联的第三方 Credentials。Vault 和 Credential 都属于 Workspace；创建 Vault 时可设置 display_name 和 metadata，便于把它映射到应用自己的用户记录。应用在创建 Session 时传入 vault_ids，使该 Session 能使用所选 Vault 中与目标服务相匹配的 Credential。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

~~~text
应用验证登录身份
        │
        ├── 查出该用户可用的 vault_id
        │
        └── 创建 Session，并只传入本任务需要的 vault_ids
                      │
                      ├── MCP 凭证按 mcp_server_url 匹配
                      └── 环境变量凭证按 secret_name 注入
~~~

**Workspace 作用域不等于终端用户授权。** 官方说明有 Workspace 访问权的 API Key 可以在创建 Session 时引用该 Workspace 的 Vault。由此可知，Vault ID 本身不能代替应用的用户身份检查。应用应先认证当前用户，再从服务端的授权映射中选出 Vault；不要让请求者任意提交一个 vault_id，也不要把一个用户的 Vault ID 广泛暴露给其他用户。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

## 2. 按第三方服务的认证方式选择 Credential 类型

| Credential 类型 | 凭证匹配与使用方式 | 适合情况 | 边界 |
| --- | --- | --- | --- |
| MCP OAuth | 用 mcp_server_url 对应 MCP Server；Session 连接时自动注入 Access Token。可登记 Refresh Token 和 Token Endpoint。 | 每位用户使用自己的 MCP 授权账户。 | 如果有 refresh 配置，Anthropic 可在 Access Token 过期时刷新；refresh.token_endpoint 创建后不能更换。 |
| 固定 Bearer Token | 也按 mcp_server_url 对应 MCP Server，注入固定的 Bearer Token。 | MCP Server 使用个人访问令牌或固定 API Token。 | 不会自动刷新；轮换时由应用更新。 |
| Environment Variable | 按 secret_name 提供 sandbox 中的环境变量；真实值只在允许的出站请求处替换。 | CLI、SDK 或直接 API 客户端从环境变量读取密钥。 | 客户端必须将该值原样放入允许的位置；不适用于需要本地签名或先兑换另一枚 Token 的流程。 |

MCP OAuth 的 Refresh Token、Access Token、Client Secret、固定 Bearer Token 和 Environment Variable 的 secret_value 都是敏感的只写字段，API 响应不会返回真实值。需要再次输入新值时，使用自己的安全凭证来源，不要尝试从 Retrieve Credential 响应中恢复明文。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

## 3. Environment Variable 是出口注入，不是把明文放进沙箱

Environment Variable Credential 在 Session 沙箱中以不透明占位符出现。Managed Agents 在允许的出站请求到达网络出口时，才把占位符替换成真实值；运行 Agent 的代码和模型看到的是占位符，而不是密钥本身。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

凭证有两道独立的出口限制：

| 控制面 | 具体字段 | 限制什么 |
| --- | --- | --- |
| Credential 网络范围 | networking.type 与 allowed_hosts | 哪些目标主机可以拿到替换后的密钥。 |
| 注入位置 | injection_location.header 与 injection_location.body | 密钥可以在出站请求的 Header、Body 或两者中被替换。 |
| Environment 网络范围 | Environment 的 networking 与 allowed_hosts | Sandbox 整体可以连接哪些主机。 |

Credential 的 allowed_hosts 不会替 Environment 开通网络主机；目标主机必须同时被 Environment 和 Credential 网络规则允许。安全指南建议从有限主机列表开始。对通常放在请求 Header 的 API Key，显式使用只开放 Header 的 injection_location，例如 header=true、body=false；不要依赖创建 Credential 时的隐式默认值。[Secure your Managed Agents deployment](https://platform.claude.com/docs/en/managed-agents/secure-deployment)

创建时如果完全省略 injection_location，Header 和 Body 注入都会启用；提供该对象时，未写字段默认关闭。例如只设 header=true 会得到 Header-only。更新时则按字段合并：只传 body=false 会保持原有 Header 设置。要收窄权限，应显式检查完整配置，并在修改前理解当前值。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

这种替换只发生在出口，不会让本地进程拿到真正的密钥。因而依赖真实密钥做本地格式校验或计算请求签名的客户端可能失败；若客户端用静态 Key 兑换 Session Token，兑换回来的 Token 会未经遮蔽地返回沙箱。官方建议应用自己执行这类兑换流程，然后把可直接使用的 Token 存入 Vault。环境变量凭证目前也不支持 Self-hosted Sandbox；如需自托管的同等行为，要由自己的受控 Proxy 完成替换并承担其安全边界。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

## 4. 只给 Session 传当前用户需要的 Vault

创建 Session 时用 vault_ids 提供应用经过身份校验后选出的 Vault ID：

~~~python
session = client.beta.sessions.create(
    agent=agent.id,
    environment_id=environment.id,
    vault_ids=[authenticated_user_vault_id],
    title="User workspace task",
)
~~~

如果 Agent 声明了需要认证的 MCP Server，运行时会用 mcp_server_url 匹配 Credential。没有匹配 Credential 时会尝试无认证连接；如果 Server 需要认证，连接会失败。若多个传入 Vault 含有同一 MCP Server 的匹配 Credential，则第一个匹配项优先，因此避免在一次 Session 中传入冲突的同 URL 凭证。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

在多 Agent Session 中，传入的 Vault Credential 对所有 Thread 生效。实际使用时，只有声明了对应 MCP Server 的 Agent 才会匹配该 Credential，但这不是 Thread 级别的凭证隔离。不要把不同信任等级或不同终端用户的工作放进共用 Vault 列表的 Session；每个 Session 只传入有权服务当前任务的凭证。

## 5. 轮换、诊断与撤销凭证

创建 Credential 时，服务端不会先验证它能否连上目标服务；无效凭证可能直到 Session 运行时才以认证或下游错误暴露。API 会话仍可继续，因此应用应监控目标服务认证结果，不能把“Credential 创建成功”当成“OAuth 授权有效”。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

对 OAuth 凭证，可通过 MCP OAuth validation endpoint 检查刷新故障：

| 校验状态 | 通常如何处理 |
| --- | --- |
| valid | Token 可用，继续运行。 |
| invalid | Grant 已撤销或 OAuth Server 拒绝；要求用户重新授权。 |
| unknown | 临时网络、限流或服务器错误；等待后重试。 |

刷新失败会产生 vault_credential.refresh_failed 事件。OAuth Credential 的结构字段（如 MCP URL、Token Endpoint、Client ID）创建后锁定；若要更换这些结构信息，应归档旧 Credential 并创建新项。Secret 本身可以轮换；Credential 生命周期会重新解析，正在运行的 Session 无需重启即可在后续请求中使用已轮换的凭证。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

每个 Vault 最多容纳 20 个 Credentials；同一 Vault 内，活动 MCP Credential 的 MCP Server URL、活动环境变量 Credential 的 Secret Name 必须唯一。归档 Credential 会清除 Secret 并释放对应键值，之后可用同一 URL 或 Secret Name 创建替代项。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

归档 Vault 会连带归档其中的 Credentials、清除 Secret 内容并保留审计记录，新的 Session 不能继续引用该 Vault；正在运行的 Session 会继续存在，但后续需要凭证的调用会受到撤销影响。删除是硬删除，不保留记录。单独归档 Credential 会清除 Secret，同时保留该 Credential 的键并释放它供新 Credential 使用。按审计需要选择归档或硬删除，并将授权撤销、Session 停止与应用侧用户注销分别处理。[Authenticate with vaults](https://platform.claude.com/docs/en/managed-agents/vaults)

## 6. 不要把 Claude API 密钥交给 Agent 沙箱

Vault 用来向 Agent 访问的第三方服务注入必要凭证；不要将 Claude API Key 或 Claude API Access Token 放进 Agent 可用 Vault。Agent 沙箱代码可以使用它们直接调用 Claude API，执行凭证本身允许的工作；Toolset、Permission Policy 和 Session Budget 不会替 Claude API Key 限制其权限。[Secure your Managed Agents deployment](https://platform.claude.com/docs/en/managed-agents/secure-deployment)

优先让应用服务器保管 Claude API 凭证，由应用执行自定义工具或代理请求；如果业务必须将第三方 Credential 暴露给 Session，则同时限制 Workspace、Vault ID 映射、Credential allowed_hosts、Environment allowed_hosts、注入位置与第三方服务自身的 Token scope。环境侧联网允许访问主机，也不代表该服务端点的读写操作已经按业务授权。

## 练习：为个人日历摘要连接 MCP Server

一款应用为每个已登录用户生成个人日历摘要。用户通过 OAuth 授权 Calendar MCP Server；其中某些自动化 Session 还需请求一个只读 Calendar API Key。请说明 Vault 怎样映射用户，Session 如何选 Vault，各种凭证放在哪里，以及怎样处理 Token 过期、注销与自托管限制。

**参考答案：** 用户完成身份认证和 OAuth 授权后，服务端建立或更新其 Vault，并把外部用户 ID 与 vault_id 保存在受保护的应用数据库里；创建 Session 时只传入该已认证用户对应的 vault_id。Calendar MCP OAuth Credential 按准确的 MCP Server URL 保存 Access Token 和可用的 Refresh Token；需要 API Key 的读取任务可使用独立 Environment Variable Credential，设置有限的 Credential 和 Environment 出站主机列表，并且只允许在 Header 中注入。应用监听刷新失败并根据 validation 状态区分重授权与暂时重试。用户注销或撤销授权时，服务端归档或删除相应 Credential / Vault，并防止后续 Session 再引用。环境变量凭证目前不适用于 Self-hosted Sandbox，因此需要改用本方受控代理方案或采用另一种经审核的环境设计。

## 本课结论

Vault 为 Workspace 内的第三方秘密提供可引用、可轮换的凭证记录；Session 选择本次可用的 Vault。安全设计要在应用侧绑定用户身份，在 Credential 与 Environment 两个网络控制面同时限制出口，并检查出站注入位置、OAuth 刷新、归档撤销和 Self-hosted 支持范围。Vault 能降低明文进入对话和沙箱的机会，但不会代替用户授权、第三方 Token 限权或业务执行门禁。

## 范围与时效

- 官方文档核对日期：2026-11-10；Vaults 当时为 Beta。
- Environment Variable 对自托管的支持、注入默认值、MCP URL 匹配和 Credential 生命周期可能变化；以目标部署平台当前资料为准。
- Agent、Environment 与 Session 的基本关系见第32课；Permission Policy 与工具调用确认见第38课。
