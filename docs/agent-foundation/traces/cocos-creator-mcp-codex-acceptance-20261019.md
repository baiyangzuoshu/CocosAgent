# Cocos Creator MCP Codex 实机验收

日期：2026-10-19

范围：第三方 Codex 插件、独立 CLI、当前 MCP 适配器及运行中的 Creator 2.4.15。

目标工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`。
结果：**5 条 Creator 只读命令已通过真实 Codex MCP 和 Creator 实例验收；桥接重启后实例恢复；CLI/MCP 脚本读取回执一致。随后 Codex MCP 工具目录已重载，当前会话可见 8 个工具，`cocos_cli_status` 实际调用成功，Creator 实例仍连接。**

## 环境与身份

- Host：Codex 桌面当前会话。插件缓存刷新后，初始目录为 7 项；用户要求重载后，当前会话实际目录为 8 项，新增 `cocos_cli_status`。
- Codex 插件：`cocos-creator-agent@cocos-agent-local`，安装版本 `0.2.0`。验收期间执行 `codex plugin add cocos-creator-agent@cocos-agent-local` 刷新本机缓存；缓存 `mcp/server.mjs` 与仓库文件逐字节一致。当前会话最初仍显示 7 项；按用户要求重载后更新为 8 项（见下文 Host 边界）。
- 独立 CLI：`cocos-creator-agent-cli@0.1.0`，安装命令为 `/opt/homebrew/bin/cocos-creator-agent`；`version --format json` 返回 Creator 目标版本 `2.4.15`。
- Creator：`2.4.15`；扩展：`0.1.0`；工程：`tank`；路径：`/Users/youjunmao/WORK/Cocos_Engine/tank`；场景：`New Node`，UUID `229xZjEoRB+aJeCc8MNYLD`。
- Creator 实例：`5543db93-8df6-42fe-96c5-702a09800275`。
- Bridge 合同 SHA-256：`b22e8ed50ba5b109745107c51ffe9591c1f5343a747ca0df723fda7340cee74c`。

## 工具发现与调用

仓库版 MCP 通过 stdio 完成 `initialize`、`notifications/initialized`、`tools/list` 和 `tools/call`。发现 8 个工具，其中 `cocos_cli_status` 返回 CLI 可用、版本 `0.1.0`，5 个 Creator 工具的描述和输入 schema 来自 CLI 命令目录。Creator 能力目录实际只报告以下 5 条命令可用：

| 命令 | 验收输入 | Creator 回执 |
| --- | --- | --- |
| `creator.project.info` | `instanceId=5543db93-8df6-42fe-96c5-702a09800275` | 请求 `20d67acc-887e-4681-b56d-7039e4cb0893`；`tank`、目标路径、Creator `2.4.15`、场景 `New Node` 与 UUID 均匹配 |
| `creator.project.search` | `query=cc.Class`, `scope=code`, `limit=10` | 请求 `9eb2c350-d657-4d5c-83b4-6cc1779109ae`；`total=0`，工程为空 |
| `creator.asset.search` | `query=CodexMcpAcceptanceTemp`, `limit=10` | 创建样本后请求 `871f1a08-6561-4d85-9351-8e78a735773f` 找到一条；清理后请求 `5d994f44-bf60-4fec-abb5-e273f38fd7c7` 返回 `total=0` |
| `creator.script.read` | `scriptPath=CodexMcpAcceptanceTemp.ts` | 请求 `8d1c9721-96d5-431d-8272-8d52a9f6d60b`；读取 Creator 生成的 TS、UUID、源码及 `.meta` 哈希 |
| `creator.scene.snapshot` | 目标实例 ID | 请求 `17449b7c-686d-487c-8843-ebbe8b8f0617`；场景 `New Node`，9 个默认节点，无脚本组件 |

同一运行实例上的请求按顺序执行。并发请求曾收到 `CREATOR_INSTANCE_BUSY`，顺序重试成功。

## CLI 与 MCP 回执对照

空工程没有脚本样本。通过 Creator 2.4.15 资源面板创建唯一临时样本 `assets/CodexMcpAcceptanceTemp.ts`，由 AssetDB 返回 UUID `861efce2-388d-4060-a089-452c646aa88b`，随后分别经 Codex MCP、独立 CLI 和仓库版 MCP 读取。三路 `scriptUuid`、`sourceSha256` 与 `metaSha256` 完全相同：

- `scriptUuid`：`861efce2-388d-4060-a089-452c646aa88b`
- `sourceSha256`：`b05efecbb7524a535f711eb128121bfb2dfce1ac577a99ca1bfb1c27f282db76`
- `metaSha256`：`34bfed423c8eb90a4b6f8ff099f1542e2fd3795adad8fb0588f62adb41aa31ab`

`script.read` 返回的是 Creator 命令回执；未用磁盘读取代替工具结果。

## 拒绝与恢复边界

- 不存在的合法 UUID `00000000-0000-4000-8000-000000000000`：Codex MCP 返回 `CREATOR_INSTANCE_NOT_FOUND`。
- 非法脚本路径 `../invalid.js`：Codex MCP 返回 `INVALID_INPUT_FIELD`。
- 临时样本清理后再读同路径：Creator MCP 返回 `ENOENT`。
- 使用错误合同指纹向本机 Bridge 发注册请求：HTTP `400 CREATOR_REGISTRATION_INVALID`。在 Creator 已连接时立即复测，注册前后实例 ID、工程路径和连接状态一致，证明错误注册不会替换有效实例。
- CLI 执行 `bridge stop` 后，使用 `bridge start` 重启。锁屏期间新 Bridge 的实例列表为空；Mac 解锁后，Creator 自动重新注册，原实例 ID、工程路径、Creator 版本与扩展版本均恢复。重启后通过 Codex MCP 再次执行 `project.info`、`capabilities`、`project.search`、`asset.search`、`scene.snapshot` 均成功。
- Creator 弹窗说明删除操作不可撤销；取得用户针对该临时样本的明确确认后，通过 Creator 资源面板删除。AssetDB 搜索回到 0 条，`script.read` 返回 `ENOENT`，恢复到创建样本前的资源基线。

## Codex Host 边界

用户要求重载 MCP 工具目录后，当前会话的 `ALL_TOOLS` 实际列出 8 项：`cocos_asset_search`、`cocos_capabilities_list`、`cocos_cli_status`、`cocos_instances_list`、`cocos_project_info`、`cocos_project_search`、`cocos_scene_snapshot`、`cocos_script_read`。通过本会话实际调用 `cocos_cli_status`，返回 `available=true`、CLI `0.1.0`、Creator `2.4.15`；实际调用 `cocos_instances_list`，确认 `tank` 项目路径 `/Users/youjunmao/WORK/Cocos_Engine/tank` 的 Creator 实例仍 `connected=true`。因此 Codex 当前会话已完成第 8 个工具的目录发现和调用验收。
