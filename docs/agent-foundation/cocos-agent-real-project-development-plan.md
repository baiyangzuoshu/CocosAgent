# CocosAgent Creator 原生 Agent 开发计划

## 2026-10-17 开发方向调整（当前优先级）

主线调整为 **Creator 真实游戏功能开发助手**：保留原生面板、TS 内核、Host/内部 MCP 和既有操作账本，优先补可组合的项目搜索与 JS/TS 开发、节点/组件/引用及事件绑定、编译和运行反馈、项目技能与工具扩展，以及整项任务的审阅与恢复。以 LinkUpClient 的实际功能完成率、人工介入、耗时和恢复结果衡量进展。

完整决策、Unity 对照、M1–M5 交付门槛和功能样本要求见[开发方向调整](cocos-agent-unity-alignment-development-direction-20261017.md)。新增范围均为规划，不代表现有能力或实机验收。自有内核继续作为当前执行路径；Gateway 为后续可选评估。Creator 2.4.15、项目边界与不确定写入恢复规则继续有效。

下方保留既有实现与验收证据；旧日期的阶段顺序不再决定当前优先级。先修授权和数据完整性缺陷，其他历史验收结合真实功能需要安排；不要求完成全部历史研究分支后才开始通用开发能力。

**2026-10-15 流程修复：** 工程级未决写入跨 run/重启门槛、批准计划的显式最终目标、语义摘要的降预算重试、组合补偿和已复现只读识别问题已进入源码及回归路径；记忆合并的项目约定门槛同步补齐。实现、验证结果与实机待验项见 [流程修复记录](cocos-agent-execution-flow-repair-20261015.md)。历史实机状态按各自版本保留，本条不表示新版已通过 Creator 面板验收。

制定日期：2026-10-11；进度更新：2026-10-17。状态：**产品方向已确认；Creator 2.4.15 的 TS Ask、Plan 和 Agent 均已接入 TS 内核。原生面板已验收 Ask/Plan 只读任务及一般 TS Agent 的技能读取、逐次批准写入、账本读回与补偿闭环。长会话原生预验收曾发现旧 Host 摘要漏保精确原文；片段修复后的真实 Host 重启与回忆复测仍待完成。TS Agent 在隔离工程完成精确场景写入、同场景动态端口预览读回、operation preview 接受和账本补偿，Creator 编辑器、序列化场景与两条账本均已交叉核对；续验 Agent 回合因工具调用上限未标记 goal 完成，但最终状态由独立只读终核确认。它不是通用脚本编辑或重放验收。指定 PNG 的旧 JS 原生写入任务已完成保存读回、重开、预览、补偿和新 ID 重放，最终 replay 节点保留。工程隔离记忆的创建、召回、纠正、合并压缩和删除已在 Creator 2.4.15 隔离面板流程中逐项验收；Provider 中立错误接口、任务理解、摘要与归档取回代码均有自动测试。截至 2026-10-17 完整回归，runtime 126 项、MCP/扩展 99 项测试通过。Creator 原生 Provider 超限降预算重试、当前摘要修复版重启、大型工具结果按精确 call ID 取回、跨 Host 任务图续跑、目标缺项续跑和停止原因仍待各自端到端验收；本次意图验收规则修复的中英解释/只读/混合请求、错误最终值及错误 ID 负向用例通过自动回归，尚待 Creator 原生面板复验。LinkUpClient 面板验收仍未执行：当前前台可读窗口是隔离工程，10 月 17 日未能取得 LinkUpClient Creator 窗口；证据分层与后续门槛见[LinkUpClient 前台实机验收尝试](traces/cocos-agent-linkup-front-window-attempt-20261017.md)。** 当前适用版本：Cocos Creator 2.4.15。

**技术栈补充决定（2026-10-11；实现与验收更新于 2026-10-12）：Agent 内核以 `learn-claude-code` 为机制移植基线，产品实现使用 TypeScript + Node.js，不运行上游 Python。** `tools/cocos-agent-runtime/` 承载 TS loop、DeepSeek Provider、MCP 适配、实例/能力预检、Agent 工具门槛与恢复限制；Assistant Host 的 Ask、Plan、Agent 均已路由至 TS 内核。skill 目录、正文与引用仍由 `deepseek-agent.mjs` 的只读 MCP Resource 适配器提供，Agent loop 根据工具回执强制先读任务 skill 和声明引用。TS runtime 58 项测试、MCP/扩展 84 项测试均通过，专项回归覆盖 Hook/Todo、任务依赖环和持久化、Goal Loop 缺项续跑与上限停止、恢复锁和面板验收项展示。Creator 面板端到端验收仍待进行。真实 Creator 面板运行的 TS Agent 只读任务读取 13 项技能目录、`cocos2-scene-node-operations` 正文及合同引用，再成功取得 `helloworld` 完整快照（19 个节点）；runId `84f18514-a8d4-442d-9ef4-dc3e1d4c06ab`。随后 TS Agent 在 Creator 面板中完成一项精确补偿：先读同一 skill/reference、源账本和实时节点，再经面板批准执行 `scene.node.patch`，将原 operation `a7d3f106-5c92-4b7e-8e41-2b93de7c0f58` 的差异 `x:220→221` 补偿为 `x:221→220`。新补偿 operation `3f8c1d47-6a25-4b90-9e13-72d5ac8b04e6` 的 `editor/disk/recovery` 通过；源及补偿账本读回成功，最终实时节点为 `(220,100)`，无 replay、needs-review 或额外写入。runId `86eea250-80f1-4472-8592-88c026c6c4cf`，本机轨迹 `~/.local/state/CocosAgent/agent-runs/2026-10-11T16-21-48-721Z-b052586f.jsonl`。实测还暴露空模型回复及多工具批调用导致提前停止；TS loop 已加入有界重试，自动测试覆盖继续与耗尽停止，尚未声称 Creator 面板实机触发过新批调用重试分支。旧 JS 指定 PNG 原生写入记录见下文和 AGENTS.md。

## 任务理解与持续上下文修复合同（2026-10-15）

[任务理解、会话摘要与 Provider 修复合同](cocos-agent-intent-context-provider-repair-0.1.md)明确模型提议、用户授权与程序验收的职责。任务理解已接入 Creator Agent：模型先提出无工具结构化意图，程序校验原文、位置目标、读取证据和写入门槛；Host 将有效提案留在最近 run 记录，Creator 面板展示任务类别/字面目标并标明不代表批准。解释、等价“设置为/改为”、读写混合、全程只读冲突及错误最终值均有自动回归。2026-10-16 原生回归还发现恢复句里的介词 `to` 会被误识别为节点目标；过滤回归已加入并通过 runtime 自动测试，需再由 Creator Agent 无写入实测。Host 在 24 条消息窗口裁剪前生成并持久化工程/会话隔离摘要，并单独携带最近用户原文片段；确定性回退、摘要非授权边界和超过 24 条的自动回归通过；原生长会话曾发现旧摘要精确回忆失败，修复版 Creator/Host 重启后的原文约束恢复仍待复验。Provider 已有共享错误类型，适配器映射上下文超限等错误，通用循环仅对首次上下文超限做一次降预算重试；重复超限停止，取消与其他 Provider 错误有回归。Creator skill/reference 源已同步，MCP package test 自动核验资源哈希；截至 2026-10-17 runtime 126 项、MCP/扩展 99 项测试通过。**真实 Provider 超限降预算重试仍待 Creator 验收；大型工具结果归档及按精确 call ID 分块取回已在 Creator 隔离工程的一次只读任务中实测，LinkUpClient 分发/上下文仍待验证。** 后续继续保留批准 targets、逐次审批、项目约定门槛和跨 run 恢复锁。

## 新增能力实施门槛（2026-10-13）

后续新增能力统一按 **命令合同 → 编辑器桥接 → 产品 skill → 原生实机验收** 推进。每项能力先关联一个具体、可复现的 Creator 2.4.15 用户任务；复用既有阶段时，重新核对版本、能力可用性、合同和证据范围。

| 阶段 | 必须交付 | 完成状态 |
| --- | --- | --- |
| 命令合同 | 明确支持版本、输入 schema、读写级别、目标 UUID/hash/前值、前置条件、属性范围、成功回执、业务验收条件、失败副作用和对账/恢复流程 | 合同已定义 |
| 编辑器桥接 | 完成所属进程的 Creator API 接线、Host/MCP 路由、实时能力探测；读写能力分别核对身份、保存读回、超时和恢复。Host 能力在此阶段完成原生上下文、运行时及面板接线 | 桥接已实现 |
| 产品 skill | 在 `plugins/cocos-agent-2x/skills/` 增补对应工作流，引用权威合同，说明参数来源、审批、验证和失败恢复；同步技能索引、打包、原生读取与哈希校验，并明确实际实现/验收边界 | skill 已发布 |
| 原生实机验收 | 从真实 Creator 原生面板发起任务，由模型读取产品 skill/引用并调用受控工具；核对编辑器、项目磁盘及相应运行行为。涉及写入时按合同分别验证补偿、恢复或新 ID 重放，保留版本、工程、run/operation 身份和真实证据 | 原生实机验收通过 |

只读能力以读取身份和真实结果验收；功能性写入还需证明用户要求的行为。工具成功回执、模拟测试、能力目录声明、安装和构建结果分别保留其证据含义，只有真实闭环通过后才登记为已验证能力。尚缺实机证据时，明确记录当前阶段、未完成项及已有副作用/恢复状态。

新增能力所需的步骤知识通过产品 skill 发布；涉及缺失编辑器操作或观察入口时，先补命令与桥接。Codex 的 `.codex/skills/` 继续用于 Codex 工作流；Creator 原生 Agent 消费自身包内的产品技能。

## 0.3.16 修复进度（2026-10-13）

批准 Plan 使用 version 2 的逐步业务条件，并在最终步骤按原始用户目标核对实际写入、最新账本/目标读回及适用的运行验收；前序真实回执以有界元数据保存，旧计划需要重新生成。Prefab 源改名的场景重开与磁盘读回都按当次 before/after 名称派生路径，继续校验 UUID、父级和字段。合同、桥接/Host/TS/面板及产品 skill 已更新；构建和语法检查不代表实机验收，原生计划执行、跨 Host 恢复及 Prefab 连续改名/补偿/重放仍待验证。详见 [Plan 业务验收合同](cocos-agent-plan-business-acceptance-0.1.md)和 [Prefab 源合同](prefab-source-edit-0.1.md)。

### Codex 接入移除后的 Creator 原生验收（2026-10-13）

Creator 2.4.15 原生 Assistant 面板在 Codex 插件卸载后重启并重新连接 DeepSeek Flash。Creator 重启只重新加载工程 `packages/cocos-agent-bridge/` 中已安装的复制包，不会同步仓库源码；关闭 Creator 后运行受控扩展升级，再次启动后，面板已从 `cocos-agent-2x@0.3.3` 读取到与源码相同的 fingerprint、14 项技能、技能正文及更新后的合同引用哈希。升级后 run `b4188a63-0b3a-46f8-a4a8-7f2b7b0e7bae` 的专用快照工具也成功，但最终 run 被遗留的写入验收目标错误判为未完成；没有执行项目写入。版本已对齐，Agent 只读任务与旧目标隔离仍需修正。证据见[迁移后验收记录](traces/cocos-agent-native-migration-acceptance-2.4-20261013.md)。

## 1. 目标

让开发者在 Cocos Creator 内直接向 CocosAgent 描述真实游戏功能。Agent 能搜索并理解项目代码、场景、Prefab、组件和资源关系，形成可审阅计划，协同完成 JS/TS 与编辑器修改，再读取编译、Console、画面和实际交互结果验证功能。用户可审阅整项任务差异，并在失败或取消后核对副作用与恢复状态。通用开发与任务恢复的新增范围以 M1–M5 规划为准，不能由目标描述推定已经实现。

**主产品不依赖 Codex 进程、Codex 插件缓存、Codex MCP 配置或其他外部 Agent。** Codex-hosted CocosAgent MCP 插件和本地注册配置已移除；Creator 扩展管理自己的 Agent 生命周期与本机 sidecar，sidecar 内部 MCP stdio 只作为 CocosAgent 的 Creator-owned transport。以后若要支持外部互操作，需作为单独适配器重新设计与验收，不属于当前产品路径。

## 2. 产品与进程边界

```text
Cocos Creator 2.4.15
  └─ CocosAgent 扩展与面板
       ├─ 对话、计划、权限、模型配置和执行状态
       ├─ Agent 调度与可版本化的任务知识读取
       ├─ 共享命令合同、实例/项目身份和操作账本
       └─ Creator 编辑器适配层
            ├─ 场景、节点、组件和资源操作
            ├─ 保存/导入/编译反馈、预览、日志与画面观察
            └─ 回执、对账、补偿与恢复
                 └─ 当前游戏项目

当前产品路径：Creator 原生面板 → CocosAgent TS 内核 → Creator 管理的本机 Host/内部 stdio transport → 版本化命令合同与 Creator 扩展
```

Creator 扩展是用户入口、生命周期所有者和产品状态的权威来源。现有 Assistant 由 Creator 扩展启动本地 `assistant-host.mjs`，再由它启动自己的 MCP stdio 子进程；这个内部进程随 Creator 扩展包分发，不需要 Codex 注册、插件或宿主。sidecar 要求本机提供 Node.js 20+。Agent 调度可以位于扩展运行时或 Creator 启动的本地服务中；不预设把所有工作塞进编辑器进程。Creator 内的 Agent 必须在未安装 Codex 的环境中独立完成其支持的任务。

模型调用采用可替换的 Provider 接口。现有原型支持 DeepSeek Flash/V4 Pro 配置，真实调用只验收过 Flash；Key 改为明文保存在 OS 用户配置目录 `~/.cocos-agent/credentials.env`（Windows `%USERPROFILE%` 下），POSIX 设置 `0600`。这避免将 Key 写进游戏项目，但还不是系统密钥链加密存储；不得把 Key 写入场景、操作轨迹或版本库。

### TypeScript 内核移植与融合

用户已确认使用 TypeScript，替代此前讨论的 Python sidecar 方案。Creator 扩展继续拥有 Agent 生命周期；新内核运行于 Creator 管理的 Node.js 服务，使用现有面板通信与真实 Cocos MCP。新增内核和产品适配源码采用 TS，构建产物为 JavaScript；Creator 2.4 扩展入口的模块格式和编译目标按实际宿主兼容要求配置。产品启动与正常使用不需要 Python/pip；既有 Python 研究与测量脚本按原用途保留。

上游来源：[learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 固定在 [`0dcafa2ae053a1ddd6a72f265431104b08a5aa13`](https://github.com/shareAI-lab/learn-claude-code/commit/0dcafa2ae053a1ddd6a72f265431104b08a5aa13)。逐章对应、移植/适配/暂缓/排除状态和维护规则以 [UPSTREAM.md](../../tools/cocos-agent-runtime/UPSTREAM.md) 为准；该表的所有上游源码链接均指向固定 SHA。固定 commit 的 s01–s17 原始 code.py、MIT License 与文件哈希已归档于 [vendor/learn-claude-code](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/)。逐章源码映射、哈希和验证命令见 [PORTING-MAP.md](../../tools/cocos-agent-runtime/PORTING-MAP.md)。上游源码仅作只读移植基线，不进入产品运行时；当前 TS 实现仍是独立实现，尚无逐行或机械翻译。未来每次源码移植都需记录上游符号、保留行为与 Creator 改动，并遵守 MIT 许可。不能把文件后缀改成 `.ts` 当作完成移植。

课程 README 还推荐作者的独立产品 [KODE Agent SDK](https://github.com/shareAI-lab/kode-agent-sdk)，不是 `learn-claude-code` 教程仓库本身。SDK 提供 TypeScript Agent、审批事件、MCP、Provider 与 Skills，作为候选集成方案已完成文档级初审；其运行依赖、状态存储与 Creator 命令的项目/实例/账本门槛尚未审计，因此当前 TS 包仍按用户已选的教程机制逐步移植，不引入该 SDK。

源码核对边界：上游集成示例默认使用 Anthropic 客户端、终端审批与工程目录中的状态文件；其 MCP 是进程内模拟服务。TS 移植需接入现有 DeepSeek Provider、面板审批、按工程隔离的用户状态目录以及真实 MCP stdio 客户端，完整保留结构化回执、错误、图片与技能 Resource 读取。模型调用统一经过 Provider 接口；若后续实现上下文摘要与记忆，也沿用该接口。凭据不进入 MCP 子进程、项目资产或轨迹。

| 模块 | 当前对应与边界 |
| --- | --- |
| s01 Agent Loop / s15 单 Agent 核心 | 按课程机制独立用 TS 重写；Ask/Plan/Agent 接入 TS 内核。Creator 面板已验收只读 Agent 任务和一次受控场景补偿，不代表通用写入任务都已通过 |
| s02 工具调用 / s14 MCP | 适配实时 Cocos MCP 工具目录与回执；逐项核对 2.4.15 版本、合同、访问级别、目标实例和能力。不是通用 shell 或任意 MCP 插件执行器 |
| s03 权限 / s04 Hooks | Creator 面板批准与程序门槛之外，TS 内核已有输入、工具前后、停止四类可组合生命周期 hooks；停止钩子续轮受 maxTurns 限制。自动回归通过，Creator 面板钩子轨迹仍待实机验收；不提供用户脚本 hooks |
| s07 Skill Loading | TS loop 强制同轮技能/引用回执；正文和引用当前由 JS MCP Resource 适配器读取。技能权威来源为 `plugins/cocos-agent-2x/skills/`，不读取 Codex 插件缓存 |
| s05 TodoWrite / s10 Task System | s05 是 run-local `agent_todo_write`，Host 持久化执行进度，与用户批准 Plan 分离。s10 已增加工程隔离任务图：持久 ID、状态、依赖、claim 与回执派生完成；Creator 面板失败/取消和跨 Host 重启读取待实机验收。 |
| s08 Context Compact | TS 内核已有预算估算与确定性压缩；大型结果新增本机每-run 私有档案、短预览和按精确 call ID 分块读取。Creator 2.4.15 隔离工程实测 14,517 字符工具结果归档及 4 块精确 call ID 取回，见[归档取回轨迹](traces/cocos-agent-tool-result-archive-2.4-20261016.md)。此前长会话窗口裁剪与一次 Creator/Host 重启精确标记恢复有历史证据；当前摘要修复版本的 Host 重启回归仍待复验。Provider 超限降预算重试仍待实机；LinkUpClient 面板上下文/工具分发另待验证。详见[上下文压缩合同](cocos-agent-context-compaction-0.1.md)与[长会话验收轨迹](traces/cocos-agent-session-summary-2.4-20261016.md) |
| s09 Memory | 已实现项目隔离的本机长期记忆、任务召回、精确用户/工具来源、run-local 候选提取、批准后创建/纠正/压缩/删除与精确操作恢复；Creator 2.4.15 隔离面板中已实测创建后 Ask 召回、纠正到 revision 2、两条同类记录审批压缩并保留来源，以及删除后读 operation tombstone、搜索不再召回。memory_compact 的本轮项目约定门槛仍由自动测试覆盖；上述为隔离验收工程，不代表真实游戏工程。详见[工程隔离记忆合同](cocos-agent-project-memory-0.1.md) |
| s16 Workflow Runtime / s17 Goal Loop | s16 通用脚本工作流仍暂缓。s17 已按 Creator 适配：显式工具回执验收、最多续跑 2 次，预算/取消/审批/恢复锁仍生效；无独立 LLM 评估器。真实面板续跑和停止原因展示待实机验收。 |
| s06 Subagent / s11 Background Tasks / s12 Cron / s13 Agent Teams | 按产品约定排除：Creator Agent 不加入子 Agent、通用后台任务、定时任务或团队协作 |
| Creator 内容操作 | 复用既有 Creator 命令与账本；保留预期差异、陈旧拒绝、读回、预览、对账、补偿与重放。能力状态按 2.4.15 实测记录 |

Creator Agent 不加入通用 shell 工具、团队/子 Agent 协作或定时任务。计划扩展注册工程内的通用代码/资源搜索、JS/TS 新建与多文件修改，以及项目工具；每类操作须有明确的文件/对象范围、权限、读回和恢复合同。场景、Prefab 与资源元数据继续使用核对过的 Creator API，不以通用文件工具绕过 AssetDB、身份或账本检查。现有合同在新能力实现及验收前继续有效。

近期执行顺序（2026-10-17）：

1. **M1：项目通用开发工具。** 从 LinkUpClient 当前项目选择实际功能，补所需的代码/资源搜索、JS/TS 新建与多文件修改、组件属性发现和编辑、资源引用与事件绑定；复用当前能力和公共合同设施。
2. **M2：开发反馈与功能验证。** 将编译错误、Console、预览归属、运行状态、截图和同一会话的实际输入/业务断言接入修改循环。
3. **M3：项目技能与工具扩展。** 补项目级 skill 按需发现/读取和项目 API/工具注册，明确 schema、权限、来源冲突及版本/哈希检查。
4. **M4：任务审阅、权限与恢复。** 汇总代码/场景差异，设计用户明确选择的任务权限和 checkpoint；保留现有审批、未决写入限制及操作账本，检测后续人工改动和恢复冲突。
5. **M5：真实功能与可重复样本。** 从原生面板完成实际功能并逐步形成样本集，记录任务成功率、人工介入、耗时、用量和恢复结果；每个前序里程碑均围绕该样本增量验证。

以上新增范围均为规划；具体完成条件与依赖见[方向调整里程碑](cocos-agent-unity-alignment-development-direction-20261017.md#3-开发顺序与交付门槛)。长期记忆、Task System、Goal Loop 和上下文机制复用既有实现，其余未验收项按功能需要推进。固定上游基线、许可与移植边界继续见 [UPSTREAM.md](../../tools/cocos-agent-runtime/UPSTREAM.md)。

截至 2026-10-12，Task System/Goal Loop 的 TS/Host 代码与自动回归已完成；runtime 58 项、MCP/扩展 84 项全部通过。真实 Creator 面板仍需验收任务图跨重启恢复、requiredTools 缺项续跑、预算/取消/审批/恢复锁停止，以及未完成验收项展示。此前只读 Agent、受限场景补偿和 PNG 原生闭环证据保持各自边界；自动测试不代替 Creator 实机验收。

## 3. Unity 对照原则

Unity 官方提供内置 Assistant、Editor 内接入第三方 coding agent 的 Gateway，以及外部 CLI/MCP 和插件。当前选择保留 **Editor 内原生助手与自有 TS 内核**，重点对齐通用项目开发能力、项目级 skill/工具扩展、可配置权限和任务 checkpoint 体验。Gateway 单独评估，不在本轮切换内核或引入外部 Agent 依赖。

2026-10-17 对照采用官方产品页与 Assistant 2.9.0-pre.2 文档，未做同条件实测，也不推定其为最新版本。详细差距与官方链接见[Unity 对照与当前差距](cocos-agent-unity-alignment-development-direction-20261017.md#2-unity-对照与当前差距)。

参考：[Unity 官方 in-editor Assistant 与 MCP 说明](https://unity.com/blog/unity-ai-how-to-get-started)、[Unity AI 工具入口与外部接入对照](https://unity.com/features/ai)。Unity 的具体实现不推定为 Cocos 的实现方案；Creator API、扩展生命周期、平台支持与项目上下文均以 2.4 手册、本地源码和 Creator 实测为准。

## 4. 开发步骤与验收

本节保存既有阶段的实施范围与历史证据，按任务复用；当前交付顺序为上方 M1–M5。旧步骤编号不要求依次收完所有历史验收后才开始新的真实功能任务。

### 0：盘点现有实现，确定 Creator 所有的运行边界

已修正扩展的服务入口为扩展包内 `assistant-runtime/.../assistant-host.mjs`，扩展 WebSocket 依赖随包携带；凭据写入用户目录；MCP 运行时指纹由 Codex 插件字段改为通用 Agent 技能包字段。`package-creator-extension.mjs` 可构建扩展包或向开发扩展安装 runtime，包内不需要 `.codex-plugin`、`.mcp.json` 或 Codex 进程。自动测试已在仓库外临时目录完成 MCP 工具、11 个技能和 29 份引用资源的发现、读取及哈希核对。Creator 2.4.15 `2.4.15NewProject` 扩展运行时安装后，编辑器界面重载并再次打开 Assistant 面板；面板显示 `已连接 · deepseek-flash · Key 已保存在本机`。随后已由 Creator 原生面板真实调用 DeepSeek Flash，完成只读实例、能力、场景查询；三项回执成功且场景 SHA 未变，详见[Ask 实机轨迹摘要](traces/cocos-agent-ask-runtime-fix-20261011.json)与 Assistant 说明。新增的按需 skill 工具已随 0.3.1 扩展安装到独立 LinkUpClient 工程并由其 MCP 资源提供；该工程的 Creator 已加载扩展，但本次模型 Ask 由受控 harness 发起，尚未从面板发起。

**完成标准：** 补齐现有原型的进程图、依赖清单和独立工程安装验证；确认 Creator 扩展/Creator 管理的 sidecar 与可选外部 MCP 的边界。此步是现有原型的历史盘点门槛；后续内核迁移按上文 TypeScript 移植顺序推进。

### 1：Creator 内的只读 Agent 最小闭环（已完成）

将现有 Creator 面板原型作为基线，而非重做聊天 UI。先把它从仓库固定相对路径中解耦，使扩展可安装到任意用户的 2.4.15 工程；再核对 Provider 设置、只读上下文、运行状态和错误回执是否完整。已有 Ask/Plan/Agent、实例/能力查询和 Creator 管理的 MCP 子进程优先复用。

**完成标准：** 不启动或连接 Codex 管理的 MCP Host，用户在 Creator 中输入问题后，Agent 能选择正确的 2.4.15 实例与项目，调用只读能力并根据回执回答。Creator 扩展可自行启动/停止其本地服务。模型凭据按明确的本地存储设计读写，关闭/重开 Creator 后行为可解释，凭据不进入日志或 Git。2026-10-11 已实测 Ask 按实例 → 能力 → 场景快照的顺序完成，`allowWrite=false`，场景 15 节点且 SHA 未变化；轨迹位于用户目录 `~/.local/state/CocosAgent/agent-runs/2026-10-11T01-23-52-882Z-c00d3f8d.jsonl`。

### 2：Agent 计划与任务知识读取

把任务拆解、工具选择、权限判定和步骤结果做成显式调度循环。Creator 原生 Agent 能按任务发现并读取版本化 skill/参考资料，不依赖 Codex 插件目录；以现有 2.4 skills 为内容来源，打包只读目录、正文和受限引用读取工具，并在读取前验证 package 版本/指纹与 SHA-256。

**完成标准：** Agent 能针对一个只读真实项目任务展示计划、由模型按任务选择并读取相关 skill/引用、调用工具并解释停止原因；运行轨迹记录读取到的技能名、版本、URI、哈希和引用 ID，且不包含技能正文或凭据。

**当前进度（2026-10-11）：** `tools/cocos-agent-bridge/mcp/deepseek-agent.mjs` 提供 `cocos_2x_skills_list`、`cocos_2x_skill_read`、`cocos_2x_skill_reference_read` 三个只读模型工具。Creator 包内 MCP Resource 是权威内容源；初始 0.3.1 索引包含 11 个 2.4.15 skill、29 份引用及 SHA-256，只允许读取索引声明的 skill 和该 skill 声明的 reference ID。当前 Creator 研究扩展加载 0.3.2 技能目录，本轮实测目录有 13 个 skill；运行时记录 package 指纹、索引哈希、读取 URI 与正文哈希，不记录正文/Base64。TS Plan 必须在同一轮取得技能目录、非基础任务 skill 与其声明引用的成功回执；Creator 面板真实运行已满足此门槛。后续 Agent 写入模式仍需把同样的技能/合同读取和项目约定检查接入 TS 执行路径。

**独立真实工程验收（2026-10-11）：** 在独立的 LinkUpClient Creator 2.4.15 工程安装 0.3.1 扩展并启动 Creator；扩展日志显示加载，面板上下文识别工程 `LinkUpClient`、活动场景 `LinkUp`、无选中对象，并检测到 `AGENTS.md`（SHA-256 `ae984519…`）。真实 DeepSeek Flash 通过该安装包的 MCP stdio 连接运行中的 Creator，完成只读 Ask。模型按顺序调用实例列表、skill 列表、`cocos2-mcp-tools` skill 读取、能力列表和场景快照，5 次调用均为 read，最终确认 2.4.15、`LinkUp`、选择为空、快照 9 个节点且未截断。为实现获准的路径脱敏，调度器现在在比较能力回执时规范化注册工程路径；独立回归用 symlink 别名验证没有放宽注册根校验。模型只收到保留工程名的临时根路径别名和脱敏实例/能力/场景数据；实际工程绝对路径、`AGENTS.md` 正文没有发送。API Key 没有进入提示词、工具参数或轨迹，但按 DeepSeek API 要求作为 HTTPS Authorization 凭据发给 DeepSeek 服务端。项目约定读取工具在本机成功返回文件存在、哈希和长度，正文只在本地验收进程中处理。skill 内容对应 `cocos-agent-2x@0.3.1`，URI `cocos://2x/agent/mcp-tools`，SHA-256 `8807a5d5…`；本次模型未读取引用资料。脱敏运行摘要见[LinkUpClient Ask 验收记录](traces/cocos-agent-linkup-ask-2.4-20261011.json)。

**仍未完成：** 这次真实模型循环是测试 harness 调用 Agent 调度器、经独立工程扩展内 MCP stdio 操作真实 Creator，不是 Creator 面板内直接点击 Ask 的端到端记录；工程名由显示上下文/脱敏别名提供，当前 MCP 实例合同没有独立的 displayName 字段；模型没有读取项目约定正文，因此不宣称它已按 LinkUpClient 的 AGENTS 规范回答；安装为 0.3.1 的新工程接入，未验证从旧版扩展升级。Creator 窗口中的非空对象选择同步也尚未验证。面板直发 Ask、旧版升级、选择对象同步和约定内容在本地筛选后如何提供给模型，是该里程碑剩余验收项。本次独立工程验收时研究工程仍是 0.3.0；后续研究工程 runtime 已更新至 0.3.1。该安装状态变化不补足 LinkUpClient 面板直发的验收缺口。

**实现补充（2026-10-11）：** Creator 面板每轮将经过白名单筛选的工程名、版本、场景、最多 8 个选中节点及约定文件状态传给本地 Assistant；Host 校验工程路径精确对应当前 sidecar，提示上下文不持久化且不含工程绝对路径、AGENTS 正文或哈希。模型在依据选择写入前必须重新调用 `scene.snapshot`。Agent 模式写入需先通过项目只读工具读取 `AGENTS.md`，并验证读取哈希与本回合面板采样一致；未读取或约定文件已变化时停止调度。扩展包源版本为 0.3.4，MCP runtime 为 0.3.3；同目录原子升级/回滚命令已有自动测试，LinkUpClient 磁盘包已从 0.3.1 升至 0.3.4，保留 0.3.1 和中间版 0.3.3。Creator 已执行“开发者 → 重新加载界面”；其后两次只读 Agent 复测均未发出任务工具调用，均以 missing-successful-task-receipt 停止，扩展指纹刷新与场景快照能力仍待确认。

### 3：一个受控写入任务的完整闭环

复用现有 2.4 语义命令与恢复账本，选一个真实任务验证：写入前展示目标和预期改动，按权限策略执行；之后做保存/导入读回、预览与必要日志检查。失败时按操作 ID 查询和恢复，禁止盲目重试。

**完成标准：** Creator 内 Agent 在不依赖 Codex/MCP 的情况下完成一次从自然语言到实际改动的任务。目标选择、before 状态、实际差异、回执、磁盘读回和预览/运行证据齐全；补偿或失败停止路径经过验证。

### 4：真实任务驱动的脚本开发闭环

依据实际项目阻塞，逐项补 Console/脚本编译反馈、资源查询、Prefab/组件操作、普通项目预览/构建或运行时观察。扩展已有操作时保持合同白名单、陈旧状态拒绝、UUID 校验、结果读回和故障恢复。性能、Bundle、原生和引擎源码工作由具体任务与测量结果触发。

**完成标准：** 每项新增能力关联一个可复现用户任务，且由 Creator Agent 实际调用并完成端到端验收；工具声明或模拟测试不单独算通过。

### 5：Agent 直接观察运行结果

接入普通场景预览、Console、运行状态和截图，复用已有验证能力。观察回执关联同一工程、任务及运行会话，区分保存、编译与功能通过；先覆盖第 4 步按钮任务，不预先扩充全领域工具。

**完成标准：** Agent 发现“保存成功但运行错误”，读取真实日志或状态，在授权范围内提出并执行修复，再用同条件运行证据验证；修复失败保留原操作 ID 与恢复入口。当前尚未实现通用原生面板观察闭环。

### 6：连续任务体验

持久化会话与计划，增加取消、差异查看和恢复入口。取消先停止后续调度，已发送的写入按原账本对账，不能将取消等同于回滚；恢复先重新查询实例、能力与陈旧状态。

**当前实现（2026-10-11）：** Assistant sidecar 将会话、计划、最近任务和紧凑操作回执写入按 Creator 工程路径哈希隔离的 OS 用户状态目录；原子替换文件并限制 POSIX 权限为 `0600`，不保存 API Key、截图或原始工具参数。运行中服务重启时，读任务标记为中断；存在活动写入或未完成写入回执时锁为 `needs-review`，不会自动重试。面板有停止按钮；取消可终止模型请求或阻止后续工具，正在执行的 MCP 命令会先返回回执。计划卡保留步骤回执，工具回执可展开查看预期差异；最近任务卡列出已发生/可能发生的写入，并允许对已记录 operationId 调用固定只读 `operation.get` / `script.operation.get`。这一入口只读回账本，不自动 reconcile、compensate 或 replay。

**验证边界：** sidecar、状态存储、取消竞态、面板呈现和扩展打包均有自动测试；尚未在 Creator 2.4.15 面板实机验证服务重启后的恢复展示、按键取消或真实任务差异呈现。因此该步骤为“实现与模拟验收完成，Creator 实机验收待做”，不视作连续任务产品闭环已完成。

**完成标准：** 同一真实项目多轮修改可延续上下文，面板清楚展示实际差异、验证结果和恢复状态。持久操作账本与 JSONL 轨迹本身不等于会话/计划持久化。

### 7：可选外部 Agent 适配

在原生 Agent 已能独立完成任务后，再决定是否继续维护 Codex/其他客户端的 MCP、CLI 与 skills 插件接入。它们复用同一命令合同、实例选择、权限和账本，不得成为 Creator 内 Agent 的运行依赖。

**完成标准：** 外部工具的启停、schema 更新或卸载不影响 Creator 内 Agent；两条入口对同一命令使用相同版本与安全规则。

### 8：真实项目持续验证与 3.x 后续规划

用用户指定的真实 2.4.15 工程连续完成任务，按反馈增加能力并沉淀 Creator 可读取的任务知识。只有 2.4.15 原生路径达到可重复验收后，才制定 Creator 3.8 适配计划；保留所有已有 3.x 研究和证据。

**完成标准：** 连续多轮任务中，Agent 能正确选择项目、保持场景/资源/Prefab 关系，报告实际运行结果，并处理失败与恢复；新增步骤可复跑和审查。

### 9：在 LinkUpClient 持续使用

将 LinkUpClient 作为 2.4.15 的独立真实游戏工程，连续执行只读 Ask、基于选择对象的检查和多轮跟进；按实际任务核对并读取 `AGENTS.md` 项目约定。将扩展 0.3.1 安全升级到当前包并保留恢复副本，确认 Creator 重载后实际生效。每轮上下文只传当前工程/场景/选中对象所需字段，不传绝对路径或默认发送项目约定正文；涉及选中对象的写入前，以实时快照重新校验。

**完成标准：** LinkUpClient Creator 面板直发任务并准确使用当前工程、项目约定与实时选择；多轮上下文可在 sidecar 重启后恢复，旧选择不作为当前目标；升级版本及恢复入口可核验。实机验收记录见 [LinkUpClient 持续使用](cocos-agent-linkup-continuous-use-20261011.md)。

## 5. MVP 验收总门槛

1. Creator 是 Agent 的产品入口；Codex、Codex 管理的 MCP Host 和插件缓存均可不运行。Creator 自己管理的 MCP stdio 进程可作为内部实现，但不得由 Codex 提供或托管。
2. 面板展示当前工程、Creator 版本、计划、工具调用、验证结果和失败状态。
3. 使用用户配置的 Provider；凭据不进入项目和日志。
4. 以真实游戏功能作为 MVP 验收样本：原生面板完成项目理解、代码/编辑器协同修改、编译、适用的运行与交互断言，交付整项差异及恢复结果。既有只读与受控写入切片作为基础证据；工具成功、编译通过或截图不能单独证明业务功能完成。
5. 验收基于真实 Creator 2.4.15 与真实工程。保留 MCP/CLI 是可选兼容，不改变上述门槛。
6. 样本记录全部必需验收条件、实际结果、人工介入次数/类型、耗时、可取得的用量及失败/恢复原因；建立样本基线后再制定发布阈值，不以工具、skill 或自动测试数量替代产品验收。

## 6. 当前执行状态

以下为既有步骤的分阶段证据记录，部分行保留较早日期状态，须与顶部 2026-10-17 摘要及链接轨迹一起读取；它们不构成当前实施队列。新方向 M1–M5 均为规划，现有切片的复用依据与新增范围见[里程碑表](cocos-agent-unity-alignment-development-direction-20261017.md#3-开发顺序与交付门槛)。

| 步骤 | 状态 | 下一步 |
| --- | --- | --- |
| 0：边界盘点 | 扩展包与 sidecar 接线已改；Creator 面板连接与 Ask 实机均有证据 | 后续在真实独立工程持续核对启动/停止与安装可移植性 |
| 1：原生只读闭环 | Ask/Plan/Agent 均由 TS 内核调度；Creator 重启后工程安装包升级到与仓库源包一致；2026-10-14 修正显式只读验收范围并将 Host 预检成功回执纳入本轮验收/持久任务记录，runtime 75/75 通过，修正后的 runtime 已再次安装并保留回滚副本 | 升级后原生面板复测被 Dashboard 登录页阻断；登录前还需验证只读任务收尾，以及通用执行器审批与任务卡摘要呈现，详见迁移验收记录 |
| 2：计划与知识读取 | runId `b4188a63-0b3a-46f8-a4a8-7f2b7b0e7bae` 的原始回执确认技能包 0.3.3、fingerprint 匹配、14 项索引以及 skill/合同读取成功 | 原生复测后再确认最新报告忠实呈现成功回执中的版本、技能数与哈希；之前 13 被报告为 12 的问题仍未修正 |
| 3：受控写入闭环 | 旧 JS 指定 PNG 原生任务已完成 apply/重开/预览/补偿/replay；TS Agent 又真实完成 operation `a7d3f106-5c92-4b7e-8e41-2b93de7c0f58` 的唯一反向补偿 `3f8c1d47-6a25-4b90-9e13-72d5ac8b04e6`，面板批准、editor/disk/recovery 回执、源与新账本读回及实时 `(220,100)` 读回通过 | 基础 TS 写入/补偿路径已验；下一步用真实任务验收 TS 脚本读取、差异审阅、编译、运行与失败恢复，不重复该节点写入 |
| 4：脚本开发闭环 | 原生面板完成既有 JS 的读取、精确差异、审批、写入和 Creator 编译；本次实际点击显示 `Clicked: 1/2`，原操作补偿后刷新预览再点不变。脚本源 SHA、UUID/meta 与按钮位置已读回恢复；记录见 AGENTS.md 的 2026-10-12 复验 | 补原生新 ID 重放、真实错误修复及独立游戏工程脚本任务；Plan 结构输出和多次提示调度缺口仍在 |
| 5：运行结果观察 | **实现与模拟编排测试完成；原生初始观察已有实机证据，错误修复闭环待做。** 新增 2.4.15 Web 预览日志、帧/暂停状态、可选节点状态和画布截图观察；Agent 可按同一场景 UUID 读回，再走现有脚本读取、差异计划、批准补丁和二次观察。研究工程当前扩展 0.3.4 / MCP 0.3.3 合同匹配；原生已批准启动预览并观察同场景 UUID、帧、Label、日志和截图。每次观察为独立新页面，不能读取已点击页面状态 | 在隔离的 2.4.15 工程安装新运行时，注入已知可逆脚本错误，验证面板观察、窄补丁、Creator 编译和同场景二次观察；再恢复基线。另需解决共享预览端口 7456 的实例归属认证 |
| 6：连续任务体验 | **实现与自动测试完成，Creator 实机验收待做。** 会话/计划、最近任务、副作用、停止、差异与只读账本核对入口已接入；2026-10-16 runtime 定向测试 42/42、Host 定向测试 6/6 通过，覆盖摘要/压缩控制流、取消等待写入回执、项目约定陈旧哈希拒绝及精确恢复前置条件 | 在真实 2.4.15 面板跨 Host 重启验证会话与恢复状态；面板发起真实取消并确认当前命令回执、后续调度停止且无自动回滚。自动测试不算 Creator 实机证据 |
| 7：外部 Agent 适配 | 可选 | 原生路径稳定后再决定维护范围 |
| 8：持续验证与 3.x | 2.4 持续推进；3.x 暂停新增 | 以真实工程可重复验收作为后续 3.x 规划门槛 |
| 9：LinkUpClient 持续使用 | **自动测试已验证，磁盘身份/AGENTS 指纹已只读核对；原生面板未验证。** 2026-10-17 完整 runtime 126/126、MCP/扩展 99/99；只读确认 `AGENTS.md` 8,140 字节、SHA-256 为 `ae984519b3f1a808dad20546311c11701a031b1ce749f741f2a117a6aefa6f14`。Dashboard 显示 LinkUpClient“已打开”，但可读 Creator 前台仍为隔离工程，切换/打开尝试后编辑器超时；未取得 LinkUpClient 面板证据。详见[前台验收尝试记录](traces/cocos-agent-linkup-front-window-attempt-20261017.md) | 在 LinkUpClient 面板验证上下文/扩展指纹/场景快照、AGENTS 按需读取及陈旧哈希零分发拒绝、非空选择、多轮跟进、面板取消和精确账本恢复；之后从 LinkUpClient 实时快照选取目标并经批准复跑任务，不复用隔离工程 UUID |
| 10：工程隔离长期记忆 | TS/Host 本地持久化、来源核验、候选提取、纠正/删除、准确恢复与任务召回已实现；TS runtime 58/58、MCP/扩展 84/84 | Creator 面板验收候选审阅、创建批准、来源查看、纠正后保留旧版本来源、删除后检索为空及 Host 重启后仍按当前工程隔离 |
| 11：单 Agent Task System / Goal Loop | TS/Host 任务图、依赖/认领、工程隔离持久化、成功回执判定和最多两次有界续跑已实现；预算、取消、写入审批与恢复锁保留原程序约束 | Creator 面板验收跨 Host 恢复、缺项续跑/停止、审批拒绝、取消和停止原因展示；不引入通用 shell、团队或定时任务 |

## 2026-10-17 M1 通用项目开发工具进展

首版通用合同见[Creator 通用项目开发工具合同](cocos-agent-project-development-0.1.md)。本轮定义了有界 `project.search`、脚本文件组读/计划/写入与恢复、组件属性检查/补丁、资源引用和序列化事件检查/补丁合同，并把每项 Creator 原生接线/验收状态区分开。

Creator 2.4.15 扩展/MCP 源码现已发现并路由只读 `project.search`：对 `assets/` 下 JS/TS 内容、资源路径与元数据提供有界分页、相对路径和可用 UUID/哈希；现有 `asset.searchPng` 继续用于 Creator AssetDB 已导入 PNG 的 Texture/SpriteFrame 核验。项目搜索已接 Creator 命令目录、MCP 专用只读工具与产品 skill。已有 `script.*` 单文件精确补丁合同扩展为 JS/TS importer；TS 不由 Node 解析，必须由 Creator 对本次精确源版本给出编译证据。

**状态：** 合同已定义；代码/资源发现桥接已接入 Creator 源码；产品 skill 已发布；尚未打包并安装到 LinkUpClient 实测，也未完成 Creator 面板模型发起的原生搜索/TS 写入验收。首个候选真实任务是检查分享提示入口的 `realShare` 参数，当前目标为既有 TypeScript 控制器；具体文件、当前哈希、用户改动、未决账本及成功条件仍须从 LinkUpClient 正在运行的 Creator 实例核实。本轮没有修改该项目。JS/TS 新建与多文件操作、通用组件属性、额外资源引用和事件绑定仍为合同/排期，尚无可用 Creator 命令；不得据 `project.search` 或现有 `scene.node.patch` 推断这些能力已经实现。

首个小切片成功条件：从 LinkUpClient 当前 Creator 实例读取项目身份和约定；通过 `project.search` 找到现有 TS 控制器并以专用读取命令复核 UUID/源/meta 哈希；若业务确实需要改动，再由用户批准唯一单文件差异，确认精确 Creator 编译产物、源码/元数据身份和操作账本读回。任何门槛失败均不写入。恢复基线是在执行前记录目标源/meta SHA、UUID、Git 工作区差异（通过项目既有审阅入口）及未决操作；补偿只针对同一 operation 且目标仍匹配候选哈希，不确定时只对账，不重试。现有共享 LinkUpClient 工程当前 Creator 实机不可达，因此这组条件尚未建立或验收。

后续按 M1 子项逐个完成“桥接 → Host/Agent 发现 → skill/合同引用 → 独立工程与 LinkUpClient Creator 原生验收”：再为新建/多文件脚本做逐文件计划、回执与部分失败恢复；依据 Creator 2.4.15 可保存字段元数据实现组件属性；最后实现并实机核验 SpriteFrame/脚本资源引用和按钮事件序列化绑定。TS 写入须单独验证导入器与编译产物；资产搜索需核对 AssetDB 身份；所有编辑需保留每文件或每项编辑器字段的实际副作用与恢复证据。

## 2026-10-17 M2 运行反馈与功能验证进展

编译/import 结果继续由既有 `script.patch` 回执提供；JS 的 Creator 编译和 TS 的精确编译产物分别记录。运行观察既有 2.4.15 路径已将 Creator 工程/场景身份、Agent 自有 Web 页面、Console/异常、帧与暂停状态及截图纳入同一观察回执；隔离工程有初始观察证据，但注入错误→批准修复→编译→刷新→再观察的原生端到端闭环仍待验收。

新增[同会话输入与业务断言合同](cocos-agent-runtime-interaction-0.1.md)，并接入 Host/CDP 源码工具 `cocos_2x_runtime_interact`：仅一次左键点击，要求最新 session/page/generation token、当前状态前置断言和有限节点/组件后置断言；点击后读取相同页面并附回截图。单次动作经 MCP 写入审批。断言失败说明输入已发生但功能未通过；动作回执不确定时禁止重发。实现不用于支付、网络或服务端奖励证明。

**状态：** 编译错误/Console/预览状态/截图沿用既有实现；同会话点击和业务断言合同与源码接线已完成，skill 与引用已更新。未运行测试，尚未打包/安装到 Creator；同会话输入、前后状态断言、Console 增量、截图与错误修复后二次验证均待 Creator 2.4.15 原生验收。未修改 LinkUpClient 或游戏工程。

下一步只在可丢弃的 2.4.15 Web 工程按合同验收：取得基线观察 → 批准一次点击 → 核对业务状态和 Console 增量 → 通过一项已知可逆代码错误走修复/编译/预览刷新 → 新页面上断言恢复行为 → 补偿测试改动并确认哈希。确认真实 LinkUpClient Creator 可达后，再选择与实际项目相关、不会触发外部服务副作用的交互样本。

## 2026-10-17 M3 项目技能与工具扩展进展

新增[项目级 Skill 与工具扩展合同](cocos-agent-project-extensions-0.1.md)与对应产品 skill。MCP 现可发现 `.cocos-agent/skills/` 下的项目知识、按列出的 skill/reference ID 和 SHA-256 读取；工具 Manifest `.cocos-agent/agent-tools.json` 仅允许绑定已有 Creator 2.4.15 命令，提供明确的 read/write 两种路由、禁用项、manifest SHA 竞态检查和底层能力/输入 schema 校验。项目工具不执行任意项目代码；写操作依旧走逐次审批、既有语义命令和操作账本。新增 M3 源码接线未运行测试。

**状态：** 合同已定义、MCP/调度接线已实现、产品 skill 已发布；Creator 原生面板发现/读取、哈希变化拒绝、禁用和写入审批仍未验收。LinkUpClient 当前不在可读写工作区，尚未取得其实际框架约定、UI 工作流或业务 API，也没有修改该项目；需先从工程和 Creator 中核实这些内容，再填充项目 skill/reference 和工具绑定。源码接口完备不代表 LinkUpClient 的业务 API 已成为可执行命令。

## 2026-10-17 M4 任务审阅与恢复进展

新增[任务审阅、权限与 Checkpoint 合同](cocos-agent-task-review-recovery-0.1.md)。Host 现将本 run 的写入回执汇总为代码、场景/Prefab 与其他写入三组，关联 operationId、有限 expectedDiff、脚本路径/UUID 和工具返回的源/候选 SHA；面板显示汇总状态和证据范围，并明确它不等于完整 Git/磁盘 diff。Host 恢复记录会更新任务审阅状态；重启时按已有规则重建摘要。

**状态：** 任务回执汇总与恢复状态展示已接入源码；取消等待进行中的 MCP 回执、重启后写入锁和原 operation 只读核对沿用已有实现。任务范围权限、checkpoint 创建/保存/恢复及冲突交互目前只有合同，未接入代码；当前不支持整项目 checkpoint 或自动回滚。M4 本轮没有运行测试，Creator 原生面板验收待完成。状态不可升级为“任务差异完整”或“checkpoint 已实现”。

## 2026-10-17 M5 真实功能验收进展

M5 目标是先从 Creator 原生面板完成 LinkUpClient 的一项实际功能，再扩展到不同任务类型，并据真实任务记录成功率、人工介入、耗时和恢复结果。指标定义与逐样本字段见[开发方向调整的 M5 执行记录](cocos-agent-unity-alignment-development-direction-20261017.md#2026-10-17-m5-验收执行记录)。

**本次执行结果：未能启动面板任务。** CocosCreator 当前前台停留在启动警告，未加载工程或 Agent 面板；先前 LinkUpClient 前台尝试也未取得该工程的面板、运行回执或实时场景快照。没有对隔离工程或 LinkUpClient 提交新任务，没有写入项目内容。详见[M5 本次 Creator 检查](traces/cocos-agent-m5-attempt-20261017.md)与[LinkUpClient 前台尝试](traces/cocos-agent-linkup-front-window-attempt-20261017.md)。

**M5 指标：** 有效任务样本 0；成功率、人工介入次数、任务耗时和恢复结果均未采集（不是 0% 成功率或零人工介入）。下一步是恢复可读的 LinkUpClient Creator 2.4.15 前台并验证工程身份、Agent 面板/扩展指纹和未决操作；随后从实时项目内容选择首个小功能，固定验收条件与基线，再由 Creator 面板发起任务。未满足这些前置条件前，不使用历史 UUID，不向隔离工程结果冒充真实业务样本。

## 7. 2026-10-12 进度校正与近期顺序

**历史记录：** 本节状态和顺序仅对应当时版本；当前优先级已由 2026-10-17 方向调整与 M1–M5 取代，不能据本节推定后续能力仍未实现或已经通过新版验收。

**当前 TS 验收状态：** Ask/Plan/Agent 均已路由至 TS loop。Creator 面板真实运行通过技能门槛与场景只读任务，并真实执行了一次精确的 `scene.node.patch` compensate。写前核对源账本的 `preview=passed` 与节点当前 `x=221`，面板批准唯一写入后，补偿账本的 editor/disk/recovery 阶段通过；源及补偿账本、最终实时节点 `(220,100)` 均读回确认。runId `86eea250-80f1-4472-8592-88c026c6c4cf`，本机轨迹 `~/.local/state/CocosAgent/agent-runs/2026-10-11T16-21-48-721Z-b052586f.jsonl`。此验收覆盖受限字段的 TS 调度、审批、回执和恢复，不代表脚本开发或新 ID 重放。TS runtime 58/58、MCP/扩展 84/84。Task System / Goal Loop 已有模拟回归，Creator 面板跨重启恢复与验收续跑尚未实测。TS loop 已新增对空模型回复和多工具批调用的有界重试；相关分支由自动测试覆盖，实机任务此次是逐个工具成功完成，没有宣称实机触发重试分支。项目隔离记忆已有本机持久化、确定性任务召回、逐条来源验证、审批写入、候选抽取、版本纠正、内容删除和精确写入恢复；这些仍是自动测试证据，Creator 面板的候选审阅、跨 Host 重启及纠正/删除验收仍待完成。s08 结果档案自动化通过但面板取证未验收。旧 JS 指定 PNG 任务已从 operation `b1d4c0e2-7f3a-4a91-9c58-2e6d10ab4f01` replay 得到 `9c4f7a28-3b51-4e9d-a27c-6f80d13b5e44`；最终节点保留，不能重复 apply/replay。

1. 在独立的真实 2.4.15 游戏工程继续验收 TS Agent：长期记忆创建批准、跨 Host 重启召回、来源纠正、删除后不再召回，以及项目 `AGENTS.md` 哈希门槛、非空选择上下文、多轮任务续接；不以研究工程或模拟 harness 替代。
2. 收按钮脚本任务剩余缺口：让 TS Agent 读取现有 JS、提出精确差异、按面板审批写入、Creator 编译、实际点击验证并恢复；原生新 ID 重放、错误注入修复和独立项目任务仍分别验收，详见 [脚本合同](cocos-agent-script-development-0.1.md)。
3. 完成运行观察错误修复闭环和连续任务体验的 Creator 面板实机验收：独立预览归属、Console/截图读取、取消与 sidecar 重启后的会话恢复。
4. Creator Agent 继续严格限定 Creator 专用命令与技能；不加入通用 shell、团队/子 Agent 协作或定时任务。性能和引擎源码改造由真实任务与可复现测量触发；3.x 按仓库约束暂停新增。

当前源目录包含 14 个产品 skill 与 32 份引用；这是分发实现状态，不代表各技能均经过原生面板模型执行验收。运行观察 skill 和合同见 [运行观察合同](cocos-agent-runtime-observation-0.1.md)。最新 Unity 对照与缺口见 [产品状态复核](cocos-agent-unity-native-status-20261011.md)。
