# CocosAgent MCP stdio 适配层 0.1

`tools/cocos-agent-bridge/mcp/mcp-server.mjs` 是既有本地 Agent JSONL API 的 MCP stdio 适配器。MCP SDK 管理 JSON-RPC、协议版本和工具输入校验；业务请求仍交给 `agent-jsonl.js`，再由既有调度器和 2.4.15 扩展处理。MCP 进程不调用 LLM，也不需要 Agent API Key；模型由启动它的 MCP 宿主提供。

## 首版边界

- 仅支持 Creator **2.4.15**。不提供 3.8 项目目标，不接收模型提供的 Creator 版本。
- 启动参数中的一个或多个 `--project` 组成可操作项目白名单；最多 8 个，必须是互不重复、已存在的绝对目录。实例选择和内容构建/预览只能引用白名单中的路径。
- 不暴露原始 WebSocket、任意脚本、任意文件写入或模型/API Key 配置。
- `cocos_2x_command_execute` 可调用目录内的语义命令，因其可能写入项目，MCP annotation 标为非只读和 destructive；调用前应先读能力目录，并只调用 `available` 项。具体输入、前置条件和状态仍由当前 Creator 扩展及 Host 再校验。
- 构建输出局限于既有 `content.build.*` 所校验的 2.4.15 Web-Mobile 隔离目录。预览仅对已完成构建开放 loopback 静态服务和运行时 Host，不会自动打开浏览器。
- MCP stdio 的 stdout 专用于协议帧；适配器不向 stdout 写日志。客户端断开/stdin EOF 时，MCP server 关闭活动的预览会话。

## MCP 工具

| MCP 工具 | 访问级别 | 用途 |
| --- | --- | --- |
| `cocos_2x_instances_list` | 只读 | 查询启动时注册的 2.4.15 项目实例 |
| `cocos_2x_instances_get` | 只读 | 查询所选项目的在线状态 |
| `cocos_2x_capabilities_list` | 只读 | 查询命令合同、输入结构、访问级别与当前可用状态 |
| `cocos_2x_command_execute` | 写入可能 | 调度目录中的 2.4.15 语义命令，返回统一 Host 回执 |
| `cocos_2x_operation_get` | 只读 | 查询持久操作记录，供重新连接和不确定结果检查 |
| `cocos_2x_operation_reconcile` | 写 Host 恢复证据 | 对账符合条件的中断操作；不重放编辑器写入 |
| `cocos_2x_operation_preview_accept` | 写预览回执 | 登记本地预览中的可见结果；保留同阶段已有的运行态读回证据 |
| `cocos_2x_content_build_plan` | 只读 | 校验 release 并查看构建计划 |
| `cocos_2x_content_build_execute` | 写入构建产物 | 生成并校验 Web-Mobile 包 |
| `cocos_2x_content_build_get` | 只读 | 读取持久化构建记录 |
| `cocos_2x_content_build_reconcile` | 修改 Host 记录 | 根据已有产物恢复 Host 构建记录，不会重启 Creator 构建 |
| `cocos_2x_content_preview_start` | 启动本机服务 | 为已完成且 release 指纹仍匹配的构建启动 loopback 预览 |
| `cocos_2x_content_preview_get` | 只读 | 读取预览连接状态和运行时回执 |
| `cocos_2x_content_preview_stop` | 结束本机会话 | 关闭预览运行时与静态服务 |

实例调用顺序为：列出实例，选定列表中的 `projectRoot`，查询能力，再按回执决定是否调用命令。构建和预览工具也要求从实例列表选择项目；MCP 参数 schema 会将项目路径限制为本进程启动时配置的路径。

`cocos_2x_operation_preview_accept` 只接受 loopback HTTP URL。preview 阶段仍待验收时，它创建视觉回执；自动运行态检查已通过时，它会把视觉观察作为额外证据追加到现有 preview 回执，不覆盖原有 runtime 状态证据。相同视觉证据重复提交幂等；每个回执最多保留 8 条证据。

## 启动和配置

依赖锁定在 MCP TypeScript SDK v2 `2.3.1` 与 Zod `4.6.5`。SDK 使用 Node.js 20 或更新版本；此工作区以 Node.js 22.22.2 完成验收。安装及运行测试：

```sh
cd tools/cocos-agent-bridge/mcp
npm ci
npm test
```

直接启动 stdio 服务（替换为本机仓库和工程的绝对路径）：

```sh
node /absolute/path/Cocos_Engine/tools/cocos-agent-bridge/mcp/mcp-server.mjs \
  --project /absolute/path/Cocos_Engine/2.4.15NewProject
```

若要管理多个 2.4.15 工程，重复传入 `--project`。通用 MCP 宿主的配置形式如下；`command` 应指向 Node.js 可执行文件，`args` 中使用本机绝对路径：

```json
{
  "mcpServers": {
    "cocos-agent-2x": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/Cocos_Engine/tools/cocos-agent-bridge/mcp/mcp-server.mjs",
        "--project",
        "/absolute/path/Cocos_Engine/2.4.15NewProject"
      ]
    }
  }
}
```

配置后，MCP 宿主应能读取工具列表。调用 `instances.list` 与 `capabilities.list` 只做本机编辑器握手和目录查询，不写入场景。构建、导入、场景修改等操作仍由各工具自己的 access annotation、参数约束和 Host 回执表达。

官方协议与接口依据：[MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)、[stdio transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)、[构建 MCP server](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server)。

## 验收与限制

自动测试使用官方 MCP SDK 的 Client、Server 和 `InMemoryTransport`：确认工具发现、2.4 目标固定、实例选择、共享 JSONL 路由、错误保留、命令专属输入拒绝及操作记录、对账和预览回执的请求映射。官方 MCP SDK `StdioClientTransport` 连接真实 2.4.15 工程后，发现 14 个工具、选中 `helloworld` 实例、读取 8 项可用命令，并经 MCP 完成只读 `scene.snapshot`。随后通过 MCP 在 `Canvas` 下创建带 `cc.Label` 的临时节点：编辑器保存、磁盘读回和 Chrome 运行态属性检查均通过；浏览器截图实际显示 “MCP WRITE VERIFIED”。`cocos_2x_operation_preview_accept` 将单独的视觉证据追加到已有运行态 preview 回执，`operation.get` 返回 `completed`。用 MCP 补偿和重放两轮后，补偿记录的 capability/editor/disk/recovery 均通过，preview 为 `skipped`；`operation.get` 与 `scene.node.inspect` 分别返回 `completed` 和 `not-found`，刷新预览恢复到原始 Hello World 画面。Creator 保存时重排了 `.fire` 序列化字段，测试后已把示例场景恢复为提交版本；当前 MCP 实测未留下场景差异。该轮还修复了补偿型 `scene.node.create` 被错误报告为 `needs-preview` 的状态判断，并为运行态与视觉双证据追加行为增加回归测试。随后用临时合成的“不确定写入”记录经 MCP 调用 `operation.reconcile`；真实 Creator 活动场景与磁盘均确认目标缺席，返回 `WRITE_RECONCILED_NO_EFFECT`、`sideEffect=none`、`recovery=passed`。合成记录在验收后删除；这证明 MCP 接线及真实双侧读回，不代表经历了真实编辑器故障。经 MCP 完成 `content.build.plan/execute/get`，构建 ID `web-mcp-real-01` 的隔离包状态依次为 `ready/verified/completed`，校验了红蓝两张资源的 UUID、pack import JSON 与 native PNG；随后同一构建又经 MCP 完成 `content.preview.start/get/stop`。浏览器实际显示蓝色方块、Cocos logo 和 Hello World，`get` 返回 `runtime-observed`，运行时回执确认蓝色资源已应用且引用计数为 1；预览服务和浏览器标签均已关闭。预览 URL 中的短期访问 token 未写入轨迹。最后，使用短期 synthetic `running` 构建记录（引用上面的已验证输出，不模拟真实 Creator 崩溃）通过 MCP `content.build.reconcile` 得到 `verified`，随后 `get` 读回 `completed`，重复 reconcile 返回 `already-terminal`；临时记录已删除。这验证了 MCP stdio 路由和恢复结果幂等，不替代真实 Host 崩溃后的进程恢复测试。证据见 [MCP 实机轨迹](traces/cocos-agent-mcp-2.4.jsonl)；构建执行的既有 JSONL/Host 实机证据仍见内容构建合同。

当前没有 MCP 资源/提示词、实时进度、取消、重连恢复或远程 HTTP transport。当前首版不改 Creator 扩展代码；后续可按面试目标逐步把验证过的 2.x 命令合同沉淀为 CocosAgent skill，再决定是否补 3.x。
