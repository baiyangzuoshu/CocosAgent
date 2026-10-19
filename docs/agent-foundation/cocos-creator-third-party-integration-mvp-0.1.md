# Cocos Creator 第三方 Host 接入实现 0.1

日期：2026-10-18（2026-10-19 更新验收）。范围：Codex / Claude Code → MCP/CLI → 本机桥接 → Creator 2.4.15 项目扩展。状态：**CLI 已拆为独立 npm 包；本地目录/tarball 安装、隔离升级、命令目录一致性及 MCP stdio 委托验收通过。Codex 插件与 Creator 2.4.15 实机握手、8 工具目录发现、CLI 状态调用及 5 条 Creator 只读命令已通过；Claude Code 尚未验收。** 本实现不调用或导入 Creator 原生 CocosAgent 的 Host、Provider、MCP 子进程、技能索引或操作账本。

## 目标链路

```text
Codex / Claude Code
  └─ 第三方插件
       ├─ Skills：路由 Creator 工作流、规定证据与验收步骤，并指导如何调用 CLI
       └─ MCP 适配器：向 Host 发现/公布工具，并把调用转给 CLI
                        ↓ machine-readable catalog / call
              独立安装与升级的本机 Cocos CLI
                ├─ 人、脚本、CI、Codex/Claude shell 自动化入口
                ├─ Creator 项目扩展安装与更新
                ├─ 本机桥接运维
                └─ 唯一命令合同、输入校验和命令执行入口
                        ↓
              本机第三方桥接服务（HTTP loopback，仅 127.0.0.1）
                        ↓ 令牌认证 + 长轮询命令/回执
              Creator 2.4.15 项目扩展主进程
                ├─ Creator Project / Editor API
                ├─ AssetDB
                └─ Scene Script（活动场景快照）
```

Codex portable `mcp.json` 与 Claude Code `.claude-plugin/plugin.json` 启动插件内 stdio MCP 适配器。目标架构下，MCP 适配器从独立 CLI 获取命令目录/schema，并通过 CLI 调用命令；CLI 启动或管理本机桥接。CLI 不依赖 Codex、Claude 或 Creator 原生 CocosAgent，可以单独供人、脚本和 CI 使用。Creator 扩展轮询每用户状态目录以建立会话。Host 必须先列出实例，再把明确的 `instanceId` 传给后续调用；服务不按前台窗口或“最近项目”猜目标。

## 源码职责

| 文件 | 职责 |
| --- | --- |
| `plugins/cocos-creator-agent/mcp.json` | Codex portable MCP 配置，运行本插件 `mcp/server.mjs` |
| `plugins/cocos-creator-agent/.claude-plugin/plugin.json` | Claude Code 插件清单及 MCP server 配置 |
| `plugins/cocos-creator-agent/mcp/server.mjs` | MCP initialize、tools/list、tools/call 与 stdio 输出；从独立 CLI 读取 catalog 并委托命令调用 |
| `plugins/cocos-creator-agent/skills/cocos2-cli/SKILL.md` | 指导 Codex / Claude 检查、安装和使用独立 CLI |
| `tools/cocos-creator-agent-cli/cli.mjs` | 独立 CLI：版本、catalog、桥接运维、扩展安装、实例/能力查询与 Creator 命令调用 |
| `tools/cocos-creator-agent-cli/bridge/` | loopback 桥接服务与客户端、合同加载、输入校验 |
| `tools/cocos-creator-agent-cli/creator-extension/` | Creator 2.4.15 扩展模板及其注册/命令实现 |
| `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` | CLI、桥接、MCP catalog 与 Creator 扩展共用的命令描述/schema；注册时比较 SHA-256 |

没有依赖原生 `tools/cocos-agent-bridge/` 的运行时代码或 2.4.15 NewProject 内的原生 Assistant 扩展文件。SDK Skills 仍保留在独立 `plugins/cocos-creator-agent-sdk/`，不影响此链路。

## CLI 与 MCP 的职责边界

CLI 的职责是提供**独立安装、独立升级、无 Host 依赖**的本机命令与自动化接口。Codex / Claude 插件里的 Skill 指导 Agent 使用这个 CLI；人、脚本和 CI 也能直接使用它。MCP 是 Codex / Claude 等 Host 的协议适配层，负责工具发现、schema 公布、工具调用和结果封装；目标实现通过 CLI 的机器接口读取同一命令目录并执行调用。

| 层 | 应负责 | 当前状态 |
| --- | --- | --- |
| CLI | 独立安装/升级；Creator 项目扩展安装/更新；桥接服务运维；终端与 CI 自动化；提供机器可读 catalog/call 接口 | 独立 npm 包 0.1.0 已从本地目录和 tarball 安装到隔离 prefix；复制为 0.1.1 后已在同 prefix 验证升级；尚未发布公共 registry/release installer |
| 第三方插件 Skills | 选择 Creator 工作流；指导 Codex / Claude 如何安装、更新及调用本机 CLI；规定验收流程 | 已有 `cocos2-cli` 与 Creator 工作流 Skills；Skill 提供本地源码安装路径；独立 CLI 的公开分发源尚未建立 |
| MCP | Host 握手、工具发现、schema 发布、工具调用和结果封装 | stdio server 是 CLI 子进程适配器，catalog/schema 从 CLI 获取，命令调用委托 CLI |
| 共享命令执行层 | 唯一 Creator 命令合同、schema、输入验证、实例身份校验、桥接调用和回执 | 由 CLI 包持有；MCP 从 CLI catalog/call 接口消费 |

CLI 可直接供 shell 使用，也可以提供 MCP 所需的机器接口。Codex / Claude 插件通过 Skill 教 Agent 在适合的工作流中使用 CLI；MCP 保留 Host 原生工具发现与调用体验。两者复用 CLI 持有的合同和执行层，不维护不同的命令语义。扩展/桥接生命周期属于 CLI；MCP 不承担项目扩展安装和升级。

**命令描述与输入 schema 已收敛：** `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` 是 Creator 命令描述及输入 schema 的唯一来源。桥接校验和能力目录从它读取；Creator 扩展注册时读取同一文件并以其 SHA-256 做合同指纹；MCP 从 CLI `catalog --format json` 生成工具描述与 `inputSchema`，只叠加 MCP 路由必需的 `instanceId`，保留 Host 工具名到 Creator 命令 ID 的薄映射；调用通过 CLI `call --command ... --input ... --format json` 执行。

### CLI 独立分发决策

目标是把 CLI 做成**独立安装和升级的本机工具**，类似 [Unity CLI](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli) 的产品边界；第三方 Codex / Claude 插件提供 Skill 教 Agent 发现并调用已安装 CLI，和 [Unity 第三方 Agent 插件](https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin)通过 Skill 提供 Unity 工作流的分工一致。CLI 即使没有 Codex、Claude 或 Creator 原生 CocosAgent，也应能用于人、脚本和 CI。第三方插件和 CLI 可独立升级，但必须通过明确的 CLI/命令合同兼容版本协作。

CLI 分发包应持有本机桥接运维、Creator 扩展安装/更新、命令合同和 Creator 命令执行能力，并提供稳定的机器接口，例如 `catalog --format json` 与 `call --command <id> --input <json> --format json`。MCP server 查询 catalog 生成 Host schema，将工具调用委托 CLI；CLI 是合同校验与 Creator 命令执行的单一入口。第三方插件包含专门的 CLI Skill，说明如何检查 CLI、安装/更新和调用，并将其与 `cocos2-mcp-tools` 的 Host 工具工作流区分开。

迁移次序与状态：

1. **已完成源码拆包：** CLI、bridge、Creator 扩展模板和唯一命令合同归入独立版本化 npm 包；包提供版本、安装和更新入口。
2. **已完成并验收：** CLI 提供机器可读 `catalog` / `call` 接口；catalog 与唯一合同一致，输出 JSON。
3. **已完成并验收：** 插件 MCP 使用 CLI subprocess 获取 catalog、状态和工具调用；插件不复制命令合同或 Creator 命令执行逻辑。
4. **已完成：** 第三方插件增加 CLI Skill，涵盖本地安装、更新、版本/实例检查、机器调用和故障定位。
5. **Codex + Creator 只读产品验收通过，Claude Host 待验收：** 隔离安装/升级、MCP subprocess、Codex 当前会话 8 工具发现与 `cocos_cli_status` 调用、Creator 2.4.15 实例握手及 5 条真实只读命令均有回执；详见两份验收轨迹。写入和运行闭环仍未实现。

本轮验收记录见[CLI 独立安装验收轨迹](traces/cocos-creator-cli-independent-install-acceptance-20261019.md)。公共 registry/release 更新路径仍未发布，因此当前用户需从源码仓库或本地打包文件安装 CLI；不能宣称已有公开分发的自助更新流程。新增写入、构建或运行控制命令，应等共享合同、CLI machine API、MCP 委托和权限/恢复合同一并设计完成后再进行。

## 命令合同

当前只有以下只读命令。每个输入均由共享合同校验；扩展只返回有限项目字段，所有调用必须带具体实例 ID。

| 命令 | Creator 侧来源 | 输出边界 |
| --- | --- | --- |
| `creator.project.info` | `Editor.Project.path`、`project.json`、Scene Script | 项目绝对路径/名称、Creator/扩展版本、活动场景身份 |
| `creator.project.search` | 已注册项目的 `assets/` 文件系统 | 不跟随符号链接；跳过隐藏目录和缓存；最多扫描 12,000 个文件及 32 MiB 代码；仅返回有界片段和 `.meta` 身份摘要 |
| `creator.asset.search` | `Editor.assetdb.queryAssets` | 只返回 `db://assets/` URL、UUID、类型和 importer；上限 100 项 |
| `creator.script.read` | 项目内 JS/TS 和匹配 `.meta` | 只接受 `assets/` 相对路径及 `.js`/`.ts`；检查 importer/UUID；单文件不超过 128 KiB；返回源与 meta SHA-256 |
| `creator.scene.snapshot` | Creator 2.4 Scene Script | 最多 100 节点、深度 6、名称与组件列表有界；不保存场景 |

MCP 工具为 `cocos_cli_status`、`cocos_instances_list`、`cocos_capabilities_list`、`cocos_project_info`、`cocos_project_search`、`cocos_asset_search`、`cocos_script_read`、`cocos_scene_snapshot`。CLI 用 `cocos-creator-agent --help` 查看相同操作。目录中未声明或编辑器未提供的命令拒绝调用。

## 配对与本机安全边界

- Creator 扩展只在报告版本精确为 2.4.15、项目身份有效且扩展版本/合同 SHA 匹配时注册。
- 服务只监听 IPv4 loopback，生成每次运行随机 bearer token，放在用户目录 `~/.cocos-creator-agent/third-party-bridge.json`；目录和状态文件权限限制为 `0700` / `0600`（系统支持时）。项目目录不保存桥接 token。
- HTTP 请求要求 bearer token、限制请求体大小、限制单实例并发命令。无效会话、旧合同、断连、实例忙和超时均有错误码；不自动重试写入，因为本版没有写入命令。
- CLI 的 `extension install --project-root <absolute-path>` 仅在显式调用时写入项目 `packages/cocos-creator-agent-extension/`，拒绝覆盖既有目录和经过符号链接的 `packages/` 路径。安装后仍须在 Creator 重载项目扩展。
- 目前所有命令都标注只读；Host 的 MCP 确认机制不能替代 Creator 侧逐次写入授权。服务不持有或转发模型凭据。

## 未实现与验收顺序

1. **Codex / tank 已完成：** 按工程身份规则核对目标实例；Creator 2.4.15 扩展版本 `0.1.0`、项目路径及实时 Bridge 实例一致。Codex MCP 发现 8 个工具；CLI 状态及 5 条只读 Creator 命令均有实际回执，桥接重启后实例恢复。完整回执见[Codex MCP 实机验收](traces/cocos-creator-mcp-codex-acceptance-20261019.md)。
2. **后续：** 在 Claude Code 导入插件，验收 MCP 启动、工具发现、实例配对、能力目录和只读命令；Codex 已完成部分不需重复作为未验收项。
3. 再设计 Creator 侧获批写入：操作前身份/前值校验、逐次审批、AssetDB/编辑器 API 调用、保存读回和 operation 账本。当前不存在 `script.create`、`script.patch` 或场景写入命令。
4. 之后设计预览会话归属、编译错误/Console、截图、同一会话输入和业务断言，再以 Creator 运行证据验证 Agent 修复闭环。
5. 补充取消/断连/重启、命令未决回执、扩展卸载和恢复冲突策略。

2026-10-19 已完成 CLI 独立包与 MCP 适配器验收：静态语法检查通过；CLI 0.1.0 从本地目录和 npm tarball 安装到隔离 prefix 后可在仓库外运行；`catalog` 的 5 条命令与合同一致；用临时 0.1.1 包在同 prefix 验证升级；MCP stdio 发现 8 个工具、脚本 schema 与 CLI 合同一致、状态读取显示当前安装版本；CLI 缺失时 MCP 仅公布基础工具并返回安装指引；tarball CLI 可向临时 Creator 项目安装扩展模板。

本节记录的是 CLI 独立包与隔离 MCP subprocess 验收；其模拟编辑器测试不能替代 Creator 实机证据。后续 Codex/Creator 实机握手、只读命令、Host 工具目录重载及 CLI 状态调用结果，见[Codex MCP 实机验收轨迹](traces/cocos-creator-mcp-codex-acceptance-20261019.md)。Claude Host、Creator 写入、运行预览和截图仍未验收，因此完整 Creator 工作流尚未通过验收。

2026-10-19 本机桥接负向协议检查及未完成项见[验收轨迹](traces/cocos-creator-third-party-boundary-check-20261019.md)。
