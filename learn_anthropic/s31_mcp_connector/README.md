# 第 31 课：MCP Connector 如何把远程工具接入 Messages API？

**目标：** 能说明 Anthropic 的 MCP Connector 与应用自管 MCP 客户端的差异，了解远程服务器、工具集和响应块的关系，并核对 beta、权限与数据处理边界。

## 本课问题

MCP Connector 是否等同于“把整个 MCP 服务器交给 Claude”？本地 STDIO 服务器、MCP resources 和 prompts 能否直接通过 Messages API Connector 使用？应用还要承担哪些认证、安全和兼容工作？

## 官方资料

- [MCP Connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)：Messages API 远程服务器连接、工具集配置、响应块、beta、数据处理和 MCP SDK 辅助函数。
- [Tool use with Claude](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)：Claude 工具调用的通用概念与执行流程。
- [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)：API 功能的数据处理和留存范围。
- [MCP specification](https://modelcontextprotocol.io/)：MCP 协议自身的概念、传输与客户端/服务器约定。

核对日期：2026-11-10。MCP Connector 当前标记为 Beta；Messages API 所需 beta header、可用平台和数据处理资格可能变化，接入前要再次查看官方 Connector 页面。

## 1. 先分清 MCP、Connector 和客户端

MCP（Model Context Protocol）定义客户端如何连接提供上下文或工具的服务器。Claude Platform 的 MCP Connector 是一种具体的 API 集成方式：Messages API 可连接**远程 HTTP MCP server**，无需应用自己实现该连接的 MCP client。它不是把本地 MCP 进程自动暴露到 Claude，也不是让 Claude 获得宿主机或业务系统的全部权限。[MCP Connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)、[MCP specification](https://modelcontextprotocol.io/)

| 组件 | 在 Messages API Connector 中的作用 | 应用仍要负责什么 |
| --- | --- | --- |
| MCP server | 远程服务端，提供工具，并按自身身份与权限规则实际处理调用。 | 选择可信服务器、限定其服务器端权限和可访问数据。 |
| `mcp_servers` | 在请求中描述服务器 URL、名称和可选 OAuth `authorization_token`。 | 由应用取得和刷新 OAuth token；安全保存凭证并按用户/工作负载传递。 |
| `mcp_toolset` | 放在 Messages API 的 `tools` 中，按服务器名称匹配，设置默认工具开关和单工具配置。 | 只启用任务所需的工具；检查服务器工具变更及配置是否仍有效。 |
| Messages API Connector | 让 Claude API 直接连接远程 MCP server 并使用其中暴露的工具。 | 在应用流程中明确数据授权、可用平台、审批要求和响应解析。 |
| 应用自管 MCP client | 由应用自己建立 MCP 连接，再将 MCP 工具、提示或资源转换为 Claude API 可用的输入。 | 应用负责执行闭环，但可以在自己控制的流程中加入额外校验和审核步骤。 |

Connector 页面指出，Messages API 请求需同时传入 `mcp_servers` 和匹配的 `mcp_toolset`；而 Managed Agents 是在 Agent 定义中声明服务器，再由会话引用 Vault 中的凭证。不同产品的配置形态不能互换。[MCP Connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

## 2. Messages API 的远程 Connector 流程

```text
应用服务
  └─ Messages API 请求
       ├─ messages：用户内容和对话历史
       ├─ mcp_servers：远程服务器 URL、名称、认证 Token
       ├─ tools：匹配的 mcp_toolset 与工具配置
       └─ betas：当前文档要求的 MCP beta header
             ↓
       Claude API 连接远程 MCP server 并使用被启用的工具
             ↓
       Messages 响应包含 MCP 工具调用/结果块，应用解析并继续对话
```

当前文档中的服务器定义使用 HTTPS URL 和唯一 `name`；需要 OAuth 的服务器可在请求配置中传入 `authorization_token`。API 调用方负责先取得 token，并在需要时刷新。不要把 token 写进 system prompt、公开示例、客户端包或日志。[MCP Connector：server configuration 与 authentication](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

工具策略应从**最小 allowlist** 开始。Connector 文档说明，未设置工具配置时会启用 server 提供的所有工具；可以把 `default_config.enabled` 设为 `false`，再通过 `configs` 只打开指定工具。只保留读操作时，不要把创建、发送、删除或付款等工具一并开放。[MCP Connector：common configuration patterns](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

MCP server 必须通过公开 HTTP 暴露；当前支持 Streamable HTTP 和 SSE，不能从 Messages API Connector 直接连接本地 STDIO server。该 Connector 对 MCP 规范功能的支持目前限于 tool calls。若应用需要本地 STDIO、MCP prompts 或 resources，可由应用自管 MCP client，并使用 Anthropic SDK 提供的类型转换 helper；这时连接管理与工具执行流程回到应用侧。[MCP Connector：limitations 与 client-side helpers](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

## 3. 用类型解析响应，不按固定位置取块

Claude 使用 MCP 工具时，响应内容可能包含：

| 内容块 | 表示什么 | 解析要点 |
| --- | --- | --- |
| `mcp_tool_use` | 模型选择了某个 MCP 工具，并给出服务器名和输入参数。 | 按 `type` 识别工具块，不能把它当作普通文本。 |
| `mcp_tool_result` | MCP 工具执行结果，包括 `is_error` 和结果内容。 | 检查错误标志，并按来源信任边界处理结果。 |
| `mcp_tool_listing` | 在当前工具列表 pinning beta 下，Connector 返回服务器工具清单。 | 响应可能先出现该块；不要假设 `content[0]` 永远是文本或工具调用。 |

截至 2026-11-10，Claude API 的 Messages API MCP Connector 页面列出 `mcp-client-2025-11-20` 和 `mcp-client-2026-09-15` 两种可用 beta header。后一版本还可记录并 pin 服务器工具清单，使对话后续请求继续使用已记录的工具列表；该 pinning 功能在文档中标为 Claude API 可用。不同托管平台列出的 header 可能不同，需按目标平台查可用性表。若响应带有 `mcp_tool_listing`，应按文档把需要保留的 assistant 响应块原样带回后续请求，并继续发送相应 header；上线前再次确认当前版本要求。[MCP Connector：response content types 与 pin a tool list](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

MCP server 可以动态增加、删除或改名工具。工具列表变化可能导致以前有效的配置不再匹配；工具清单 pinning 是 beta 下的稳定性选项，不等于对服务器代码、权限或返回数据做了审计。

## 4. 选择 API Connector 还是应用自管客户端

| 需求 | 可先评估的方式 | 需要额外核对 |
| --- | --- | --- |
| MCP server 已有可公开访问的 HTTPS/SSE 或 Streamable HTTP 地址；只需让 Claude 使用所选工具 | Messages API MCP Connector | Beta 状态、支持平台、OAuth token、工具 allowlist、数据留存资格和响应块解析。 |
| MCP server 仅在开发者机器或内部网络使用 STDIO | 应用自管 MCP client | 应用到内部 server 的网络访问、隔离、认证与工具执行记录。 |
| 应用需要读取 MCP resources 或取得 MCP prompts | 应用自管 MCP client 与 SDK helper | 资源内容如何进入 Messages 输入、类型转换支持范围和数据处理规则。 |
| 写操作需要应用在执行前逐次暂停、授权或让用户确认 | 评估应用自管客户端或独立的服务端审批门 | 确认实际执行点确实等待审批；单纯启用/禁用工具的 allowlist 不等同于逐次人工审批。 |

**范围推论：** 当前 Connector 文档描述远程 server、工具开关和响应块，但没有说明 Messages API Connector 提供通用的逐次人工审批回调。由于 Connector 直接连接远程 MCP server，不能仅凭 allowlist 推断每次写操作都先返回给应用批准。对难以撤销的操作，应不暴露写工具，或在应用自管客户端/服务器端权限层实现真正的确认门；上线前按目标产品文档验证执行路径。[MCP Connector](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)、[第27课：工具权限与副作用](../s27_tool_security_prompt_injection/README.md)

## 5. 先确认数据处理资格，再连接服务器

截至本课核对日期，MCP Connector 页面把 `/v1/messages` 中使用 `mcp_servers` 的请求列为按标准数据处理政策保留，并标为**不符合 Zero Data Retention（ZDR）资格**与**不符合 HIPAA 资格**。若组织的要求依赖 ZDR 或 HIPAA 安排，先确认这个 Connector 是否适用；不能仅凭普通 Messages API 或组织级合同推断它也符合资格。[MCP Connector：data handling](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)、[API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

另外，远程 MCP server 会看到它为处理工具调用所需的请求数据和凭证。发送前确认 server 的运营方、数据权限、记录与删除政策；把 MCP 工具结果作为外部数据看待，并沿用第27课对提示注入和最小权限的处理方式。

## 练习：接入工单服务器

一个客服 Agent 需要查找工单并总结状态。之后产品团队还想让它创建新工单，但创建动作必须在用户确认后发生。服务器支持 HTTPS，提供 `search_tickets` 和 `create_ticket` 两项工具。请说明应如何选择连接方式、暴露工具、处理确认和检查数据处理条件。

**参考答案：** 若使用 Messages API MCP Connector，按 HTTPS URL 配置唯一 server 名称，再添加匹配的 `mcp_toolset`；将默认工具关闭，只 allowlist `search_tickets`。需要 OAuth 时，由应用安全地取得和刷新 token。不要假设 `create_ticket` 的工具开关会自动提供逐次审批；如果每次创建都要先由用户确认，就让应用在真正执行前控制写操作，或在服务器端强制确认策略。按 `type` 处理 `mcp_tool_use`、`mcp_tool_result` 和可能出现的 `mcp_tool_listing`。最后核实组织能否接受该 Connector 当前的留存与 ZDR/HIPAA 资格限制；若不适用，选择满足要求的接入路径。

## 本课结论

Messages API MCP Connector 让 Claude API 直接连接远程 MCP 工具服务器，适合远程 HTTP 服务并由请求配置工具集；它不等同于应用持有的通用 MCP client。选择连接方式时同时检查可用传输、工具清单变化、token 管理、人工审批门、响应内容块和数据资格，才能知道哪些控制由 Connector 提供、哪些仍由应用或 MCP server 负责。

## 范围与时效

- 官方页面核对日期：2026-11-10；MCP Connector 当时标记为 Beta。
- Messages API 远程 Connector 只直接支持文档列出的 HTTP 传输和 tool calls；本地 STDIO、prompts 与 resources 属于自管 MCP client 的范围。
- beta header、数据留存资格、支持平台和 MCP server 行为会变化；接入前按实际账户、平台和组织要求重新核对。
- 第20课介绍通用 tool-use 闭环，第27课介绍工具权限与副作用，第28课介绍生产数据与可观测性；本课只展开 MCP 的连接和边界。
