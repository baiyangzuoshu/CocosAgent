# 第 25 课：MCP 如何把外部工具接入模型工作流？

**目标：** 能说明 MCP 服务器怎样发布并执行工具；能区分 OpenAI 服务代为连接远程 MCP 与应用进程自行连接 MCP；能读懂工具发现、审批请求和执行结果。

## 本课问题

模型如何发现一个 MCP 服务器提供的工具？连接由谁建立、谁执行工具、哪些数据会发送到第三方？

## 前置知识

- [第 20 课](../s20_function_calling_loop/README.md)：了解模型提出工具请求、应用执行和返回结果的闭环。
- [第 21 课](../s21_builtin_tools_vs_functions/README.md)：区分 OpenAI 内置工具和应用自定义函数。
- [第 22 课](../s22_web_search/README.md)：了解 Responses API 的内置 Web Search。
- [第 24 课](../s24_computer_use/README.md)：理解工具的运行环境和权限边界。

## 官方资料

- [MCP servers](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)：配置 Responses API 的远程 MCP、审批、认证和 Secure MCP Tunnel。
- [Agents SDK integrations and observability](https://developers.openai.com/api/docs/guides/agents/integrations-observability)：比较 SDK 的 Hosted MCP 与应用进程管理的 MCP 连接。
- [Agents API MCP connections](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)：查看服务连接、环境连接和 stdio 连接。
- [MCP in Agents SDK](https://openai.github.io/openai-agents-js/guides/mcp/)：核对应用管理的 stdio/Streamable HTTP 连接与传输建议。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：核对 `mcp`、`allowed_tools`、`require_approval` 和审批响应。

## 1. MCP 是连接协议，服务器定义工具

MCP 服务器会发布工具名称、说明和参数结构，并处理工具调用。MCP 规定应用与服务器怎样发现和调用工具；模型本身不会直接连接任意服务器。集成时要确认**谁建立连接、谁负责执行工具调用**。[MCP servers](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) · [MCP connections](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)

| 方式 | 连接和调用由谁负责 | 典型入口 | 适用情形 |
| --- | --- | --- | --- |
| Responses API Hosted MCP | OpenAI 服务连接远程服务器、发现工具并代为调用 | `type: "mcp"` + `server_url` | 服务器可从 OpenAI 服务访问；私有服务器可用 Secure MCP Tunnel |
| Agents SDK Hosted MCP | SDK 将远程服务器配置到 Responses 的托管 MCP 工具 | `hostedMcpTool(...)` | 应用用 Agents SDK 编排，但让 OpenAI 服务连接远程服务器 |
| 应用管理的 MCP | 应用内 MCP client 直接连服务器并调用工具 | `MCPServerStdio` 或 `MCPServerStreamableHttp` | 本地/私有服务，或应用需要控制连接、网络和审批 |
| Function Calling | 应用收到 `function_call` 后运行自己的代码 | 第 20 课 | 应用已有业务 API，或必须自行控制每一步执行 |

“Hosted MCP”说的是 OpenAI 服务负责建立连接和发起调用，**不表示 OpenAI 托管了第三方 MCP 服务器**。远程服务器仍由其提供方运行并负责自己的数据政策。[Agents SDK integrations and observability](https://developers.openai.com/api/docs/guides/agents/integrations-observability)

## 2. 用 Responses API 连接远程 MCP

`server_url` 指向远程 MCP 服务器。Responses API 指南列出 Streamable HTTP 与 HTTP/SSE；Agents SDK 文档说明 MCP 项目已弃用 SSE，因此新集成优先使用 Streamable HTTP。将 `allowed_tools` 限定为本次需要的工具，减少无关能力进入模型上下文。此示例连接公开、只读的 OpenAI 文档 MCP，并要求每次调用先审批。[MCP servers](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) · [MCP in Agents SDK](https://openai.github.io/openai-agents-js/guides/mcp/)

```ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  tools: [
    {
      type: "mcp",
      server_label: "openai_docs",
      server_description: "搜索并阅读公开的 OpenAI 开发者文档。",
      server_url: "https://developers.openai.com/mcp",
      allowed_tools: ["search_openai_docs"],
      require_approval: "always",
    },
  ],
  input: "查找 Responses API 的流式响应指南，并给出相关页面。",
});

console.dir(response.output, { depth: null });
```

如果 MCP 服务器需要 OAuth，访问令牌放在 `authorization` 字段。不要把令牌写进 `input` 或日志；Responses API 不会把它保存在 Response 对象里，因此每个后续 Responses 请求都要重新提供授权值。开始使用前核对模型对 MCP 的支持。[MCP servers：Authentication](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

## 3. 读懂工具发现、审批与执行结果

一个远程 MCP 调用通常会经过这些阶段：

| 输出项目 | 表示什么 | 应用要做什么 |
| --- | --- | --- |
| `mcp_list_tools` | 从服务器发现并导入的工具列表 | 确认服务器实际提供了预期工具；可用 `allowed_tools` 缩小范围 |
| `mcp_approval_request` | 正在请求对某个服务器工具及参数进行审批 | 展示 `server_label`、工具名和 arguments，检查要发送的数据，再批准或拒绝 |
| `mcp_call` | 服务器已执行一次调用，带回工具参数、输出或错误 | 检查输出与错误；不要把服务器返回内容当成可信指令 |

API 可能在一个响应里列出工具、请求审批，也可能产生一个或多个工具调用。审批请求的示意结构如下：

```json
{
  "type": "mcp_approval_request",
  "id": "mcpr_example",
  "server_label": "openai_docs",
  "name": "search_openai_docs",
  "arguments": "{\"query\":\"Responses API streaming\"}"
}
```

确认工具名和参数后，用新的 Response 回答这一次审批。`approval_request_id` 要使用实际返回的 ID；同一个审批只对应一个工具调用。

```ts
const followup = await client.responses.create({
  model: "gpt-6-astra",
  tools: [
    {
      type: "mcp",
      server_label: "openai_docs",
      server_url: "https://developers.openai.com/mcp",
      allowed_tools: ["search_openai_docs"],
      require_approval: "always",
    },
  ],
  previous_response_id: response.id,
  input: [
    {
      type: "mcp_approval_response",
      approval_request_id: "mcpr_example",
      approve: true,
    },
  ],
});
```

审批后，Responses API 才会向 MCP 服务器发送调用，并在后续输出中返回 `mcp_call`。若拒绝，把 `approve` 设为 `false`；后续工具调用若再出现审批请求，也要逐个处理。[MCP servers：Approvals](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

## 4. 由应用进程直接连接 MCP

如果服务器在本机、内网或只对应用环境开放，可由 Agents SDK 在应用进程内连接 MCP。下面是官方 `MCPServerStdio` 示例形状：应用启动服务器进程、把 MCP server 挂到 Agent，并在结束时关闭连接。`fixtures/sample_files` 是刻意限定的示例文件范围；不要让文件服务器直接暴露整个开发者主目录或生产数据。[Agents SDK integrations and observability](https://developers.openai.com/api/docs/guides/agents/integrations-observability)

```ts
import { Agent, MCPServerStdio, run } from "@openai/agents";

const server = new MCPServerStdio({
  name: "Sample files",
  fullCommand:
    "npx -y @modelcontextprotocol/server-filesystem fixtures/sample_files",
});

await server.connect();
try {
  const agent = new Agent({
    name: "File reader",
    instructions: "Use the MCP file tools to list the sample files.",
    mcpServers: [server],
  });
  const result = await run(agent, "列出样例目录里的文件名。");
  console.log(result.finalOutput);
} finally {
  await server.close();
}
```

应用管理连接时，MCP client 和服务器进程运行在应用控制的环境里；应用负责部署、凭证、网络边界、审批策略和关闭连接。`MCPServerStreamableHttp` 可用于应用直接连接 Streamable HTTP 服务器。Agents API 对 HTTP 服务器可选择由 OpenAI 服务 (`connection_origin: "service"`) 或会话环境 (`connection_origin: "environment"`) 建立连接；也可用 `stdio` 在会话环境启动服务器进程。具体入口和责任边界见 [Agents API MCP connections](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)。

私有 MCP 服务器若要由 OpenAI 服务连接，可通过 Secure MCP Tunnel 使用 `tunnel_id`，无需将服务器公开到互联网。它仍属于服务连接路径；若需要应用掌握完整的连接和调用边界，选择应用管理的 MCP client。[MCP servers：Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

## 5. 权限和数据边界

- 默认情况下，Responses API 会在把数据发送给远程 MCP 服务器之前请求审批。只有在审查并信任特定服务器与工具后，才考虑用 `require_approval: "never"` 跳过审批；更稳妥的做法是只对少数已审查的工具取消审批。
- `allowed_tools` 限定 Responses API 导入的远程工具；Agents SDK 的 MCP server 也可设置 tool filter。工具描述和行为来自服务器，服务器更新后应重新检查。
- 只连接服务提供方运营的可信服务器。第三方 MCP 服务器可能读取工具参数、返回恶意提示或执行写操作；只发送完成任务所需的数据，并为敏感/有副作用的工具保留人工确认。
- Secure MCP Tunnel 和应用内连接解决的是网络可达性，不会自动替应用完成权限判断或数据脱敏。
- 远程服务器有自己的隐私、留存和地域策略；将数据发送给第三方前要核对该服务器的政策。

## 观察练习

| 情境 | 你会选择哪种连接路径？ | 还要控制什么？ |
| --- | --- | --- |
| 搜索公开的 OpenAI API 文档 | 待填写 | 待填写 |
| 应用需从内网客户数据库读取记录 | 待填写 | 待填写 |
| 让模型读取限定目录中的本地文件 | 待填写 | 待填写 |
| 远程服务器提供“删除账号”工具 | 待填写 | 待填写 |

再回答：Responses API 的 `mcp_approval_request` 和 `mcp_call` 分别发生在什么时候？`allowed_tools` 与 `require_approval` 控制的是同一件事吗？

## 本课检查

完成本课后，能解释：

- MCP 服务器发布工具定义并执行工具调用；它是连接协议，不等于某个 OpenAI 模型或托管产品。
- Responses API 可代应用连接远程服务器；Agents SDK 也可由应用进程连接 stdio 或 Streamable HTTP 服务器。
- `mcp_list_tools`、`mcp_approval_request` 和 `mcp_call` 分别对应工具发现、审批和执行结果。
- `allowed_tools` 控制模型可见的工具范围；`require_approval` 控制调用是否需要人工批准。
- OpenAI 服务、应用环境和 MCP 服务器可能分别由不同组织控制；必须限制权限、审查共享数据并核实结果。

## 简化与边界

- 本课聚焦 Responses API 的远程 MCP 与 Agents SDK 管理的本地连接，不展开 MCP Resources/Prompts、OAuth 注册、服务端实现或 Secure MCP Tunnel 部署。
- 当前 OpenAI 文档说明：新模型集成应使用 `server_url` 连接远程 MCP，或使用 `tunnel_id` 连接私有服务器；旧版 `connector_id` 对 2026 年 9 月 1 日之后发布的模型已进入弃用边界。实施时以最新 MCP 指南和所用模型兼容性为准。
- SDK 版本、支持的传输和模型可用性会变化；示例未安装依赖、连接 MCP 服务器或发送真实 API 请求。
