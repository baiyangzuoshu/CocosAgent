# Cocos Creator 第三方 Host 接入实现 0.1

日期：2026-10-18（2026-10-20 更新）。范围：Codex / Claude Code → 独立 CLI（MCP 配置与 Skills 安装）→ 本机桥接 → Creator 2.4.15 项目扩展。状态：**CLI 0.9.0 与 Creator 扩展模板 0.6.0 的源码、32 项自动化测试、本机 tarball、SHA-256、隔离安装和从 0.6.0 到 0.9.0 的本地升级均已通过；`cocos-creator-agent-cli-v0.9.0` 标签已推送，GitHub Actions/Release 资产状态因仓库 API 返回 404 尚未核实。**共享 Creator 合同新增项目扩展命令发现及按 read/plan/write/control 分级调用。项目扩展通过声明式 schema 和 Creator 主进程 IPC 握手提供实时命令；write/control 在 Creator 内原生审批，并在审批后重新核对 provider 指纹。该能力不隔离项目扩展代码，声明的 access 是合同而非沙箱保证。当前 Codex 配置仍指向旧插件 MCP，CLI 报告配置不一致；Claude 当前没有 MCP server 配置。真实桌面 Host 重载、Creator 2.4.15 Provider IPC/审批、写入/预览/运行验收仍待完成。Dashboard 当前显示 `tank` / Creator 2.4.15 / 已打开，但路径栏为 `/Users/youjunmao/WORK/Cocos_Engine`，与本轮锁定的 `/Users/youjunmao/WORK/Cocos_Engine/tank` 不一致，因此未进入编辑器或调用项目命令。UI 事件、资源引用和对象/数组属性写入尚未实现。Creator 原生 CocosAgent 已停止并从仓库移除；本实现不依赖其历史 Host、Provider、MCP 子进程、技能索引或操作账本。详见[0.9.0 CLI 验收轨迹](traces/cocos-creator-cli-0.9.0-package-acceptance-20261020.md)、[CLI 差距计划验收](traces/cocos-creator-cli-gap-plan-acceptance-20261020.md)、[CLI 0.8.0 MCP 与 Skills 验收](traces/cocos-creator-cli-0.8.0-mcp-skills-acceptance-20261020.md)、[watch/项目工具后续](traces/cocos-creator-cli-watch-project-tools-followup-20261020.md)及[扩展命令 Provider 合同](../../tools/cocos-creator-agent-cli/references/2x/13-agent-command-providers.md)。

## 目标链路

```text
Codex / Claude Code
  ├─ MCP 客户端原生配置 ← cocos-creator-agent mcp configure
  └─ Codex/Claude 原生 Skill 目录 ← cocos-creator-agent skill install/refresh
                        ↓ stdio MCP
              独立安装与升级的本机 Cocos CLI
                ├─ 内置 MCP server 与 Host 配置管理
                ├─ 打包 Creator Skills 与匹配的 Creator 2.4.15 参考资料
                ├─ 人、脚本、CI、Codex/Claude shell 自动化入口
                ├─ Creator 项目扩展安装与更新、本机桥接运维
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

`mcp configure` 通过 Codex / Claude Code 的原生命令注册 CLI 的 `mcp serve`；MCP server、命令 catalog 与 Creator 调用都由 CLI 包持有。`skill install` 将 CLI 包内路由/专项 Skills 和参考资料装入客户端原生 Skill 目录；可按 Skill 选择、项目/用户作用域安装、预览、刷新和冲突备份。仓库保留的 `plugins/cocos-creator-agent/` 只提供旧式插件安装场景的 CLI 引导 Skill，不承载 MCP server 或 Creator 工作流 Skill 正文。CLI 不依赖 Codex、Claude 或 Creator 原生 CocosAgent，可以单独供人、脚本和 CI 使用。Creator 扩展轮询每用户状态目录以建立会话。Host 必须先列出实例，再把明确的 `instanceId` 传给后续调用；服务不按前台窗口或“最近项目”猜目标。

## 源码职责

| 文件 | 职责 |
| --- | --- |
| `tools/cocos-creator-agent-cli/mcp/server.mjs` | CLI 自带 MCP initialize、tools/list、tools/call 和 stdio 服务 |
| `tools/cocos-creator-agent-cli/mcp/configure.mjs` | 通过 Codex/Claude 原生命令安装、检查、移除 CLI MCP 配置，并拒绝同名漂移覆盖 |
| `tools/cocos-creator-agent-cli/skills.mjs` | 展示、安装、刷新 Creator Skills；检查目标漂移并为强制替换保留备份 |
| `tools/cocos-creator-agent-cli/skills/` | CLI 发布包内的路由与专项 Creator Skills；唯一维护源 |
| `tools/cocos-creator-agent-cli/references/2x/` | 随 CLI Skills 分发的 Creator 2.4.x 参考资料 |
| `plugins/cocos-creator-agent/skills/cocos2-cli/SKILL.md` | 旧式插件安装用户的 CLI 配置引导；不含 MCP server 或领域 Skill 正文 |
| `tools/cocos-creator-agent-cli/cli.mjs` | 独立 CLI：版本/自更新、MCP/Skill 配置、doctor、桥接运维、项目扩展生命周期、实例/能力查询与 Creator 命令调用 |
| `tools/cocos-creator-agent-cli/bridge/` | loopback 桥接服务与客户端、合同加载、输入校验 |
| `tools/cocos-creator-agent-cli/bridge/runtime-preview.mjs` | 独立 Chromium 预览会话、CDP Console/截图/输入与断言；会话绑定 Creator instance/session、工程和场景 UUID |
| `tools/cocos-creator-agent-cli/bridge/project-tools.mjs` | 发现并严格校验项目 `.cocos-agent/tools.json` 合同命令别名；拒绝脚本回调、未审批副作用和自定义 schema |
| `tools/cocos-creator-agent-cli/creator-extension/provider-contract.cjs` | 验证 Creator 项目扩展命令 Provider 的 ID、schema 子集、审批声明和参数；由 Creator 扩展与 CLI 共用 |
| `tools/cocos-creator-agent-cli/bridge/task-store.mjs` | 在用户目录持久化异步任务输入、身份、状态、回执摘要与恢复轨迹 |
| `tools/cocos-creator-agent-cli/creator-extension/` | Creator 2.4.15 扩展模板及其注册/命令实现 |
| `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` | CLI、桥接、MCP catalog 与 Creator 扩展共用的命令描述/schema；注册时比较 SHA-256 |

没有依赖原生 `tools/cocos-agent-bridge/` 的运行时代码或 2.4.15 NewProject 内的原生 Assistant 扩展文件。SDK Skills 仍保留在独立 `plugins/cocos-creator-agent-sdk/`，不影响此链路。

## CLI 与 MCP 的职责边界

CLI 的职责是提供**独立安装、独立升级、无 Host 依赖**的本机命令与自动化接口，并像 Unity CLI 一样拥有 MCP server、`mcp configure`、Skill 清单及 `skill install/refresh/show`。Codex / Claude 的插件不再负责启动 MCP server 或分发领域 Skills；可选 bootstrap 插件只教用户如何调用 CLI。人、脚本和 CI 仍能直接使用 CLI。Host MCP 是 CLI 暴露的 stdio 协议入口，负责工具发现、schema 公布、工具调用和结果封装；工具目录与执行均由 CLI 内的同一命令合同驱动。

| 层 | 应负责 | 当前状态 |
| --- | --- | --- |
| CLI | 独立安装/升级；内置 MCP server 与 Codex/Claude `mcp configure`；打包 Skills 并提供 `skill install/refresh/show/list`；Creator 扩展安装/更新、桥接运维、终端/CI 自动化、catalog/call | 0.9.0 当前源码 32 项测试、90 项 tarball 文件、SHA-256、隔离安装、0.6.0→0.9.0 本地升级、版本/Skills/命令目录均通过。0.9.0 标签已推送，Actions/Release 资产状态未核实；在线自更新、真实桌面 Host 重载、Creator 实机链路仍待完成 |
| 旧式第三方插件 | 只提供 CLI 配置引导 Skill；不提供 MCP server，不维护领域 Skills | 已收缩为 `cocos2-cli` 引导；Codex/Claude 清单移除插件内 MCP 注册 |
| MCP | Host 握手、工具发现、schema 发布、工具调用和结果封装 | stdio server 随 CLI 发布，由 CLI `mcp serve` 启动并直接读取本包合同；`mcp configure` 调用 Host 原生命令注册 |
| 共享命令执行层 | 唯一 Creator 命令合同、schema、输入验证、实例身份校验、桥接调用和回执 | 由 CLI 包持有；MCP 从 CLI catalog/call 接口消费 |

CLI 可直接供 shell 使用，也提供 Host MCP 所需的机器接口。Codex / Claude 客户端从 CLI 安装 Creator 工作流 Skills，并由 CLI 配置自己的 MCP server；可选 bootstrap 插件只用于迁移/引导。MCP 与直接 CLI 调用复用 CLI 持有的合同和执行层，不维护不同的命令语义。扩展/桥接生命周期属于 CLI。

**命令描述与输入 schema 已收敛：** `tools/cocos-creator-agent-cli/creator-extension/command-contract.json` 是 Creator 命令描述及输入 schema 的唯一来源。桥接校验和能力目录从它读取；Creator 扩展注册时读取同一文件并以其 SHA-256 做合同指纹；MCP 从 CLI `catalog --format json` 生成工具描述与 `inputSchema`，只叠加 MCP 路由必需的 `instanceId`，保留 Host 工具名到 Creator 命令 ID 的薄映射；调用通过 CLI `call --command ... --input ... --format json` 执行。

### CLI 独立分发决策

目标是把 CLI 做成**独立安装和升级的本机工具**，按 [Unity CLI 的 MCP/Skill 安装模型](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)提供 `mcp configure`、CLI 内 MCP server、`skill install/refresh/show/list`。Creator Skills 与参考资料随 CLI 版本打包，Skill 安装不依赖 Host 插件市场。CLI 即使没有 Codex、Claude 或 Creator 原生 CocosAgent，也能用于人、脚本和 CI。兼容性引导插件可独立更新，但不能复制 MCP server、Creator Skills 或合同。

CLI 分发包应持有本机桥接运维、Creator 扩展安装/更新、命令合同、Creator 命令执行、stdio MCP server、客户端 MCP 配置适配器和 Creator Skills 源。`skill install` 依客户端原生布局安装用户/项目技能，`mcp configure` 通过 Codex/Claude 原生命令写入服务器配置；`catalog --format json` 和 `call --command <id> --input <json> --format json` 仍是内部稳定机器接口。可选 bootstrap 插件只说明如何安装/升级 CLI、安装 Skills 和配置 MCP。

迁移次序与状态：

1. **源码拆包和本地包验收已完成；正式发布待完成：** CLI、MCP、Creator Skills/参考资料、bridge、Creator 扩展模板和唯一命令合同都归入独立版本化 npm 包；0.8.0 tarball 已在本机打包、校验 SHA-256 并安装到隔离 prefix。GitHub Release 尚未发布，`self-update` 的线上下载/升级/回滚尚未验收。
2. **历史完成并验收：** CLI 提供机器可读 `catalog` / `call` 接口；catalog 与唯一合同一致，输出 JSON。
3. **架构已改为 CLI 原生拥有 MCP：** 旧版本插件 MCP 调用 CLI 的历史实现不再是目标；当前 server 已移入 CLI，Codex/Claude 清单不再启动插件内 MCP。
4. **CLI Skill 包及安装器已在本机包验收：** 当前 52 项 Skills/参考资料唯一维护源位于 CLI 发布目录；从隔离安装的 tarball 安装全部 Skills 并检查相对参考资料链接成功。可选 bootstrap 插件仅保留安装引导内容。
5. **Host 原生 CLI 配置已验收，桌面 Host/Creator 仍待验收：** 使用真实 Codex 与 Claude Code CLI、隔离用户目录完成 configure/status/remove；CLI 0.8.0 MCP server 与 Skill 安装包本机验收通过。尚未重载桌面 Host、确认运行时工具目录或连接 Creator 实例；旧 MCP/Creator 只读回执不能替代新架构实机回执。写入能力仍无 Creator 运行时验收回执。

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
| `creator.scene.node.read` | Creator Scene Script | 用活动场景 UUID 和节点 UUID 精确读取节点路径、`active`、最多 32 个组件类名与当前会话对象 ID；扫描上限 10,000 节点/深度 64，超过上限或 UUID 重复时拒绝 |
| `creator.scene.node.add-component.plan` / `commit` / `reconcile` | Creator 类注册表 + Scene Script + 原生审批 + 项目外 operation 日志 | 计划绑定活动场景、节点 UUID/路径、Creator 注册组件类和前态数量；拒绝未知类、非组件类、已有实例及隐式 `requireComponent`；提交经 Creator 审批后添加一个组件并读回对象 ID、请求保存；恢复只观察，不重放 |
| `creator.scene.node.set-component-property.plan` / `commit` / `reconcile` | Creator Scene Script + 原生审批 + 项目外 operation 日志 | 计划绑定同一扩展会话中的组件对象 ID、公开序列化标量属性及其前值；只允许 `string` / `number` / `boolean`；拒绝继承/内部字段、对象/数组/资源引用和类型改变；提交审批后设置并读回，恢复不重放 |
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

### 项目级工具注册与 Editor 扩展命令

工程可声明 `.cocos-agent/tools.json`，每项含唯一 kebab-case `id`、`title`、`description` 和既有 `commandId`。`project-tools list` / `cocos_project_tools_list` 按当前 Creator 实例重新读取注册文件并返回 SHA-256、内置 schema 与映射命令；`project-tools call` / `cocos_project_tool_call` 先解析别名，再走同一命令校验和 Creator 回执。注册表可以映射 `read` / `plan` 命令；映射到 `write` / `control` 的命令必须在共享合同中声明 Creator 原生审批。MCP 给写别名 destructive 标注，并在工具定义中忽略项目提供的标题和描述。

V1 注册表最多 64 KiB/64 项，只允许映射到既有 Creator 合同命令，输入 schema 与访问/审批属性直接继承命令合同。注册表是数据，不能执行项目脚本、扩展回调或 SDK，也不能放宽权限；无 Creator 原生审批的 `write` / `control` 命令拒绝注册。标题/描述和项目回执均按不可信项目数据处理，MCP 工具定义不直接把它们作为指令文本。符号链接、未知字段、重复 ID、未知命令和越权命令均拒绝。项目级 Skills 仍由 Host 按工作流读取，不会因为出现在项目中就获得工具授权。

Creator 项目还可安装独立 Editor 扩展命令 Provider：在扩展 `package.json` 声明 Creator 版本、协议版本、有限输入 schema 和 access；扩展主进程通过 `cocosAgentDescribe` / `cocosAgentInvoke` IPC 响应。Agent 扩展只扫描活动工程 `packages/`、`extensions/` 的直接子包，核对非符号链接入口、描述挑战、命令声明和 provider 指纹。CLI `extension commands list/call` 负责终端发现与调用；MCP `tools/list` 将在线工程命令映射为带工程身份的动态工具，调用前重核工程与 provider 指纹。write/control 需要 Creator 原生审批；输入经 CLI 与 Creator 两侧 schema 校验。扩展运行在 Creator 主进程，合同不提供沙箱或行为真实性证明，必须只调用可信扩展；不确定的写操作不会自动重放。合同和示例见[Provider 合同说明](../../tools/cocos-creator-agent-cli/references/2x/13-agent-command-providers.md)。这一链路目前仅有源码实现与合同测试，Creator 2.4.15 IPC/弹窗实机验收待完成。

### 异步任务与中断恢复

`tasks start` / `cocos_tasks_start` 接收一个已知命令及合同校验过的输入，立即返回 task ID。任务状态、身份、原输入和有界事件轨迹原子写到 `~/.cocos-creator-agent/tasks/<taskId>.json`（目录/文件权限 `0700`/`0600`）；status 响应不暴露原输入，只返回 SHA-256、事件和完成结果。`tasks wait` / `cocos_tasks_wait` 可按 `eventSequence` 等待下一条持久状态事件，最长 30 秒；超时返回当前进度。每个 Creator 实例仍只允许一个活跃命令/任务。

取消采用协作语义：排队且尚未派发的任务可直接取消；派发后的任务会标记 request 已取消，Creator 原生授权检查会拒绝迟到审批，但无法撤回已经通过审批并开始的写入。脚本创建、节点 `active`、组件挂载和组件标量属性提交分别恢复到对应 reconcile 命令，不重放写入。若结果不确定，状态为 `needs-reconciliation`，不会声称已回滚。

桥接启动时把遗留 `queued`/`running`/`cancel-requested` 转成中断状态，不自动重放。只读命令可以显式 resume；脚本创建 commit 通过原 `operationId` 调用只读 reconcile；其他已派发的 plan/write/control 必须人工核对，不提供自动重试。恢复前校验相同项目绝对路径、CLI/Creator/扩展版本、合同指纹和明确的当前实例 ID。

MCP 当前源码定义 36 个固定工具（3 个基础、25 个 Creator 命令适配、2 个项目工具和 6 个任务生命周期工具）；另在 `tools/list` 时为在线工程发现项目别名与扩展 Provider 命令，合计不超过 128。工具名按工程身份生成，schema/access/审批从实时合同继承；调用时重核工程实例、Provider 指纹或项目注册哈希。扩展 Provider 是 Unity Pipeline 自定义 Editor 命令框架的 Creator 对应接口，不是沙箱。动态 Provider 工具、组件挂载/标量属性工具及任务等待工具仍待桌面 Host 重载和 Creator 2.4.15 实机验收；CLI 等待接口及 Provider schema 校验有本机测试。CLI 用 `cocos-creator-agent catalog` 查看 Creator 固定共享合同，项目 Provider 的实时 schema 从对应 Creator 实例发现；未声明输入拒绝。

## 配对与本机安全边界

- Creator 扩展只在报告版本精确为 2.4.15、项目身份有效且扩展版本/合同 SHA 匹配时注册。
- 服务只监听 IPv4 loopback，生成每次运行随机 bearer token，放在用户目录 `~/.cocos-creator-agent/third-party-bridge.json`；目录和状态文件权限限制为 `0700` / `0600`（系统支持时）。项目目录不保存桥接 token。
- HTTP 请求要求 bearer token、限制请求体大小、限制单实例并发命令。无效会话、旧合同、断连、实例忙和超时均有错误码；写入和获准操作不会自动重试。
- CLI 的 `extension install --project-root <absolute-path>` 仅在显式调用时写入项目 `packages/cocos-creator-agent-extension/`，拒绝覆盖既有目录和经过符号链接的 `packages/` 路径。安装后仍须在 Creator 重载项目扩展。
- 写入审批在 Creator 侧由 `Editor.Dialog.messageBox` 实现，Host MCP 对 commit 同时标注为 destructive。Creator 只接受与保存 plan 完全匹配的 operation ID/hash，用户批准后再执行前态复验。Host 的提示/确认元数据不能单独替代 Creator 确认框。
- Creator 在弹框关闭后先向桥接核对原 commit 请求是否仍处于活动状态；CLI/Host 断开或请求超时后，晚到的“创建”点击不会继续写入。操作状态保持可 reconcile，不会自动重试。
- Operation 记录和待提交源码保存在项目外 `~/.cocos-creator-agent/creator-operations/`，目录/文件权限为 `0700` / `0600`；记录绑定项目绝对路径、Creator/扩展/合同版本、operation ID、目标 URL、原态、源 SHA-256、状态和恢复条件。目标资产仍必须由 Creator AssetDB 创建；CLI/MCP 不直接写 `assets/`、`.meta` 或场景序列化文件。
- 当前写入覆盖**创建一个 JS/TS 资源**、**修改一个节点的 `active`**、**挂载一个 Creator 已注册组件**和**设置该组件的一个公开标量属性**；不提供自动删除/反向修改补偿命令。脚本回执含资源 URL、UUID、importer、源/`.meta` 哈希；场景回执含目标身份、前后态及保存请求状态。Creator/桥接超时后必须用原 operation ID reconcile；不会自动重试。场景保存 IPC 没有文档化完成确认，场景回执不等于磁盘持久化证明。
- 服务不持有或转发模型凭据。
- 预览启动在 Creator 原生确认后调用官方 `scene:play-on-device` IPC；随后桥接启动独立 Chromium 并绑定活动场景名/UUID。运行时需同时匹配 Creator 提供的 `preview-scene.json` 中场景资源 UUID/名称及游戏根场景名；不匹配或无完整来源就拒绝会话。Chromium 只访问 loopback HTTP 预览，不接收任意 URL。浏览器 Console、异常、截图和输入均绑定 `previewSessionId`；输入限制为 12 个白名单键（每键 1–2000 ms）或 canvas 归一化点击，断言限制为 Console、场景、节点 active/x/y、节点存在及组件简单数据字段。
- `creator.preview.stop` 仅关闭 Agent 创建的 Chromium 窗口，不会假称关闭 Creator 预览服务；Creator 原生启动的默认浏览器页仍由 Creator/用户控制。截图放在 `~/.cocos-creator-agent/captures/`，并返回路径和 SHA-256，不写项目资源目录。
- 诊断工具收集 Creator Builder 的 `compile-finished`/`build-finished` 事件、脚本导入失败及 Creator Console renderer 消息。未知事件载荷按有界字段回读；“收到 compile-finished”不等于“构建成功”。

实现依据：Creator 2.4 的[扩展资源管理文档](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management.html)说明用 `Editor.assetdb.create` 创建资源和 `scene:stash-and-save` 保存场景；[Scene Script 文档](https://docs.cocos.com/creator/2.4/manual/en/editor/extension/scene-script.html)说明可遍历和修改场景节点；[主进程 `Editor.Dialog` API](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/editor-framework/main/dialog.html)提供原生消息确认框；[Builder API](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/editor-framework/main/builder.html)定义 `compile-finished`/`build-finished` 事件；Creator 2.4 的[浏览器预览](https://docs.cocos.com/creator/2.4/manual/en/editor/preview/browser.html)说明预览控制面。当前新增写入、构建/Console 订阅及预览控制代码仍待 Creator 2.4.15 实机验证。

## 当前状态与后续开发计划

### 当前基线

- 产品边界：`tools/cocos-creator-agent-cli/` 是独立本机产品，拥有 MCP server、Codex/Claude 原生配置命令、Creator Skills 安装器、Creator 扩展与桥接；`plugins/cocos-creator-agent/` 只保留旧式插件安装的 CLI 引导 Skill。Creator 原生 CocosAgent 已停用并移除，不属于运行依赖。
- 仓库源码版本：CLI `0.9.0`（Provider 命令发现源码）、bootstrap 插件 `0.8.0`、Creator 项目扩展 `0.6.0`。0.9.0 已在本机打包并安装到隔离 prefix，也从 0.6.0 本地 tarball 升级成功；完整回执及 SHA-256 见[0.9.0 CLI 验收轨迹](traces/cocos-creator-cli-0.9.0-package-acceptance-20261020.md)。公开 Release/在线自更新、桌面 Host 重载、Creator Provider 实机尚未完成。Creator 固定命令合同仍只支持 `2.4.15`，CLI 需要 Node.js 20+；预览证据需要本机 Chromium。
- Skills：51 项 Creator 工作流 Skills 与 1 项 CLI Skill（共 52 项）及 Creator 2.4.x 参考资料已移入 CLI 包作为唯一维护源；CLI `skill install` 安装到 Codex/Claude 原生目录。5 项厂商 SDK Skills 仍在可选包 `plugins/cocos-creator-agent-sdk/`，后续需决定是否让 CLI 安装器也管理可选 SDK 包。
- MCP：CLI `mcp serve` 内置 stdio server，`mcp configure/list/status/remove` 负责 Host 注册与检查；固定工具数仍是 36；在线项目别名与 Creator Provider 命令共用总工具数 128 上限。CLI 0.8.0 stdio 与 Codex/Claude CLI 隔离配置有历史验收；0.9.0 的 Provider 动态目录和当前桌面 Host 工具目录仍未验收。
- Creator 命令：5 条只读命令有历史真实回执；当前源码再提供精确节点读取、脚本创建和节点 active 修改的计划/提交/恢复、单节点组件挂载和公开标量属性设置计划/提交/恢复、Creator 编译与 Console 诊断、批准启动 Web 预览及浏览器截图/观察/同会话输入断言。组件挂载拒绝隐式 `requireComponent`；标量写入绑定 Creator 同一扩展会话和具体组件对象 ID；组件构造函数与属性 setter 可能运行项目/引擎代码，Creator 审批框会显示提醒。UI 事件、组件资源引用与对象/数组字段仍无写工具。项目工具别名可暴露合同中的 read/plan 命令及需 Creator 审批的 write/control 命令，但不能注册自定义 Editor 执行代码。异步任务持久化并支持取消与显式恢复，组件写入中断后改走 reconcile、不重放。以上新增能力目前只有源码接线与测试，不能称为实机通过。
- 已验收：CLI 0.8.0 的 26 项测试、tarball 和 Codex/Claude CLI 隔离配置；0.8.1 的 29 项测试与隔离升级；0.9.0 的 32 项测试、90 项文件 tarball（SHA-256 `51c059ff2cf9adab8bacb60c2f79df05d4767d3e90d72092d2dada3068e2c9f9`）、隔离安装、0.6.0→0.9.0 本地升级、52 项 Skill 目录和 30 项 Creator 命令目录。0.9.0 标签已推送，GitHub API 查询仓库 workflow/Release 均返回 404，发布资产和在线更新尚未核实。当前 Codex MCP 仍指向旧插件，Claude 未配置 MCP；Creator 项目 Provider/写入/运行尚待实机验收。Dashboard 工程路径未匹配锁定路径，本轮停止了编辑器操作。详见[0.9.0 CLI 验收轨迹](traces/cocos-creator-cli-0.9.0-package-acceptance-20261020.md)、[CLI 验收](traces/cocos-creator-cli-independent-install-acceptance-20261019.md)、[Codex MCP 验收](traces/cocos-creator-mcp-codex-acceptance-20261019.md)、[桥接边界检查](traces/cocos-creator-third-party-boundary-check-20261019.md)、[差距计划验收](traces/cocos-creator-cli-gap-plan-acceptance-20261020.md)、[后续记录](traces/cocos-creator-cli-gap-plan-acceptance-20261020-followup.md)、[0.8.0 MCP/Skills 验收](traces/cocos-creator-cli-0.8.0-mcp-skills-acceptance-20261020.md)、[watch/项目工具后续](traces/cocos-creator-cli-watch-project-tools-followup-20261020.md)和[Provider 合同](../../tools/cocos-creator-agent-cli/references/2x/13-agent-command-providers.md)。

### 阶段计划

**P1：验收 CLI 自带的 MCP 与 Skill 分发**

- **已通过：** CLI MCP 与 Skill 生命周期自动化测试，共 26/26；Codex/Claude 真实 CLI 在隔离用户目录中的 `mcp configure/status/remove`；Codex dry-run；0.8.0 tarball 隔离安装、52 个 Skills 与 13 份参考资料安装和相对链接检查。详细输入/回执见[0.8.0 验收轨迹](traces/cocos-creator-cli-0.8.0-mcp-skills-acceptance-20261020.md)。
- **待完成：** 在真实 Codex、Claude 桌面 Host 重载后检查新工具目录、Creator 实例配对和只读命令。隔离原生命令配置成功不能代表 Host 会话已加载该配置。
- **待完成：** `cocos-creator-agent-cli-v0.9.0` 标签已推送；验收 GitHub Actions 结果、Release tarball 与 SHA-256 资产、CLI 自更新检查/安装和回滚到指定版本。当前连接器无法读取该仓库的 workflow/Release 状态，不能据此确认线上发布。
- **仍需补全：** 在隔离 Creator 项目验收扩展安装清单、状态、无漂移更新/卸载、用户修改拒绝、`--force` 备份，以及 `doctor --project-root/--instance` 的工程身份和能力目录诊断。通用 `doctor` 的 CLI/扩展/合同/bridge 健康检查已通过（6/6；当前 0 Creator 实例）。锁定 CLI、插件、Creator 扩展和合同指纹的兼容规则。
- 验收条件：Codex 与 Claude 都由 CLI 配置启动同一 MCP server，工具/schema 与 catalog 一致；重复配置安全；Skill 内容/参考链接和 hash 一致；CLI 缺失、版本不兼容、Creator 断连时可诊断且不猜测目标工程。

**P2：Creator 写入最小闭环（源码实现资源创建、节点 active、组件挂载与标量属性设置；实机验收受工程身份阻塞）**

- 已实现源码切片：脚本资源创建；活动场景中一个既有节点的 `active` 属性修改。两者都先生成 operation ID/hash 和前态，Creator 原生确认后重核目标；节点修改经 Scene Script 应用，调用 `scene:stash-and-save` 并回读内存状态，项目外日志支持 reconcile。场景保存 IPC 无文档化的完成回执，故当前实现不声称磁盘持久化验证。
- 已新增源码切片：组件挂载计划/提交/恢复；公开标量属性计划/提交/恢复。挂载只接受 Creator 已加载类注册表中的组件类，拒绝隐式依赖且要求目标类型当前不存在；属性写入只允许精确组件实例上 Creator 声明的公开 string/number/boolean 字段，绑定同一扩展会话。二者均经 Creator 原生对话框确认后经 Scene Script 应用并请求保存；中断后只 reconcile，不重放。组件实例不明或 Creator session 改变时必须人工核对。
- 尚未完成：当前 Dashboard 对项目名 `tank` 报告路径 `/Users/youjunmao/WORK/Cocos_Engine`、Creator 2.4.15、状态“已打开”；与锁定路径 `/Users/youjunmao/WORK/Cocos_Engine/tank` 不一致，故本轮没有进入 Creator、调用项目工具或读写工程。待身份一致后再验收真实 Creator 2.4.15 重载与 MCP 目录、四类写入的审批取消/目标漂移/桥接与 Creator 重启恢复、场景保存确认和磁盘回读。UI 事件绑定、资源引用/对象数组字段修改和自动补偿命令仍未实现。
- 验收条件：未点 Creator 确认不产生项目差异；点确认后身份回执与读回哈希一致；已有目标或合同不符时拒绝；取消不写入；中断后仅通过原 operation ID reconcile，不重放不确定写入。不得把源代码检查说成实机通过。

**P3：运行反馈与同会话复验（源码接线完成，Creator 实机验收受工程身份阻塞）**

- Creator 扩展通过 Builder 与 Editor Console/AssetDB 事件维护有界诊断序列。诊断回执包含来源、时间、序列游标；编译结束事件不代表成功，需查看具体失败日志/导入失败。
- 经 Creator 原生确认后，`scene:play-on-device` 请求预览；桥接启动单独隔离的 Chromium，并校验运行场景名与 UUID 后返回 `previewSessionId`。本地浏览器需要 Chromium，可配置 `COCOS_CREATOR_AGENT_BROWSER`。
- 同会话支持 Console/运行状态读取、PNG 截图、refresh、有限键盘和 canvas 点击，以及 scene/node/Console 声明式断言。刷新不创建新 session ID；失去 Creator session 或场景 UUID 对不上时拒绝。
- CLI `creator watch` 接受最多 32 个工程内文件，稳定改动后刷新原预览会话并重跑同一组 smoke-test 断言，输出 NDJSON 事件。它是运行时持续回归，不是 Creator 单元测试 runner。源码与路径边界测试已通过；0.9.0 本地 tarball 已包含该能力，但尚无公开 Release，也未在 Creator 实机运行。
- **待实机验收：** Creator default preview 窗口与独立 Chromium 的打开行为、编译错误/Console 事件形状、渲染和截图质量、同会话输入效果、项目网络副作用边界、浏览器退出/Creator 重启/桥接重启后的清理。`preview.stop` 只停 Agent 浏览器，Creator 预览服务不会被扩展关闭。
- 验收条件：日志/截图/断言都绑定同一 Creator 实例、场景和浏览器会话；没有浏览器回执时不报告功能通过。

**P4：项目级 Skills 与 Editor 命令扩展（声明式 Provider 已接源码，Creator 实机待验收）**

- 已实现源码：`.cocos-agent/tools.json` 可注册合同命令别名；CLI/MCP 发现时返回注册哈希并继承命令 schema、访问级别和审批要求。允许 read/plan 与 Creator 原生审批的 write/control；拒绝自定义 schema、回调代码和未审批副作用。MCP 忽略项目标题/描述，避免把不可信项目文案写入动态工具定义。
- 已实现源码：Creator 2.4.15 项目扩展可在 `package.json` 声明有限 schema 命令，通过主进程 `cocosAgentDescribe` / `cocosAgentInvoke` IPC 被实时发现和调用；CLI 提供 `extension commands list` / `extension command call`；MCP 为在线项目命令生成动态工具。读/计划/写/控制按 access 分级，写/控制必须在 Creator 原生确认；命令合同、schema、工程路径、provider 指纹在调用前后重核，输入双侧校验，写/控制中断后不重放。
- 待验收：在隔离 Creator 2.4.15 项目安装一个最小 Provider 扩展，确认加载握手、动态 MCP 工具、read/plan 回执、拒绝输入和 write/control 审批/取消；再验证扩展重载、注册变化、provider 冲突/缺失、桥接/Creator 中断。Provider 代码运行在 Creator 主进程，不受 schema sandbox；只能安装并调用可信扩展。项目 Skill 的可信来源与版本/哈希、Codex/Claude 按需加载仍待完善。
- 验收条件：项目工具和扩展命令能被当前 Creator 实例发现；陈旧指纹、未知工具、未声明输入和未批准副作用拒绝；项目 Skill 与 Provider 声明不能扩大 Host/Creator 权限。

**P5：任务审阅、checkpoint 与恢复（异步任务骨架已接源码）**

- 已实现源码：用户目录持久任务日志、task ID/status/events、排队取消、派发后协作取消；桥接重启时转中断；只读任务显式 resume；脚本创建、节点 active 修改、组件挂载和标量属性 commit 只按原 operation ID reconcile；其他未决写/控件操作进入 `needs-reconciliation` 且不重放。
- 待扩展/验收：Creator 断连、Host 取消通知、桥接强杀/重启、任务记录损坏、同项目不同实例恢复、写入审批中断和结果冲突；与源代码/场景/资源差异审阅及 checkpoint 汇总衔接。
- 验收条件：每个中断点可看到任务身份和副作用确定性；可证明安全时才恢复，其他情况不重放且不会覆盖后续修改。

**P6：Tank 真实功能验收**

- 从当前空 tank 工程完成首个可玩切片：简化战场、玩家坦克移动与发射、击中固定目标显示结果、重开；不依赖美术或厂商 SDK。
- 记录每一步是否由 Agent 独立完成、工具/Skill 缺口、人工介入次数、耗时、编译/运行证据及中断恢复结果。该实测才用于判断是否扩展到完整小游戏。

### 已完成的 2026-10-19 验收

CLI 独立包从本地目录与 tarball 安装到隔离 prefix，在同一 prefix 验证升级；MCP 从 CLI 获取唯一命令目录/schema 并委托调用。Codex 与 tank Creator 2.4.15 的只读实机链路已通过，Creator 临时脚本样本已删除并恢复资源基线。完整回执见上方三份轨迹。此阶段未运行写入、预览控制或游戏行为验收。
