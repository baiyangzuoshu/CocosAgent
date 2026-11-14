# 第 05 课：交互、Print、SDK 与 MCP 运行模式

**目标：** 从参数和终端状态追踪 CLI 如何选择 REPL、非交互输出、SDK 流式 I/O 或 MCP Server 路径，并区分 SDK 协议入口与 Agent SDK 类型入口。

## 本课要回答的问题

1. CLI 用哪些条件判断交互会话和非交互会话？
2. `--print` 的输入、输出格式如何进入 headless 执行路径？
3. `--sdk-url` 与普通 `--print` 共用哪些代码，又额外替换了什么？
4. 当前快照中的 `agentSdkTypes.ts` 能证明哪些 SDK 行为，不能证明哪些？
5. `claude mcp serve` 与会话中连接外部 MCP Server 有何区别？

## 模式分流

CLI 在完整启动后根据参数和 stdout 是否为 TTY 设置 `isNonInteractive`。交互路径挂载 Ink 并进入 REPL；非交互路径整理 prompt、工具和会话状态后调用 `runHeadless()`。`--sdk-url` 复用 headless 主链，但将标准输入输出适配为远程结构化流。`claude mcp serve` 则作为 Commander 子命令启动单独的 MCP Server。

~~~mermaid
flowchart TD
  A[CLI 收到参数] --> B[根据 print / init-only / sdk-url / TTY 判断交互状态]
  B -->|交互| C[entrypoint cli]
  C --> D[Ink setup screens]
  D --> E[REPL]
  B -->|非交互| F[entrypoint sdk-cli]
  F --> G[准备 prompt、工具和会话状态]
  G --> H[runHeadless]
  H --> I{提供 sdkUrl?}
  I -->|否| J[StructuredIO: stdin / stdout]
  I -->|是| K[RemoteIO: 远程双向流]
  A --> L{命令是 mcp serve?}
  L -->|是| M[entrypoint mcp]
  M --> N[setup 后启动 MCP Server]
  N --> O[stdio: tools/list 与 tools/call]
  P[agentSdkTypes.ts] -.导出类型和 SDK API 形状.-> Q[本快照中的实现桩]
~~~

图中的 `cli`、`sdk-cli`、`mcp` 是 `CLAUDE_CODE_ENTRYPOINT` 分类值。`sdk-cli` 是 CLI 对非交互运行的内部标记，单凭这个名字不能推断公开 Agent SDK 的调用实现。

## 模式与输入输出

| 路径 | 选择条件 / 入口 | 输入与输出 | 主处理位置 |
| --- | --- | --- | --- |
| 交互 CLI | `isNonInteractive` 为 false；通常是 TTY 且没有 `--print` 等非交互参数 | 终端交互，Ink 渲染 REPL | `main.tsx` 的 setup screens、`replLauncher` / REPL |
| Print / headless | `--print`；分类逻辑还把 `--init-only`、`--sdk-url` 或非 TTY stdout 视为非交互 | `text` 从 prompt 和管道输入取内容；`stream-json` 把 stdin 当作异步流 | `main.tsx` 调用 `runHeadless()`，实现位于 `cli/print.ts` |
| SDK 流式桥接 | `--sdk-url`；源码自动补齐 print、stream-json 输入输出和默认 verbose | 由 `RemoteIO` 连接远端，交换结构化消息 | `cli/print.ts` 的 `getStructuredIO()` 与 `cli/remoteIO.ts` |
| MCP Server | `claude mcp serve` | MCP JSON-RPC 经标准输入输出传输 | `cli/handlers/mcp.tsx` 调用 `entrypoints/mcp.ts` |
| Agent SDK API | `entrypoints/agentSdkTypes.ts` | 此文件导出公共类型并列出 API 签名 | 当前快照中的函数体多为 `throw new Error('not implemented')` |

### Print 的格式边界

- 输入格式为 `text` 时，非 TTY stdin 的内容会与命令行 prompt 合并；输入格式为 `stream-json` 时，`process.stdin` 直接作为异步流交给后续结构化 I/O。
- `stream-json` 输入要求 `stream-json` 输出。`--sdk-url` 自动设置两者；它还会默认开启 verbose 和 print 路径。
- `text` 输出最终结果文本；`json` 默认输出最终 result 对象，verbose 时输出消息数组；`stream-json` 在消息循环中逐条写出结构化消息。
- `--init-only` 虽被归入非交互状态，但会执行 Setup 和 SessionStart hooks 后退出，不应与常规 Print 查询等同。

## SDK：协议通道与 API 类型面

在 CLI 内部，`--sdk-url` 不是一个单独的 Agent SDK query 实现，而是把 headless 会话的 I/O 接到 `RemoteIO`。`getStructuredIO()` 在普通情况下构造 `StructuredIO`，有 URL 时改用 `RemoteIO`；传输选择器默认使用 WebSocket，也保留由环境开关选择 Hybrid 或 SSE 的分支。

另一个入口 `entrypoints/agentSdkTypes.ts` 汇总 SDK 类型和函数签名。不过在当前源码快照里，`query()`、`createSdkMcpServer()` 等函数体直接抛出 `not implemented`。因此本课可以据此辨认 API 类型面和消息协议类型，不能据此还原公开 SDK 的实际运行时实现。源码中隐藏的 `--assistant` 选项则是带 feature gate 的 Agent SDK daemon 用法，也不等同于普通交互 REPL。

## MCP：以客户端连接，或作为服务器提供工具

Claude Code 会话中的 MCP 配置描述客户端要连接的 Server；`claude mcp serve` 是另一个方向：当前进程把自身工具提供给外部 MCP 客户端。命令 handler 先执行 `setup()`，然后 `startMCPServer()` 创建 MCP `Server` 并注册 `ListTools`、`CallTool` 处理器，最后用 `StdioServerTransport` 连接。

`CallTool` 分支从 CLI 工具集合里查找目标工具，构造非交互 `ToolUseContext`，校验输入并执行工具，再把结果包装成 MCP 文本内容；异常会返回 `isError: true`。这个服务路径不会创建 Ink REPL，也不通过 `--output-format` 生成 Print 结果。

## 源码对照

- `AI/claude-code-analysis-main/src/main.tsx:517-540,797-815`：依据参数和 TTY 状态设置交互性，并选择 `cli`、`sdk-cli` 或 `mcp` 入口标记。
- `AI/claude-code-analysis-main/src/main.tsx:2217-2242`：交互路径创建 Ink root 并运行 setup screens。
- `AI/claude-code-analysis-main/src/main.tsx:857-883`：Print 输入从 prompt、pipe 或 JSON stream 读取。
- `AI/claude-code-analysis-main/src/main.tsx:1220-1252,1823-1858`：`--sdk-url` 默认格式、stream-json 配对条件及 Print 相关校验。
- `AI/claude-code-analysis-main/src/main.tsx:2825-2859`：把非交互会话选项交给 `runHeadless()`。
- `AI/claude-code-analysis-main/src/cli/print.ts:777-805,847-930`：headless 输入检查、SDK permission prompt 路由、流式消息写出和 text/json 收尾。
- `AI/claude-code-analysis-main/src/cli/print.ts:5199-5232`：字符串 prompt 的结构化封装，以及 `StructuredIO` / `RemoteIO` 的选择。
- `AI/claude-code-analysis-main/src/cli/remoteIO.ts:31-93,170-172`、`AI/claude-code-analysis-main/src/cli/transports/transportUtils.ts:8-44`：远程 I/O 连接与 WebSocket、Hybrid、SSE 传输选择。
- `AI/claude-code-analysis-main/src/entrypoints/agentSdkTypes.ts:1-31,73-122`：SDK 类型导出与未实现的 API 函数体。
- `AI/claude-code-analysis-main/src/main.tsx:3892-3908`、`AI/claude-code-analysis-main/src/cli/handlers/mcp.tsx:59-71`：`mcp serve` 命令到 handler 的分发。
- `AI/claude-code-analysis-main/src/entrypoints/mcp.ts:1-39,47-105,110-195`：MCP Server 能力、工具请求处理和 stdio transport。
- `AI/claude-code-analysis-main/src/main.tsx:2380-2412`：会话 MCP 配置分类，并把配置连接路径与 `mcp serve` 的服务器入口区分开。

## 静态观察

在仓库根目录执行以下命令，只检查源码，不启动 CLI：

~~~sh
nl -ba AI/claude-code-analysis-main/src/main.tsx | sed -n '517,540p;797,815p;857,883p;1220,1252p;1823,1858p;2825,2859p;3892,3908p'
nl -ba AI/claude-code-analysis-main/src/cli/print.ts | sed -n '777,805p;847,930p;5199,5232p'
nl -ba AI/claude-code-analysis-main/src/cli/transports/transportUtils.ts | sed -n '8,44p'
nl -ba AI/claude-code-analysis-main/src/entrypoints/agentSdkTypes.ts | sed -n '1,31p;73,122p'
nl -ba AI/claude-code-analysis-main/src/entrypoints/mcp.ts | sed -n '47,105p;110,195p'
~~~

## 观察结果

交互、Print 和 MCP Server 是不同的控制流；Print 与 `--sdk-url` 共用 headless 主链，但后者把结构化 I/O 改接到远程 transport。`agentSdkTypes.ts` 给出了类型与 API 面的阅读入口，但当前快照中函数实现桩不构成 SDK 运行时证据。MCP 配置作为客户端连接和 `mcp serve` 作为服务器提供工具，也必须分开追踪。

## 简化与限制

- 本课只按默认 CLI、Print、隐藏 SDK 流式选项和 `mcp serve` 追踪入口；未展开 `claude mcp add/list` 管理命令。
- `--assistant`、SDK transport 变体和各构建 feature gate 只作源码定位，不推断每种发行构建都会启用。
- 当前源码目录没有可运行的项目构建入口；本课是静态源码分析，不是 CLI、Agent SDK 或 MCP 客户端的运行时验收。
