# 第 41 课：Managed Agents 如何限制 Web Search 和 Web Fetch 的域名？

**目标：** 能分别配置 Agent 的 Web Search 与 Web Fetch 域名范围，协调组织设置和 Environment 网络规则，并正确理解子域匹配、跳转、失败事件与内容上限。

## 本课问题

Web Search 和 Web Fetch 都能访问网站，它们的域名规则是否相同？Agent 配置和组织级限制如何共同生效？Environment 的 `allowed_hosts` 与工具的 `allowed_domains` 怎样配合？

## 官方资料

- [Restrict web search and web fetch domains](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)：工具域名列表、组织设置、Environment 规则、内容上限与拒绝行为。
- [Managed Agents Tools](https://platform.claude.com/docs/en/managed-agents/tools)：内置工具集、工具配置、自定义工具和输出大小处理。
- [第 27 课：工具权限与提示注入](../s27_tool_security_prompt_injection/README.md)、[第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 38 课：Permission Policies](../s38_managed_agent_permission_policies/README.md)、[第 40 课：Managed Agents MCP 连接](../s40_managed_agents_mcp_connector/README.md)。

核对日期：2026-11-11。Web domain restrictions 当前为 Beta 功能，Managed Agents 使用 managed-agents-2026-04-01 Header；官方页面注明 Managed Agents 不符合 ZDR 和 HIPAA 资格。域名规则、工具参数、模型和平台支持可能变化，实施前应核对目标平台最新文档。

## 1. 两种工具，两条不同的访问路径

| 工具 | 用途 | 域名不允许时的行为 |
| --- | --- | --- |
| `web_search` | 在网络中搜索，返回搜索结果。 | 不符合域名规则的搜索结果会被过滤掉。 |
| `web_fetch` | 抓取指定 URL 的页面内容。 | 请求会作为错误工具结果返回给 Agent。 |

Managed Agents 在 Agent 的内置工具集配置里设置这两个工具的限制；Messages API 则把字段放在每次请求对应的工具参数中。两种产品都使用 `allowed_domains` 或 `blocked_domains`，但配置位置不同。`web_search` 与 `web_fetch` 各自持有一套规则，因此可分别允许搜索文档站点和抓取产品网站。[Web restrictions](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)

~~~yaml
tools:
  - type: agent_toolset_20260401
    configs:
      - type: web_search
        name: web_search
        allowed_domains:
          - docs.example.com
          - arxiv.org
        user_location:
          type: approximate
          country: US
          timezone: America/Los_Angeles
      - type: web_fetch
        name: web_fetch
        blocked_domains:
          - ads.example.com
        max_content_tokens: 50000
~~~

示例为 `web_search` 设定允许列表和搜索地点；`web_fetch` 使用单独的排除列表，并限制加入模型上下文的页面内容量。实际字段需与 Agent toolset 的当前配置格式一致。

## 2. 选择允许列表或屏蔽列表

`allowed_domains` 将工具限制为列表中列出的主机；`blocked_domains` 将列表中的主机排除。单个工具配置只能设置其中一类列表，不能同时提交两者：

| 需求 | 配置思路 | 注意事项 |
| --- | --- | --- |
| Agent 只能查阅指定文档站点 | 为对应工具设 `allowed_domains`。 | 新增其他站点默认仍不可访问。 |
| Agent 可访问多数网站，但不得碰少数站点 | 为对应工具设 `blocked_domains`。 | 新增站点默认可访问；排除列表不等于全面限制。 |
| 不希望为该工具增加额外限制 | 省略字段，或发送 `null`。 | 组织策略和 Environment 网络规则仍可能限制访问。 |

每个列表必须包含 1–64 个域名，每个域名不超过 255 个字符；空列表、重复项或格式错误会导致 API 请求被拒绝。www.example.com 与 example.com 是不同的列表条目。[Web restrictions: domain list rules](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)

域名用不带协议和端口的主机名书写，例如 docs.example.com。工具域名规则会匹配所列主机及它的子域名：example.com 可覆盖 docs.example.com；反过来则不行。前导 www. 只是普通子域。主机名比较不区分大小写；不要写通配符、IP 地址或单独的公共后缀。`web_search` 支持受限的路径后缀，但 `web_fetch` 域名应只写主机名；通常使用简单的域名 allowlist 更容易审核。

## 3. Agent、组织和 Environment 规则一起检查

组织管理员在 Claude Console 配置的 Web Search / Web Fetch 能力与域名设置也适用于 Session。Agent 的工具列表不能扩大组织批准的范围：

| 层级 | 检查内容 | 效果 |
| --- | --- | --- |
| Agent 工具配置 | 每个 `web_search` 与 `web_fetch` 工具自己的 `allowed_domains` 或 `blocked_domains`。 | 为该 Agent 的相应工具收窄范围。 |
| 组织设置 | 管理员启用状态及组织级域名限制。 | 组织禁用某工具时，该工具调用返回错误；域名限制与 Agent 规则同时适用。 |
| Environment `networking` | `limited` Environment 的 `allowed_hosts`。 | 另外限制 Session 沙箱可访问的网络主机。 |

`web_fetch` 的目标 URL 和每次重定向后的 URL 都必须通过组织规则与 Agent 工具规则。若不允许，`web_fetch` 返回错误；`web_search` 则不呈现不符合规则的搜索结果。组织禁用了其中一个工具时，它也会返回错误结果给 Agent，而 Session 仍可继续运行。[Web restrictions](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)

在 `limited` Environment 中，启用的 Web 工具所配置的 `allowed_domains` 还要落在 Environment.`allowed_hosts` 范围内。若某个 `allowed_domains` 主机不被 `allowed_hosts` 覆盖，创建 Session 或带工具覆盖项更新 Session 时会返回 HTTP 400。运行时 `web_fetch` 访问 Environment 不允许的主机会得到 `url_not_allowed`；`web_search` 会省略来自这些主机的结果。

要特别注意两组主机规则的匹配方式不同：Web 工具的域名项覆盖该域及其子域；Environment.`allowed_hosts` 默认只匹配精确主机，若要覆盖子域需要使用类似 *.example.com 的形式。例如 Web 工具允许 docs.example.com，但 Environment.`allowed_hosts` 只有 example.com 时，Session 创建校验仍可能失败；将 `allowed_hosts` 配为 docs.example.com 或 *.example.com 才匹配该主机。[Web restrictions: `limited` `networking`](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)、[第 40 课](../s40_managed_agents_mcp_connector/README.md)

这两类域名列表配置的是内置 Web 工具的访问范围。它们不能替代 Environment 网络隔离，也不自动限制 MCP Server、Bash 或其他 Agent 工具的联网行为；这些能力要分别按各自的网络与工具控制面配置。

## 4. 调整抓取内容量与搜索位置

`web_fetch` 支持 `max_content_tokens`，以正整数限制抓取页面内容加入上下文的最大量；`web_search` 支持 `user_location`，用于按大致地点调整搜索结果。两项参数只适用于各自对应工具，不能在另一个工具条目中混用。需要在 Claude Console 设置域名列表时可用内置工具表单；`max_content_tokens` 和 `user_location` 则在 Agent 配置的 Raw view 中设置。[Web restrictions: settings](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)

Agent 或 Session 配置的域名列表不合法时，创建或更新请求会返回 400 `invalid_request_error`。若工具在运行时发现 URL 不允许，事件流中的 `agent.tool_result` 会标记 `is_error`: true，并给出 `url_not_allowed`。应用应展示合适的错误状态、保留可审计的规则版本，并避免把“搜索无结果”误判成“来源中没有资料”。[Web restrictions: errors](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)

## 5. 多 Agent 继承规则不能放宽父级边界

在多 Agent Session 中，适用于同一 Thread 的域名规则同时生效。`allowed_domains` 需要被所有适用列表覆盖；`blocked_domains` 则累加。子 Agent 可以进一步缩小可访问范围，不能借自己的配置扩大调用它的 Agent 或 Session 的范围。`max_content_tokens` 和 `user_location` 不做列表交集，而按文档定义的 Thread 配置回退规则选择值。[Web restrictions: multiagent sessions](https://platform.claude.com/docs/en/managed-agents/tools-web-restrictions)

因此，审查多 Agent Agent 配置时，要沿委派关系核对 Web 工具域名限制；不能只检查最外层主 Agent，也不能认为子 Agent 配置会覆盖更严格的父级规则。

## 练习：把研究 Agent 限定在可信资料来源

一个研究 Agent 需要搜索 Anthropic 文档与 arXiv，并抓取这两个来源的页面。组织管理员也限制了搜索范围，Environment 使用 `limited` 网络。请列出 Web 工具配置、需要对齐的组织规则与 `allowed_hosts`，并说明搜索和抓取被拒绝时 Agent 会看到什么。

**参考答案：** 为 `web_search` 和 `web_fetch` 分别设置 `allowed_domains`，只列 docs.anthropic.com 与 arxiv.org；若需路径级约束，只在确认其匹配语义后对 `web_search` 使用路径后缀。配置列表需是有效的纯主机名，且只能给每个工具配置 `allowed_domains` 或 `blocked_domains` 其中之一。核对组织级规则确实允许两站点；把相应主机加入 `limited` Environment 的 `allowed_hosts`。若搜索结果受限，`web_search` 会省略结果；若 `web_fetch` 请求或重定向目标不允许，则 Agent 收到 `is_error`: true 和 `url_not_allowed`。不要把缺少结果解释成资料不存在。

## 本课结论

Managed Agents 的 Web Search 与 Web Fetch 可分别使用允许列表或屏蔽列表，并可限制抓取内容量或指定搜索地点。真正可访问的范围由 Agent 配置、组织策略和 Environment 网络范围共同决定；域名校验失败对两种工具的表现不同。多 Agent 规则可逐层收紧，不能放宽父级边界。

## 范围与时效

- 官方资料核对日期：2026-11-11；Web domain restrictions 当时为 Beta。
- 域名列表约束、工具参数、组织级能力设置和平台支持可能变化；按目标平台当前文档复核。
- Web 工具调用策略见第 38 课；Agent/MCP 配置与 Environment 网络规则见第 32、40 课；网页内容作为不可信输入处理见第 27 课。
