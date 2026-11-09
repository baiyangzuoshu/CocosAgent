# 第 28 课：MCP 工具

**目标：** 将 MCP Server 发现的工具接到 Harness
工具注册表，让模型像调用原生工具一样使用它们。

## 本课问题

MCP Server 提供的工具如何进入 Harness
的模型请求？模型用公开工具名发起调用后，客户端怎样把调用路由回 MCP Server？

## 本课增量

本课用一个本地 MCP Server 夹具展示最小桥接闭环。客户端先执行语义上的
`tools/list`，把远端工具描述和输入 schema 注册为
`mcp__<serverName>__<toolName>`。模型选择该公开名称后，Harness Tool Registry
调用桥接器；桥接器通过捕获的原始 MCP 工具名执行
`tools/call`，再把结果交给模型完成回答。

```text
MCP Server tools/list
        │ name + description + inputSchema
        ▼
MCP bridge ──register──> Harness ToolRegistry ──schemas──> Model request
                                                           │ tool call
                                                           ▼
MCP Server ◄──tools/call(rawName, arguments)── bridge ◄── registry.execute
        │
        └── content / isError ──> tool result ──> next model request
```

示例让 Fake LLM 调用 `mcp__local_notes__search_notes`，桥接器实际发送给 Server
的名字仍是 `search_notes`。成功的工具结果进入下一次模型请求；MCP 返回 `isError`
时也会保留为 Harness 的错误结果。断开桥接会注销本服务器注册的工具。

## 源码对照

- [`packages/mcp/mcp-client/src/index.ts`](../../../deepseek-harness/packages/mcp/mcp-client/src/index.ts)：定义客户端配置、注入
  `tools` 服务，并等待初始连接和工具同步就绪。
- [`packages/mcp/mcp-client/src/connection.ts`](../../../deepseek-harness/packages/mcp/mcp-client/src/connection.ts)：监督
  MCP 连接、初始工具同步、工具列表变化和重连生命周期。
- [`packages/mcp/mcp-client/src/tools.ts`](../../../deepseek-harness/packages/mcp/mcp-client/src/tools.ts)：`syncTools()`
  发现 MCP
  工具、生成服务器限定公开名、创建适配器，并原子交换注册代；`createMcpToolDefinition()`
  把结果适配成 Harness 规范工具输出。
- [`packages/core/tools/src/index.ts`](../../../deepseek-harness/packages/core/tools/src/index.ts)：接收桥接器注册的
  `ToolDefinition`，供系统提示与执行流水线消费。
- [`packages/mcp/mcp-client/README.zh.md`](../../../deepseek-harness/packages/mcp/mcp-client/README.zh.md)：完整客户端配置、stdio/Streamable
  HTTP 传输、命名、同步、错误与重连行为。
- [`docs/subsystems/mcp.zh.md`](../../../deepseek-harness/docs/subsystems/mcp.zh.md)：MCP
  包组的整体职责。

## 代码结构

```text
s28_mcp_tools/
├── README.md
├── deno.json
└── src/
    ├── fake-llm.ts
    ├── local-mcp-server.ts
    ├── main.ts
    ├── mcp-bridge.ts
    ├── tool-registry.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：模型可见的工具名是 `mcp__local_notes__search_notes`；MCP Server
收到的调用名是原始
`search_notes`；模型进行了两次请求，第二次请求里带有工具结果；无效输入产生的 MCP
`isError` 会成为 Harness 错误结果；释放连接后工具注册表为空。

## 关键观察

- **MCP 工具先发现、再注册。** Server 的名称、说明和输入 schema 投影到 Harness
  工具定义中，后续的模型工具 schema 汇总自然包含它。
- **公开名与协议名分开保存。** 模型需要服务器限定名以区分来源；MCP `tools/call`
  只接受原始工具名。桥接器用闭包保留原始名，不从公开名反向解析。
- **结果回到普通工具流水线。** 对 AgentLoop 来说，这仍是一项已注册的 Harness
  工具；工具结果照常作为 tool-role 消息进入下一次模型请求。前置的第 23
  课展示了完整 Session 事件闭环，本课只聚焦边界适配。
- **远端错误不能伪装成成功。** MCP 结果的 `isError` 被保留给 Harness
  工具结果，模型因此能看到失败文本。
- **注册生命周期归桥接连接所有。** dispose
  会撤销本连接创建的工具，避免断开后模型仍看见不可用能力。
- Harness 真实公开名遇到长度或字符限制时会确定性规范化，并用身份 hash
  避免名称碰撞；本课夹具只使用符合约束的名称。

## 简化与边界

- `LocalNotesMcpServer` 是进程内夹具；方法分别模拟 MCP 的 `tools/list` 和
  `tools/call` 语义，不实现 JSON-RPC 编码、协议协商或实际 stdio/Streamable HTTP
  传输。
- Tool Registry 和 Fake LLM 仅保留桥接所需的最小接口，不复刻 Harness 的完整
  schema 校验、工具策略、超时、取消和 Session 持久化。
- 示例只同步一次工具列表；没有复刻真实客户端在工具变更通知时的原子世代切换、连接管理、重连、凭据与资源能力。
- 夹具中的服务器工具名已符合本课约束；真实实现还会处理有损规范化、冲突、分页、重复名称与完整
  MCP 返回块投影。

---

下一课是「Web Host 与 Client」：把 Agent/Session 事件送到浏览器并呈现流式更新。
