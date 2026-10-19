# Cocos Creator CLI 独立安装验收

日期：2026-10-19

范围：`tools/cocos-creator-agent-cli` 独立 npm 包、CLI 与第三方 MCP subprocess 适配边界。
结果：**本地包分发、CLI 参数/安装边界、隔离 bridge 生命周期和 MCP subprocess 边界验收通过；Creator 实机链路未验收。**

## 环境与包

- Node.js：`v22.22.2`；包要求 Node.js 20 或更新版本。
- CLI 源码包：`cocos-creator-agent-cli@0.1.0`。
- `npm pack` 的 tarball 包含 10 个文件：README、CLI 入口、bridge client/service/contracts、Creator extension 模板、命令合同和 package metadata。
- 验收 tarball：`cocos-creator-agent-cli-0.1.0.tgz`；SHA-1：`06b80383296808c9cb4f1a9400b629ad42635222`。

## 已通过的检查

1. CLI、bridge client/service、MCP server 的 `node --check` 通过。
2. 从源码包目录安装到 `/private/tmp` 下的独立 npm prefix；`--version` 和 `version --format json` 返回 `0.1.0`、`Creator 2.4.15`。
3. CLI `catalog --format json` 的 5 条命令、描述、输入 schema 和 `creator-extension/command-contract.json` 完全一致。
4. 修改临时副本版本至 `0.1.1`，在同一个隔离 prefix 执行 npm 安装更新；CLI 报告 `0.1.1`。这验证了本地包更新机制，不代表公共 registry/release 更新服务已经发布。
5. 从 npm tarball 安装到另一隔离 prefix，并在仓库目录以外运行。CLI 能从已安装包安装 Creator 扩展模板到临时工程形态目录；`package.json`、`main.js`、`scene.js`、`command-contract.json` 均存在。
6. 配置 MCP server 调用隔离 prefix 中的 CLI 后，stdio `tools/list` 返回 8 个工具；Host script schema 含 `instanceId`，其 `scriptPath.pattern` 与 CLI catalog 合同一致；`cocos_cli_status` 返回已安装的 `0.1.1`。
7. 将 MCP 的 CLI 命令指向不存在的路径后，MCP 仅公布 3 个基础工具；`cocos_cli_status` 返回清晰安装提示，server 保持可用。

## CLI 完整验收补充

在同一日期使用 Node.js `v22.22.2` / macOS 对当前包 tarball 做隔离验收：

- 版本、帮助、JSON 输出和 5 条命令合同一致性通过。
- 非法脚本路径、未知命令、未知 schema 字段、非对象 JSON、未支持的 `--format` 均被拒绝并返回非零退出码。
- 临时项目扩展安装通过；重复安装和 `packages/` 符号链接路径被拒绝，外部目标未被写入。
- 在隔离 HOME 中启动、查询和停止 bridge 通过；仅绑定 `127.0.0.1`，状态目录/文件权限为 `0700`/`0600`，无令牌健康请求返回 `401 BRIDGE_AUTH_REQUIRED`，合同指纹与包内合同 SHA-256 一致；空实例列表及非法实例查询行为符合预期，停止后状态文件移除。
- 沙箱最初禁止本机 loopback 绑定（`listen EPERM`）；随后通过隔离临时 HOME 的本机验收权限重跑，bridge 全项通过。未连接用户 Creator 会话。

## MCP 端到端协议验收补充

使用隔离安装的 CLI `0.1.0`、独立临时 HOME 和临时项目，以协议模拟器代替 Creator 扩展客户端完成 MCP→CLI→Bridge 往返：

- MCP `initialize`、`notifications/initialized`、`tools/list` 和 `tools/call` 均按 stdio JSON-RPC 工作；Host 发现 8 个工具。
- 5 个 Creator 工具的名称映射、描述、只读标注和输入 schema 与 CLI catalog/唯一合同一致；MCP 仅增加 `instanceId` 路由字段。
- `cocos_cli_status`、`cocos_instances_list`、`cocos_capabilities_list` 与 5 个 Creator 命令调用均收到预期回执。5 个命令调用实际经过 MCP 子进程、已安装 CLI 和本机 bridge，再由模拟编辑器轮询并响应；实例 ID、工程根路径、命令 ID 和输入均逐项核对。
- 非法脚本路径、未注册实例和未知 MCP 工具返回 `isError: true`；CLI 不存在时只公布 3 个基础工具，状态工具提供安装提示。
- 测试实例和项目均为临时数据，Creator 版本/扩展合同身份按 2.4.15 合同构造；没有连接或操作任何运行中的 Creator 实例。

## 边界

这些检查验证本地 npm 包可安装、独立运行、升级，CLI 的参数拒绝与扩展安装边界，以及隔离 bridge 生命周期和 MCP subprocess/JSON-RPC 行为。当前包没有自动化测试脚本；本次为隔离环境验收。MCP 命令往返使用模拟编辑器协议客户端，并非真实 Creator。未调用真实 Creator 实例；未将扩展装入用户工程；未在 Creator 2.4.15 中重载、配对或调用真实命令；也未在 Codex / Claude Host 中实际安装插件。公共 registry/release installer 尚未建立。上述项目需分别完成后，才能报告 Creator 或 Host 实机端到端验收通过。
