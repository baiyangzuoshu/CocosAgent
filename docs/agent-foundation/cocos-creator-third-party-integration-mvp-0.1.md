# Cocos Creator 第三方 Host 接入实现 0.1

日期：2026-10-18（2026-10-20 更新）。范围：Codex / Claude Code → MCP/CLI → 本机桥接 → Creator 2.4.15 项目扩展。状态：**只读链路已有历史 Creator 实机回执；脚本创建、单节点 `active` 写入、编译/Console 诊断、预览与同会话反馈已有源码接线，当前等待本轮 Creator 实机验收。CLI/Host 插件源码版本为 0.6.0，Creator 扩展为 0.4.0。** CLI 本地 tarball、SHA-256、从仓库旧版到 0.6.0 的隔离 npm 升级及本机 `doctor` 已通过；GitHub Release 未发布。Dashboard 对 `tank` 报告的路径与锁定路径不一致，故本轮停止项目工具调用。项目级只读工具注册与持久异步任务/恢复已有源码和本机测试，MCP Host 新目录、Claude Code、Creator 重启/取消恢复尚未验收。Creator 原生 CocosAgent 已停止并从仓库移除；本实现不依赖其历史 Host、Provider、MCP 子进程、技能索引或操作账本。详见[2026-10-20 CLI 差距计划验收](traces/cocos-creator-cli-gap-plan-acceptance-20261020.md)。

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
                        ↓ 仅用于已审批的 Web 预览会话
              隔离 Chromium + DevTools Protocol
                ├─ 浏览器 Console / 异常
                ├─ 同一会话有限输入与声明式断言
                └─ 截图证据（写入项目外）
```

Codex portable `mcp.json` 与 Claude Code `.claude-plugin/plugin.json` 启动插件内 stdio MCP 适配器。目标架构下，MCP 适配器从独立 CLI 获取命令目录/schema，并通过 CLI 调用命令；CLI 启动或管理本机桥接。CLI 不依赖 Codex、Claude 或 Creator 原生 CocosAgent，可以单独供人、脚本和 CI 使用。Creator 扩展轮询每用户状态目录以建立会话。Host 必须先列出实例，再把明确的 `instanceId` 传给后续调用；服务不按前台窗口或“最近项目”猜目标。

## 源码职责

| 文件 | 职责 |
| --- | --- |
| `plugins/cocos-creator-agent/mcp.json` | Codex portable MCP 配置，运行本插件 `mcp/server.mjs` |
| `plugins/cocos-creator-agent/.claude-plugin/plugin.json` | Claude Code 插件清单及 MCP server 配置 |
| `plugins/cocos-creator-agent/mcp/server.mjs` | MCP initialize、tools/list、tools/call 与 stdio 输出；从独立 CLI 读取 catalog 并委托命令调用 |
| `plugins/cocos-creator-agent/skills/cocos2-cli/SKILL.md` | 指导 Codex / Claude 检查、安装和使用独立 CLI |
| `tools/cocos-creator-agent-cli/cli.mjs` | 独立 CLI：版本/自更新、doctor、桥接运维、项目扩展生命周期、实例/能力查询与 Creator 命令调用 |
| `tools/cocos-creator-agent-cli/bridge/` | loopback 桥接服务与客户端、合同加载、输入校验 |
| `tools/cocos-creator-agent-cli/bridge/runtime-preview.mjs` | 独立 Chromium 预览会话、CDP Console/截图/输入与断言；会话绑定 Creator instance/session、工程和场景 UUID |
| `tools/cocos-creator-agent-cli/bridge/project-tools.mjs` | 发现并严格校验项目 `.cocos-agent/tools.json` 只读别名注册；拒绝脚本回调、写命令和自定义 schema |
| `tools/cocos-creator-agent-cli/bridge/task-store.mjs` | 在用户目录持久化异步任务输入、身份、状态、回执摘要与恢复轨迹 |
| `tools/cocos-creator-agent-cli/creator-extension/` | Creator 2.4.15 扩展模板及其注册/命令实现 |
| `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` | CLI、桥接、MCP catalog 与 Creator 扩展共用的命令描述/schema；注册时比较 SHA-256 |

没有依赖原生 `tools/cocos-agent-bridge/` 的运行时代码或 2.4.15 NewProject 内的原生 Assistant 扩展文件。SDK Skills 仍保留在独立 `plugins/cocos-creator-agent-sdk/`，不影响此链路。

## CLI 与 MCP 的职责边界

CLI 的职责是提供**独立安装、独立升级、无 Host 依赖**的本机命令与自动化接口。Codex / Claude 插件里的 Skill 指导 Agent 使用这个 CLI；人、脚本和 CI 也能直接使用它。MCP 是 Codex / Claude 等 Host 的协议适配层，负责工具发现、schema 公布、工具调用和结果封装；目标实现通过 CLI 的机器接口读取同一命令目录并执行调用。

| 层 | 应负责 | 当前状态 |
| --- | --- | --- |
| CLI | 独立安装/升级；Creator 项目扩展安装/状态/更新/卸载；桥接运维与只读诊断；终端和 CI 自动化；机器可读 catalog/call | CLI GitHub Release 打包与 checksum 工作流、`self-update`、扩展生命周期及 `doctor` 已实现；本地 0.6.0 tarball、SHA-256 和隔离 npm 升级已验收；线上 Release 尚未创建，远程 Git 凭据拒绝 |
| 第三方插件 Skills | 选择 Creator 工作流；指导 Codex / Claude 如何安装、更新及调用本机 CLI；规定验收流程 | 已有 `cocos2-cli` 与 Creator 工作流 Skills；Skill 提供本地源码安装路径；独立 CLI 的公开分发源尚未建立 |
| MCP | Host 握手、工具发现、schema 发布、工具调用和结果封装 | stdio server 是 CLI 子进程适配器，catalog/schema 从 CLI 获取，命令调用委托 CLI |
| 共享命令执行层 | 唯一 Creator 命令合同、schema、输入验证、实例身份校验、桥接调用和回执 | 由 CLI 包持有；MCP 从 CLI catalog/call 接口消费 |

CLI 可直接供 shell 使用，也可以提供 MCP 所需的机器接口。Codex / Claude 插件通过 Skill 教 Agent 在适合的工作流中使用 CLI；MCP 保留 Host 原生工具发现与调用体验。两者复用 CLI 持有的合同和执行层，不维护不同的命令语义。扩展/桥接生命周期属于 CLI；MCP 不承担项目扩展安装和升级。

**命令描述与输入 schema 已收敛：** `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` 是 Creator 命令描述及输入 schema 的唯一来源。桥接校验和能力目录从它读取；Creator 扩展注册时读取同一文件并以其 SHA-256 做合同指纹；MCP 从 CLI `catalog --format json` 生成工具描述与 `inputSchema`，只叠加 MCP 路由必需的 `instanceId`，保留 Host 工具名到 Creator 命令 ID 的薄映射；调用通过 CLI `call --command ... --input ... --format json` 执行。

### CLI 独立分发决策

目标是把 CLI 做成**独立安装和升级的本机工具**，类似 [Unity CLI](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli) 的产品边界；第三方 Codex / Claude 插件提供 Skill 教 Agent 发现并调用已安装 CLI，和 [Unity 第三方 Agent 插件](https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin)通过 Skill 提供 Unity 工作流的分工一致。CLI 即使没有 Codex、Claude 或 Creator 原生 CocosAgent，也应能用于人、脚本和 CI。第三方插件和 CLI 可独立升级，但必须通过明确的 CLI/命令合同兼容版本协作。

CLI 分发包应持有本机桥接运维、Creator 扩展安装/更新、命令合同和 Creator 命令执行能力，并提供稳定的机器接口，例如 `catalog --format json` 与 `call --command <id> --input <json> --format json`。MCP server 查询 catalog 生成 Host schema，将工具调用委托 CLI；CLI 是合同校验与 Creator 命令执行的单一入口。第三方插件包含专门的 CLI Skill，说明如何检查 CLI、安装/更新和调用，并将其与 `cocos2-mcp-tools` 的 Host 工具工作流区分开。

迁移次序与状态：

1. **源码拆包和本地安装已完成；GitHub Release 发布/更新实现待首发验收：** CLI、bridge、Creator 扩展模板和唯一命令合同归入独立版本化 npm 包；仓库现有 tag workflow 打包 tarball 与 SHA-256，CLI 可从 Release 检查和更新。
2. **已完成并验收：** CLI 提供机器可读 `catalog` / `call` 接口；catalog 与唯一合同一致，输出 JSON。
3. **已完成并验收：** 插件 MCP 使用 CLI subprocess 获取 catalog、状态和工具调用；插件不复制命令合同或 Creator 命令执行逻辑。
4. **已完成：** 第三方插件增加 CLI Skill，涵盖本地安装、更新、版本/实例检查、机器调用和故障定位。
5. **Codex + Creator 只读产品验收通过，Claude Host 待验收：** 隔离安装/升级、MCP subprocess、Codex 当前会话 8 工具发现与 `cocos_cli_status` 调用、Creator 2.4.15 实例握手及 5 条真实只读命令均有回执；详见两份验收轨迹。下面描述的写入能力是随后新增的仓库源码，尚无 Creator 运行时验收回执。

本地 CLI 安装与升级验收记录见[CLI 独立安装验收轨迹](traces/cocos-creator-cli-independent-install-acceptance-20261019.md)及[2026-10-20 CLI 差距计划验收](traces/cocos-creator-cli-gap-plan-acceptance-20261020.md)。当前已实现 GitHub Release 包装工作流、SHA-256 校验与 `self-update`；本地 tarball 与隔离全局升级已验收，但尚无 GitHub Release 资产，也没有真实下载/`self-update`线上升级回执。Creator 扩展安装清单、状态、漂移保护、强制前备份和卸载已在隔离项目验收。构建/编译机器接口、预览 smoke-test CLI 和异步任务等待已接入共享合同/CLI/MCP；Creator 实机行为仍需按工程身份规则验收。

## 命令合同

每个输入均由共享合同校验；所有调用必须带具体实例 ID。前五条只读命令有 2026-10-19 的 Creator 实机回执；后续写入、诊断、预览命令目前仅在仓库源码中实现，等待隔离工程实机验收。

| 命令 | Creator 侧来源 | 输出边界 |
| --- | --- | --- |
| `creator.project.info` | `Editor.Project.path`、`project.json`、Scene Script | 项目绝对路径/名称、Creator/扩展版本、活动场景身份 |
| `creator.project.search` | 已注册项目的 `assets/` 文件系统 | 不跟随符号链接；跳过隐藏目录和缓存；最多扫描 12,000 个文件及 32 MiB 代码；仅返回有界片段和 `.meta` 身份摘要 |
| `creator.asset.search` | `Editor.assetdb.queryAssets` | 只返回 `db://assets/` URL、UUID、类型和 importer；上限 100 项 |
| `creator.script.read` | 项目内 JS/TS 和匹配 `.meta` | 只接受 `assets/` 相对路径及 `.js`/`.ts`；检查 importer/UUID；单文件不超过 128 KiB；返回源与 meta SHA-256 |
| `creator.scene.snapshot` | Creator 2.4 Scene Script | 最多 100 节点、深度 6、名称与组件列表有界；不保存场景 |
| `creator.scene.node.read` | Creator Scene Script | 用活动场景 UUID 和节点 UUID 精确读取节点路径及 `active`；扫描上限 10,000 节点/深度 64，超过上限或 UUID 重复时拒绝 |
| `creator.scene.node.set-active.plan` | Creator Scene Script | 按当前活动场景 UUID 和目标节点 UUID 精确定位目标；扫描上限 10,000 节点/深度 64；记录节点路径及 `active` 前态、目标值和 15 分钟有效期；不改场景 |
| `creator.scene.node.set-active.commit` | Creator 原生确认 + Scene Script + `scene:stash-and-save` | 仅接受 operation ID/hash；审批后重查工程、Creator/扩展/合同、场景/节点 UUID、路径和前态；修改单节点 `active`，请求场景保存并从同一 Creator 会话回读 |
| `creator.scene.node.set-active.reconcile` | Creator Scene Script + 项目外 operation 日志 | 只读重查原节点状态并区分未应用、保存请求已发出、需手动保存或冲突；不重试写入。Creator 2.4 此保存 IPC 没有文档化的完成回执，因此不证明磁盘持久化 |
| `creator.script.create.plan` | Creator 扩展 + AssetDB | 校验 `assets/` 下既有父目录真实且无符号链接、JS/TS 目标不存在；保存 15 分钟有效的 operation 记录和 source hash；最大源码 16 KiB；不改项目资产或创建目录 |
| `creator.script.create.commit` | Creator 扩展原生确认框 + `Editor.assetdb.create` | 只接收 operation ID 与 plan hash；用户确认后再次核对工程/版本/合同、源 hash、目标文件与 `.meta` 均不存在；经 AssetDB 创建并从同一 Creator 进程读回 UUID/importer/源与 meta SHA-256 |
| `creator.script.create.reconcile` | Creator AssetDB 与同一资源回读 | 按原 operation ID 核对资源身份；仅读取并更新外部 operation 记录，不自动重试；目标漂移转为 conflict |
| `creator.diagnostics.read` | Creator `Editor.Builder`、`Editor.Ipc` 事件 | 回读编译事件、脚本导入失败与 Creator Console 的有界序列；只有错误日志能证实错误，`compile-finished` 本身不证明成功 |
| `creator.preview.start` | 原生 Creator 确认 + `scene:play-on-device`，桥接管理隔离 Chromium | 原生批准后请求 Web 预览；桥接校验工程、Creator instance/session、场景名/UUID，再启动 loopback 页面并返回 `previewSessionId` |
| `creator.preview.observe` | 桥接 CDP → Agent 所有的浏览器页 | 仅读该 session 的页面、场景、canvas、浏览器 Console/异常和序列游标 |
| `creator.preview.screenshot` | 桥接 CDP `Page.captureScreenshot` | PNG 写入用户数据目录，返回 session/场景身份、路径和 SHA-256；不写项目资源 |
| `creator.preview.interact` | 桥接 CDP 有限输入 + 声明式断言 | 最多 12 个白名单按键（每键 1–2000 ms）/归一化 canvas 点击；断言限运行错误、Console marker、scene identity、节点存在、active/x/y 与组件简单字段 |
| `creator.preview.refresh` | 同一个 CDP target/session | 刷新现有页面，再确认场景名/UUID仍一致；保留原 `previewSessionId` |
| `creator.preview.stop` | 桥接管理的 Chromium 子进程 | 关闭 Agent 创建的窗口并删除隔离浏览器 Profile；Creator 自己启动的浏览器和 Preview Server 不在此工具控制范围 |

### 项目级工具注册

工程可声明 `.cocos-agent/tools.json`，每项含唯一 kebab-case `id`、`title`、`description` 和既有 `commandId`。`project-tools list` / `cocos_project_tools_list` 按当前 Creator 实例重新读取注册文件并返回 SHA-256、内置 schema 与映射命令；`project-tools call` / `cocos_project_tool_call` 先解析别名，再走同一命令校验和 Creator 回执。

V1 注册表最多 64 KiB/64 项，只允许映射到既有 Creator 只读命令，输入 schema 直接继承命令合同。注册表是数据，不能执行项目脚本、扩展回调或 SDK，也不能增加写权限。标题/描述和项目回执均按不可信项目数据处理，MCP 工具定义不直接把它们作为指令文本。符号链接、未知字段、重复 ID、未知命令和非只读命令均拒绝。项目级 Skills 仍由 Host 按工作流读取，不会因为出现在项目中就获得工具授权。

### 异步任务与中断恢复

`tasks start` / `cocos_tasks_start` 接收一个已知命令及合同校验过的输入，立即返回 task ID。任务状态、身份、原输入和有界事件轨迹原子写到 `~/.cocos-creator-agent/tasks/<taskId>.json`（目录/文件权限 `0700`/`0600`）；status 响应不暴露原输入，只返回 SHA-256、事件和完成结果。`tasks wait` / `cocos_tasks_wait` 可按 `eventSequence` 等待下一条持久状态事件，最长 30 秒；超时返回当前进度。每个 Creator 实例仍只允许一个活跃命令/任务。

取消采用协作语义：排队且尚未派发的任务可直接取消；派发后的任务会标记 request 已取消，Creator 原生授权检查会拒绝迟到审批，但无法撤回已经通过审批并开始的写入。脚本创建和节点 `active` 提交分别恢复到对应 reconcile 命令，不重放写入。若结果不确定，状态为 `needs-reconciliation`，不会声称已回滚。

桥接启动时把遗留 `queued`/`running`/`cancel-requested` 转成中断状态，不自动重放。只读命令可以显式 resume；脚本创建 commit 通过原 `operationId` 调用只读 reconcile；其他已派发的 plan/write/control 必须人工核对，不提供自动重试。恢复前校验相同项目绝对路径、CLI/Creator/扩展版本、合同指纹和明确的当前实例 ID。

MCP 当前源码定义 30 个固定工具（3 个基础、19 个合同 Creator 命令、2 个项目工具和 6 个任务生命周期工具）；另在 `tools/list` 时最多为在线工程发现 103 个具名项目只读别名。别名按工程路径指纹命名，工具 schema 继承映射命令合同，调用时重核工程实例和注册哈希。`cocos_tasks_wait` 已加入源码，但尚未在 Codex Host 重载验收；CLI 等待接口有本机桥接集成测试。CLI 用 `cocos-creator-agent catalog` 查看 Creator 共享合同；目录中未声明的输入会拒绝，桥接侧能力目录按 Creator API 与本机 Chromium 可用状态报告。

## 配对与本机安全边界

- Creator 扩展只在报告版本精确为 2.4.15、项目身份有效且扩展版本/合同 SHA 匹配时注册。
- 服务只监听 IPv4 loopback，生成每次运行随机 bearer token，放在用户目录 `~/.cocos-creator-agent/third-party-bridge.json`；目录和状态文件权限限制为 `0700` / `0600`（系统支持时）。项目目录不保存桥接 token。
- HTTP 请求要求 bearer token、限制请求体大小、限制单实例并发命令。无效会话、旧合同、断连、实例忙和超时均有错误码；写入和获准操作不会自动重试。
- CLI 的 `extension install --project-root <absolute-path>` 仅在显式调用时写入项目 `packages/cocos-creator-agent-extension/`，拒绝覆盖既有目录和经过符号链接的 `packages/` 路径。安装后仍须在 Creator 重载项目扩展。
- 写入审批在 Creator 侧由 `Editor.Dialog.messageBox` 实现，Host MCP 对 commit 同时标注为 destructive。Creator 只接受与保存 plan 完全匹配的 operation ID/hash，用户批准后再执行前态复验。Host 的提示/确认元数据不能单独替代 Creator 确认框。
- Creator 在弹框关闭后先向桥接核对原 commit 请求是否仍处于活动状态；CLI/Host 断开或请求超时后，晚到的“创建”点击不会继续写入。操作状态保持可 reconcile，不会自动重试。
- Operation 记录和待提交源码保存在项目外 `~/.cocos-creator-agent/creator-operations/`，目录/文件权限为 `0700` / `0600`；记录绑定项目绝对路径、Creator/扩展/合同版本、operation ID、目标 URL、原态、源 SHA-256、状态和恢复条件。目标资产仍必须由 Creator AssetDB 创建；CLI/MCP 不直接写 `assets/`、`.meta` 或场景序列化文件。
- 当前写入覆盖**创建一个 JS/TS 资源**和**修改活动场景一个既有节点的 `active` 属性**；不挂载组件、不提供自动删除/反向修改补偿命令。脚本回执含资源 URL、UUID、importer、源/`.meta` 哈希；节点回执含场景/节点 UUID、路径、前后态和保存请求状态。Creator/桥接超时后必须用原 operation ID reconcile；不会自动重试。场景保存 IPC 没有文档化完成确认，节点回执不等于磁盘持久化证明。
- 服务不持有或转发模型凭据。
- 预览启动在 Creator 原生确认后调用官方 `scene:play-on-device` IPC；随后桥接启动独立 Chromium 并绑定活动场景名/UUID。运行时需同时匹配 Creator 提供的 `preview-scene.json` 中场景资源 UUID/名称及游戏根场景名；不匹配或无完整来源就拒绝会话。Chromium 只访问 loopback HTTP 预览，不接收任意 URL。浏览器 Console、异常、截图和输入均绑定 `previewSessionId`；输入限制为 12 个白名单键（每键 1–2000 ms）或 canvas 归一化点击，断言限制为 Console、场景、节点 active/x/y、节点存在及组件简单数据字段。
- `creator.preview.stop` 仅关闭 Agent 创建的 Chromium 窗口，不会假称关闭 Creator 预览服务；Creator 原生启动的默认浏览器页仍由 Creator/用户控制。截图放在 `~/.cocos-creator-agent/captures/`，并返回路径和 SHA-256，不写项目资源目录。
- 诊断工具收集 Creator Builder 的 `compile-finished`/`build-finished` 事件、脚本导入失败及 Creator Console renderer 消息。未知事件载荷按有界字段回读；“收到 compile-finished”不等于“构建成功”。

实现依据：Creator 2.4 的[扩展资源管理文档](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management.html)说明用 `Editor.assetdb.create` 创建资源和 `scene:stash-and-save` 保存场景；[Scene Script 文档](https://docs.cocos.com/creator/2.4/manual/en/editor/extension/scene-script.html)说明可遍历和修改场景节点；[主进程 `Editor.Dialog` API](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/editor-framework/main/dialog.html)提供原生消息确认框；[Builder API](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/editor-framework/main/builder.html)定义 `compile-finished`/`build-finished` 事件；Creator 2.4 的[浏览器预览](https://docs.cocos.com/creator/2.4/manual/en/editor/preview/browser.html)说明预览控制面。当前新增写入、构建/Console 订阅及预览控制代码仍待 Creator 2.4.15 实机验证。

## 当前状态与后续开发计划

### 当前基线

- 产品边界：`plugins/cocos-creator-agent/` 是 Codex / Claude Code 第三方插件；`tools/cocos-creator-agent-cli/` 是独立本机 CLI；Creator 原生 CocosAgent 已停用并移除，不属于当前产品或运行依赖。
- 仓库源码版本：第三方 Host 插件 `0.6.0`、独立 CLI `0.6.0`、Creator 项目扩展 `0.4.0`；历史实机回执来自先前只读版本。当前 Creator 命令合同只支持 `2.4.15`，CLI 需要 Node.js 20+；预览证据需要本机 Chromium。
- Skills：主插件有 51 项 Creator 工作流 Skills 和 1 项 `cocos2-cli` 操作 Skill，共 52 项；5 项厂商 SDK Skills 单独放在可选包 `plugins/cocos-creator-agent-sdk/`。
- MCP：历史实机验收发现 8 个工具；CLI 可用时当前源码提供 30 个固定工具，并按在线项目注册动态追加最多 103 个具名只读别名；`cocos_tasks_wait` 尚未在 Codex Host 重载验收。CLI 不可用时保留静态基础工具入口并报告安装提示，Creator 命令工具不发布。
- Creator 命令：5 条只读命令有历史真实回执；当前源码再提供精确节点读取、脚本创建计划/提交/恢复、单节点 active 状态计划/提交/恢复、Creator 编译与 Console 诊断、批准启动 Web 预览及浏览器截图/观察/同会话输入断言。项目工具别名限定为只读命令；异步任务持久化并支持取消与显式恢复。以上新增能力目前只有源码接线与静态检查，不能称为实机通过。
- 已验收：CLI 本地 tarball 的包清单、SHA-256、从旧版 `0.1.0` 隔离升级到 `0.6.0`、本机 `doctor`、8 项 CLI 自动化/loopback 集成测试（含项目工具 MCP 发现调用、取消和重启恢复）；此前已有合同/schema 一致性、隔离扩展生命周期、Codex 旧版 8 工具与 tank 只读实机回执。当前 Codex MCP `cocos_cli_status` 报告 `0.6.0`，但新 MCP 工具目录尚未在 Host 重载。Creator 本轮写入/运行验收因 Dashboard 的 `tank` 路径不一致而停止；Claude Code Host 和线上 Release 尚未验收。回执见[CLI 验收](traces/cocos-creator-cli-independent-install-acceptance-20261019.md)、[Codex MCP 验收](traces/cocos-creator-mcp-codex-acceptance-20261019.md)、[桥接边界检查](traces/cocos-creator-third-party-boundary-check-20261019.md)和[本轮差距计划验收](traces/cocos-creator-cli-gap-plan-acceptance-20261020.md)。

### 阶段计划

**P1：完成第三方 Host 与分发基线（可与 Creator 功能开发并行）**

- 在 Claude Code 安装插件，验证 MCP 启动、新源码 30 工具目录、实例配对及只读命令；验证 Skills 能选中路由/专项 Skill 和 `cocos2-cli`，不把 Skill 正文当成工具授权。
- 推送 `cocos-creator-agent-cli-v<VERSION>` 标签，验收 Release tarball 与 SHA-256 资产、CLI 自更新检查/安装和回滚到指定版本；本地 0.6.0 发布包与隔离升级已过，线上步骤因 Git 远程凭据拒绝仍未完成。
- 在隔离 Creator 项目验收扩展安装清单、状态、无漂移更新/卸载、用户修改拒绝、`--force` 备份，以及 `doctor` 对路径、版本、桥接和能力目录的诊断。锁定 CLI、插件、Creator 扩展和合同指纹的兼容规则。
- 验收条件：Codex 和 Claude 的工具/schema 一致；CLI 缺失、版本不兼容、Creator 断连时均给出可诊断错误，且不猜测目标工程。

**P2：Creator 写入最小闭环（源码实现资源创建与单节点 active 修改，运行验收受工程身份阻塞）**

- 已实现源码切片：脚本资源创建；活动场景中一个既有节点的 `active` 属性修改。两者都先生成 operation ID/hash 和前态，Creator 原生确认后重核目标；节点修改经 Scene Script 应用，调用 `scene:stash-and-save` 并回读内存状态，项目外日志支持 reconcile。场景保存 IPC 无文档化的完成回执，故当前实现不声称磁盘持久化验证。
- 尚未完成：Dashboard 对 tank 的路径显示 `/Users/youjunmao/WORK/Cocos_Engine`，与锁定的 `/Users/youjunmao/WORK/Cocos_Engine/tank` 不符，故本轮不打开、不调用工具；真实 Creator 2.4.15 重载与新 MCP 目录验收；取消、目标漂移、桥接/Creator 重启等负向与恢复验收；场景保存结果的可靠确认/磁盘回读；自动补偿命令；后续组件挂载与场景组件引用核验。
- 验收条件：未点 Creator 确认不产生项目差异；点确认后身份回执与读回哈希一致；已有目标或合同不符时拒绝；取消不写入；中断后仅通过原 operation ID reconcile，不重放不确定写入。不得把源代码检查说成实机通过。

**P3：运行反馈与同会话复验（源码接线完成，Creator 实机验收受工程身份阻塞）**

- Creator 扩展通过 Builder 与 Editor Console/AssetDB 事件维护有界诊断序列。诊断回执包含来源、时间、序列游标；编译结束事件不代表成功，需查看具体失败日志/导入失败。
- 经 Creator 原生确认后，`scene:play-on-device` 请求预览；桥接启动单独隔离的 Chromium，并校验运行场景名与 UUID 后返回 `previewSessionId`。本地浏览器需要 Chromium，可配置 `COCOS_CREATOR_AGENT_BROWSER`。
- 同会话支持 Console/运行状态读取、PNG 截图、refresh、有限键盘和 canvas 点击，以及 scene/node/Console 声明式断言。刷新不创建新 session ID；失去 Creator session 或场景 UUID 对不上时拒绝。
- **待实机验收：** Creator default preview 窗口与独立 Chromium 的打开行为、编译错误/Console 事件形状、渲染和截图质量、同会话输入效果、项目网络副作用边界、浏览器退出/Creator 重启/桥接重启后的清理。`preview.stop` 只停 Agent 浏览器，Creator 预览服务不会被扩展关闭。
- 验收条件：日志/截图/断言都绑定同一 Creator 实例、场景和浏览器会话；没有浏览器回执时不报告功能通过。

**P4：项目级 Skills 与工具扩展（只读工具注册已接源码）**

- 已实现源码：`.cocos-agent/tools.json` 注册只读命令别名；CLI/MCP 发现时返回注册哈希和继承自合同的输入 schema；调用重新读注册并走 Creator live capability。无回调执行、无自定义 schema、不能注册写入。
- 待扩展/验收：项目 Skill 的可信来源与版本/哈希、Claude/Codex 按需加载；在 LinkUpClient/tank 声明代表性只读别名，验证注册变化立刻反映、无效注册/未知 ID/越权命令拒绝。
- 验收条件：项目约定可按需读取并核对来源；陈旧哈希、未知工具、未声明输入均拒绝；项目 Skill 不能扩大 Host 或 Creator 授权。

**P5：任务审阅、checkpoint 与恢复（异步任务骨架已接源码）**

- 已实现源码：用户目录持久任务日志、task ID/status/events、排队取消、派发后协作取消；桥接重启时转中断；只读任务显式 resume；脚本创建 commit 只按原 operation ID reconcile；其他未决写/控件操作进入 `needs-reconciliation` 且不重放。
- 待扩展/验收：Creator 断连、Host 取消通知、桥接强杀/重启、任务记录损坏、同项目不同实例恢复、写入审批中断和结果冲突；与源代码/场景/资源差异审阅及 checkpoint 汇总衔接。
- 验收条件：每个中断点可看到任务身份和副作用确定性；可证明安全时才恢复，其他情况不重放且不会覆盖后续修改。

**P6：Tank 真实功能验收**

- 从当前空 tank 工程完成首个可玩切片：简化战场、玩家坦克移动与发射、击中固定目标显示结果、重开；不依赖美术或厂商 SDK。
- 记录每一步是否由 Agent 独立完成、工具/Skill 缺口、人工介入次数、耗时、编译/运行证据及中断恢复结果。该实测才用于判断是否扩展到完整小游戏。

### 已完成的 2026-10-19 验收

CLI 独立包从本地目录与 tarball 安装到隔离 prefix，在同一 prefix 验证升级；MCP 从 CLI 获取唯一命令目录/schema 并委托调用。Codex 与 tank Creator 2.4.15 的只读实机链路已通过，Creator 临时脚本样本已删除并恢复资源基线。完整回执见上方三份轨迹。此阶段未运行写入、预览控制或游戏行为验收。
