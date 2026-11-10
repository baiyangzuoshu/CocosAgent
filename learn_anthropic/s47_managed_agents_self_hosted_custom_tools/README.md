# 第 47 课：自托管 Worker 如何把内部服务封装为 Managed Agents Custom Tools？

**目标：** 能配置相互匹配的 Agent Custom Tool 声明和 Worker 实现，解释 `agent.custom_tool_use` 与结果事件的执行闭环，区分内网 MCP 的 Worker 封装与 Agent MCP Connector，并把业务授权、人工审批、超时和结果信任纳入设计。

## 本课问题

Agent 如何调用只在公司网络内可达的订单 API 或 MCP Server？如果工具实现在自托管 Worker 内，Managed Agents 的 Permission Policies 是否仍会拦截高影响操作？Agent 声明与 Worker 实现不同步会发生什么？

## 官方资料

- [Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)：Worker 提供 Custom Tools、封装内部 MCP Server、事件闭环、限制和权限边界。
- [Deploy self-hosted workers](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-workers)：SDK Worker、每 Session 沙箱和工作项生命周期。
- [第 38 课：Managed Agents Permission Policies](../s38_managed_agent_permission_policies/README.md)、[第 40 课：Agent MCP Connector](../s40_managed_agents_mcp_connector/README.md)、[第 44 课：自托管沙箱安全边界](../s44_managed_agents_self_hosted_sandbox/README.md)、[第 45 课：Worker 部署](../s45_managed_agents_worker_deployment/README.md)。

核对日期：2026-11-11。Self-hosted Custom Tools 属于 Beta，要求 `managed-agents-2026-04-01` Beta Header。下面示例说明配置关系；SDK 方法、可用平台和 schema 规则可能更新，实施前应核对目标平台文档。

## 1. Custom Tool 声明和实现必须同时存在

自托管 Custom Tool 有两个组成部分：**Agent 配置里的工具定义**与**Worker 进程中的可执行实现**。Agent 定义提供名称、描述和输入 JSON Schema，帮助 Claude 决定何时调用并形成参数；Worker 提供实际代码，调用组织内服务或数据源。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

```text
Agent 声明 custom 工具及输入 schema
                 ↓
Claude 请求调用，Session 产生 agent.custom_tool_use
                 ↓
Worker 中匹配名称的工具函数执行
                 ↓
Worker 发送匹配的 user.custom_tool_result
                 ↓
Claude 收到结果，继续推理或发起下一次工具调用
```

例如订单查询的 Agent 工具定义：

~~~json
{
  "type": "custom",
  "name": "get_order_status",
  "description": "按订单编号查询当前配送状态",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_id": { "type": "string", "description": "订单编号" }
    },
    "required": ["order_id"]
  }
}
~~~

Worker 要注册同名的 `get_order_status` 实现，并在 `EnvironmentWorker` 的 tools factory 中与 built-in toolset 一起提供。工具实现接收模型生成的输入，在 Worker 可访问的网络环境里执行，然后返回工具结果。Worker 使用 Environment Key 向 Managed Agents 提交结果，因此 Claude API Key 不应放在 Worker 主机。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)、[第 44 课](../s44_managed_agents_self_hosted_sandbox/README.md)

如果 Agent 声明了 Custom Tool，但当前没有 Worker 或客户端提供对应实现，Session 会暂停，停止原因是 `requires_action`；它会等待某一方提交匹配的结果事件。Agent 的定义成功创建，并不能证明 Worker 已注册实现或工具已运行。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

## 2. 内网 MCP 可由 Worker 作为 MCP Client

Managed Agents MCP Connector（第40课）由 Anthropic 服务侧连接 Agent 声明的 MCP Server。Server 必须能从 Anthropic 一侧直接访问，或通过 MCP tunnel 连入。若 MCP Server 只对组织内网络开放，可换一种接法：**Worker 在自己的网络内作为 MCP Client，连接内网 Server，再将 Server 暴露的操作作为 Custom Tools 提供给 Agent。**[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)、[第 40 课](../s40_managed_agents_mcp_connector/README.md)

| 项目 | Agent MCP Connector | Worker 包装 MCP 为 Custom Tools |
| --- | --- | --- |
| 谁连接 MCP Server | Anthropic Managed Agents 服务。 | 自托管 Worker 内的 MCP Client。 |
| 网络条件 | Server 对 Anthropic 可达，或配置 MCP tunnel。 | Worker 的网络能访问内网 Server；Server 不需要外部入站连接。 |
| Agent 里的声明 | MCP Server 与 MCP Toolset 配置。 | 每项 MCP 工具声明为 `type: "custom"`。 |
| 凭据和执行 | 使用 Agent MCP Connector / Session Vault 配置，工具由服务端执行路径处理。 | Worker 代码管理内网 MCP 连接和该连接需要的凭据。 |
| Permission Policies | MCP Toolset 可按 Agent 权限策略配置。 | 不适用；Worker 会执行模型调用的所有已注册 Custom Tools。 |

封装后的运行闭环是：Agent 发 `agent.custom_tool_use` → Worker 在保持打开的 MCP Session 上转发调用 → Worker 把 MCP 结果作为 `user.custom_tool_result` 发回。MCP Server 的工具定义也要转成 Agent 的 Custom Tool schema；Worker 在启动时再次列举并注册相同工具。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

自托管只把代码执行和内部 MCP 连接移到 Worker 网络中。Agent 使用的工具名称、描述、调用输入和工具结果仍会传到 Managed Agents 服务，供 Claude 生成调用和读取结果；不要把“Server 不暴露公网”解释成“数据不会到达 Anthropic”。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

## 3. MCP 工具清单必须与 Agent 定义同步

在创建或更新 Agent 时，列出 MCP Server 提供的工具，并将 `name`、`description`、`inputSchema` 映射到 Custom Tool 的名称、描述和 `input_schema`。如果 Server 对工具清单分页，要声明所有页面里的工具，并确保 Worker 也加载全部页面。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

Worker 在启动时读取工具清单；运行中的 Session 不能动态新增 Agent 工具。Server 工具发生变化后，需要更新 Agent（或符合条件时更新 idle Session），并重启 Worker 以重新加载实现。如果多个 MCP Server 提供重名工具，需要自行建立带命名空间的 Custom Tool 名称，再把该名称映射回对应 Server 的原始工具名。

当前文档列出的主要声明限制：

- Agent `tools` 数组最多 256 项，每个 Custom Tool 各占一项；built-in Agent toolset 也占一项。
- Custom Tool 名称必须在同一 Agent 中唯一，长度为 1–128 个字符，只使用字母、数字、下划线或连字符；不能与 built-in 工具同名，也不能使用保留的 `mcp__` 或 `ant__` 前缀。
- `description` 必须非空。输入 JSON Schema 拒绝 `$ref`，也拒绝顶层 `oneOf`、`anyOf` 和 `allOf`；有冲突的 MCP Schema 要在 Agent 声明前转换或内联。

这些约束会影响 MCP 工具自动生成。创建 Agent 前先验证转换后的名称与 JSON Schema，而不是等运行时才发现 Worker 声明和 Agent tool 定义不匹配。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

## 4. Custom Tools 的授权与审批要写进工具实现

Managed Agents Permission Policies 不适用于 Worker 提供的 Custom Tools。模型一旦发出某个已注册 Custom Tool 调用，Worker 就会执行它；`always_ask`、`auto` 等 Agent 工具策略不会自动在这段 Worker 代码前停下来审批。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)、[Permission Policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

因此不要只在工具描述里写“需要审批”。对会产生业务副作用的 Custom Tool，Worker 应在调用内部系统前检查当前 Session 的授权上下文，并在需要时走应用自己的用户确认或审批流程；否则只暴露满足当前任务的只读能力。Environment Key 负责向 Agent 平台提交结果，不是访问内部订单、数据库或 MCP Server 的业务凭据；内部访问凭据还要单独按最小权限管理。[第 38 课](../s38_managed_agent_permission_policies/README.md)、[第 44 课](../s44_managed_agents_self_hosted_sandbox/README.md)

## 5. 处理 MCP 工具超时、错误结果和不可信输出

Worker 包装 MCP 后，Server 返回的工具错误会作为 error tool result 回传给 Claude，模型可以据此解释或尝试其他操作。MCP 内容若无法映射到工具结果的标准内容类型，例如 audio block 或 resource link，也会作为错误处理。为 MCP Client 设置超时，避免网络挂起长期占住 Worker 和 Session。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)

Custom Tool 的名称、描述、输入和结果都会进入模型上下文。工具返回内容属于不可信输入，可能通过提示注入影响 Agent 后续行为，包括调用 Worker 上其他工具或 Bash。只包装组织运营或信任的 Server，并只声明该 Agent 必须使用的工具；结果在回传前也应按业务类型做范围控制和必要的校验。[Custom tools in self-hosted sandboxes](https://platform.claude.com/docs/en/managed-agents/self-hosted-sandboxes-custom-tools)、[第 27 课：工具安全与提示注入](../s27_tool_security_prompt_injection/README.md)

## 练习：把订单查询与退款流程分开

某内部 MCP Server 提供 `get_order_status` 与 `issue_refund`。客服 Agent 日常只需查询订单；退款需要客户确认并由主管审批。请说明应如何声明两项工具、Worker 怎样接入内网 MCP、以及审批放在什么位置。

**参考答案：** Worker 在组织网络中作为 MCP Client 连接内网 Server，将所需 MCP 工具映射成 Agent Custom Tool 声明及 Worker handler。日常 Agent 只开放 `get_order_status`。若将 `issue_refund` 声明并注册，Worker handler 必须在调用退款 API 前验证当前用户权限、确认对象范围，并执行客户确认与主管审批；Managed Agents Permission Policies 不会自动拦截这项 Custom Tool。Server 返回的状态或错误再按 `user.custom_tool_result` 回传。开发与测试阶段可分开部署只读 Agent，避免把写操作误暴露给一般会话。

## 本课结论

自托管 Worker 可以执行 Agent 定义的 Custom Tools，也可以把只在组织网络内可达的 MCP Server 转成 Custom Tools。Agent 声明与 Worker 实现必须保持一致；运行时由 Worker 回传结果，Agent 才能继续。该模式让 Worker 连接内部服务时无需向 Anthropic 开放 MCP 入站，但调用名称、参数和结果仍会经过 Managed Agents，而且 Permission Policies 不管理 Worker Custom Tools。业务授权、人工审批、最小工具范围、超时与结果校验都要在 Worker 和应用代码中明确实现。

## 范围与时效

- 官方资料核对日期：2026-11-11；Managed Agents 与 Self-hosted Custom Tools 当时为 Beta。
- Agent tool 数量、名称和 JSON Schema 限制，以及 Worker SDK 和 MCP helper API 可能更新；按目标平台最新文档核对。
- Managed Agents 直接连接 MCP Server 与 Vault 凭证见第39、40课；自托管 Worker 的能力和网络责任见第44、45课。
