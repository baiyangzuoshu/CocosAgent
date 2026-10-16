# learn-claude-code 源码基线与 CocosAgent 移植映射

## 固定基线

- 上游仓库：[shareAI-lab/learn-claude-code](https://github.com/shareAI-lab/learn-claude-code)
- 固定 commit：[`0dcafa2ae053a1ddd6a72f265431104b08a5aa13`](https://github.com/shareAI-lab/learn-claude-code/commit/0dcafa2ae053a1ddd6a72f265431104b08a5aa13)
- 原始源码快照：[vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/)
- 快照包含上游根目录 `s01`–`s17` 的 `code.py` 与原始 MIT License；源码文件未经修改。它们只用于源码对照，不进入 CocosAgent 运行时。
- 文件 SHA-256 与 Git blob SHA-1 记录在 [SOURCE-MANIFEST.json](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/SOURCE-MANIFEST.json)。运行 `node tools/cocos-agent-runtime/scripts/verify-upstream-baseline.mjs` 可逐项验证。
- 产品运行时使用 TypeScript + Node.js。**目前没有逐行或机械翻译自上游的 TS 代码**；已有 TS 模块是独立实现。下表说明每章的源代码行为、当前对应模块和差异，作为后续真正移植时的逐模块基线。
- “独立实现”表示参考机制后自行实现；“适配”表示接入 Creator 专属边界；“尚未移植”表示产品没有对应机制；“排除”表示产品范围决定不实现。

## 逐章移植映射

| 章节 / 原始源码 | TS 对应模块与状态 | 移植时需保留的上游行为 | CocosAgent 适配或当前差异 |
| --- | --- | --- | --- |
| s01 Agent Loop · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s01_agent_loop/code.py) | `src/agent-loop.ts`, `src/contracts.ts` · **独立实现** | 模型请求 → 动态发现工具 → 工具调用 → 执行 → 回执进入消息 → 继续到模型停止。 | 循环主体不再识别 Cocos 工具名或操作字段。共享 `ProviderError`/`ProviderErrorCode` 将 Provider 失败归一化；首次 `PROVIDER_CONTEXT_LIMIT` 仅允许一次 65% 降预算重试，重复超限停止，取消在压缩和分发前检查。其余 Provider 错误不触发超限压缩。协议映射留在 Provider 适配器。产品限制由 run-scoped `AgentRunPolicy` 提供；Creator 技能门槛、写入审批、单步写入、不确定写入恢复限制仍为程序约束。|
| s02 Tool Use · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s02_tool_use/code.py) | `src/contracts.ts`, `src/mcp-tool-registry.ts`, `src/cocos-ask.ts` · **独立实现** | 工具定义与 handler 分离；按工具名分发；将执行结果作为对应调用的结果返回。 | 工具由真实 MCP 目录动态取得，并按 Creator 版本、实例、schema、访问级别校验；不提供通用 shell 或任意文件读写。 |
| s03 Permission · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s03_permission/code.py) | `src/contracts.ts`, `src/creator-policy.ts`, `src/cocos-ask.ts`, `src/creator-host-adapter.ts` · **Creator 适配** | 工具执行前检查权限；拒绝的工具调用应得到明确结果。 | `AgentPolicy.approveWrite` 接面板批准，Creator tool registry 校验目标实例、Creator 版本/能力、工程根目录和 AGENTS.md 哈希；run policy 强制技能证据、操作身份和恢复限制。 |
| s04 Hooks · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s04_hooks/code.py) | `src/lifecycle-hooks.ts`, `src/agent-loop.ts`, `src/creator-host-adapter.ts` · **机制移植 + Creator 适配** | `UserPromptSubmit` 输入上下文、`PreToolUse` 拒绝、`PostToolUse` 回执后处理、`Stop` 继续/结束；多个处理器按顺序运行。 | Hook Registry 是 TS 内核通用机制；Creator policy 的硬性授权/恢复检查先于生命周期工具前钩子，Stop 钩子不能绕过该策略。宿主接入轨迹记录；不支持用户脚本或 shell hook。自动测试通过，面板实机待验。 |
| s05 TodoWrite · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s05_todo_write/code.py) | `src/todo.ts`, `src/agent-loop.ts`, `tools/cocos-agent-bridge/mcp/assistant-host.mjs`, `2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js` · **机制移植 + Creator 适配** | run-local 清单最多 20 项、状态为 pending/in_progress/completed、同一时刻最多一项 in_progress；模型用工具更新，三轮无更新时收到提醒。 | 内核专用工具不调用 MCP、不获得 Creator 写批准；清单进度与 Host 的用户批准 Plan 分开。Host 持久化清单，面板区分显示并在失败/取消后保留未完成步骤。自动回归通过，Creator 面板持久化实机验收待做。 |
| s06 Subagent · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s06_subagent/code.py) | 无 · **按产品范围排除** | 创建子 Agent 并把子任务委派给独立 Agent。 | Creator Agent 不创建或并行调度子 Agent。 |
| s07 Skill Loading · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s07_skill_loading/code.py) | `src/agent-loop.ts`；Host 的 `deepseek-agent.mjs` MCP Resource 适配器 · **Creator 适配** | 读取技能索引，按任务需要加载技能内容。 | 技能来自 Creator 产品目录；内核按同轮回执执行读取门槛。读取实现仍在 Host 适配器，不是 TS 内核自带的通用文件加载器。 |
| s08 Context Compact · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s08_context_compact/code.py) | `src/context-compact.ts`, `src/agent-loop.ts`, `../cocos-agent-bridge/mcp/assistant-tool-result-archive.mjs`, `../cocos-agent-bridge/mcp/assistant-conversation-summary.mjs`, Host 与面板 · **独立实现 + Creator 适配** | 大型工具结果先私有归档并以短预览进入上下文；需要时按当前 run 的 exact call ID 分块取回，然后才压缩旧历史。 | 运行时压缩保留调用/回执 ID、操作身份和待验收状态；档案只接受当前 run 与精确 call ID。Host 在 24 条消息裁剪前存储项目/会话隔离摘要及有界用户原文片段，并在新回合/Host 重启后继续携带；面板解释压缩和预算停止事件。产品包资源测试与技能引用哈希检查通过。2026-10-16 Creator 原生长会话预验收发现旧 Host 的模型摘要会误答早期精确约束；片段修复包待真实 Creator/Host 重启后回归。Provider 超限和大型证据取回仍待原生验收。见上下文合同及[流程修复合同](../../docs/agent-foundation/cocos-agent-intent-context-provider-repair-0.1.md)。 |
| s09 Memory · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s09_memory/code.py) | `src/project-memory.ts`、MCP memory store · **选择性实现** | 跨会话存储、按相关性召回、来源和修订管理，并提供当前 run 内带验证来源的记忆候选提取。 | `memory_compact` 支持用户明确授权后合并 2–8 条同类别记忆；同一 run 必须逐条精确读取 revision，来源引用并集上限为 8，单次批准后 CAS 更新目标并为移除项留下无正文 tombstone。无自动语义归并或后台写入；Creator 面板端到端验收待完成。 |
| s10 Task System · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s10_task_system/code.py) | `src/task-system.ts`, `tools/cocos-agent-bridge/mcp/assistant-task-store.mjs` · **Creator 单 Agent 子集已适配** | 持久 task ID、pending/in_progress/completed、依赖、claim/阻塞检查、按成功回执满足条件。 | 工程哈希隔离的用户状态存储；任务工具只写 Agent 元数据，不写 Creator 资产；无 owner/team 执行者机制；任务完成不能由模型直接声明。 |
| s11 Background Tasks · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s11_background_tasks/code.py) | 无通用后台任务系统 · **按产品范围排除** | 启动后台任务并将完成结果送回 Agent。 | 仅保留 Creator 命令本身的异步回执；不启动脱离当前 Creator 任务的通用工作。 |
| s12 Cron Scheduler · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s12_cron_scheduler/code.py) | 无 · **按产品范围排除** | 安排未来时间执行任务并把结果通知 Agent。 | Creator Agent 不含定时调度服务。 |
| s13 Agent Teams · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s13_agent_teams/code.py) | 无 · **按产品范围排除** | 多 Agent 团队、任务认领和团队消息协议。 | Creator Agent 不含团队、子 Agent、并行委派或团队协议。 |
| s14 MCP Plugin · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s14_mcp_plugin/code.py) | `src/mcp-tool-registry.ts`, `src/cocos-ask.ts` · **Creator 适配** | 发现工具、组装工具池、调用外部工具并将错误回给模型。 | CocosAgent 使用 Creator 管理的 MCP stdio 服务和真实命令目录；教程示例为模拟服务，不是同一传输实现。工具仍受 Creator 工程与实例边界限制。 |
| s15 Integrated Harness · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s15_integrated_harness/code.py) | `src/agent-loop.ts`, `src/contracts.ts`, `src/creator-policy.ts`, `src/deepseek-provider.ts`, `src/creator-task-intent.ts`, `src/creator-host-adapter.ts`, `assistant-host.mjs`, Creator Panel · **单 Agent 子集** | 将循环、Provider、工具注册/分发、权限与回执接入同一 Agent 运行链路。 | Creator adapter 在任务命令前用无工具 Provider 请求提出并程序校验结构化意图；Host 持久化只供 UI 使用的意图提案，Creator 面板显示任务类别/字面目标并强调不授予批准。Adapter 对 Provider 私有错误作中立分类，loop 只按通用超限错误执行有界策略。技能/reference index 及哈希在 Creator 包构建时重算；自动检查覆盖，不等于 Creator 面板实机验收。s10 Task System 和 s17 Goal Loop 已按单 Agent 子集适配；后台、Cron、Teams 按产品约定排除。 |
| s16 Workflow Runtime · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s16_workflow_runtime/code.py) | 无 TS 通用工作流运行时 · **尚未移植** | 由可信脚本定义可恢复的编排，记录阶段进度，并按定义执行多步/并行调用。 | Cocos 资源/场景流水线是领域命令和账本，不是通用工作流运行时；通用脚本编排暂缓。 |
| s17 Goal Loop · [code.py](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s17_goal_loop/code.py) | `src/agent-loop.ts`, `src/task-system.ts`, `src/creator-policy.ts` · **Creator 确定性适配** | 模型最终回答触发验收；显式 requiredTools 对应成功回执；缺项有界续跑并带缺失清单。 | 最多续跑 2 次，仍受总轮次/工具调用预算、取消、单写入审批、恢复锁与 Creator policy 限制。无独立 LLM 评估器，避免自我评价替代磁盘/预览/账本证据。 |

## 后续源码移植要求

### 单 Agent 内核与 Creator 策略边界

- `agent-loop.ts` 只处理 Provider 请求/响应、工具目录刷新、调用 ID 与回执配对、上下文预算、通用轮次限制和 Agent 事件；不得按 `cocos_2x_*` 名称或 Creator 操作字段分支。
- `AgentPolicy` 负责写入批准；每次 `run()` 调用通过 `createRunPolicy()` 创建隔离状态，避免并发任务共享技能/恢复状态。策略接口提供工具过滤、调用前决策、回执标准化与后处理、模型停止/继续决策和恢复状态查询。
- `creator-policy.ts` 强制 Cocos 技能/引用证据、预览验收和不确定写入的单一身份恢复；`cocos-ask.ts` 的 Creator MCP registry 强制实例/版本/能力、工程路径与项目约定哈希门槛；`creator-host-adapter.ts` 完成三者与模型、面板审批、上下文的组合。
- Cocos 工具通过 `ToolRegistry.listTools()` 动态提供给 Provider，并由注册表按工具定义分发。新增一般 Cocos 命令应通过工具合同/注册表和相应 Creator 适配策略接入，不改 `AgentKernel` 循环；只有引入新的安全语义或新验收门槛时，才需扩展 Creator policy，不得把约束移入模型提示中替代程序校验。
- `ModelProvider` 是与 DeepSeek 解耦的 Provider 接口。循环主体不依赖网络协议或具体模型；凭据与请求格式留在 Provider/Creator Host 接线中。

- 移植前先阅读固定快照中的源文件和对应章节说明，再按模块拆分 TS 改动。
- 每个 TS 文件或函数在提交说明中标明上游文件、上游符号、保留行为和改变行为。
- 只有实际对照源代码完成的函数或结构才标记为“源码移植”；仅实现相似行为仍标记为“机制独立实现”。
- Creator 特有的实例、权限、操作账本、磁盘读回、预览验收和失败补偿放在适配边界，并通过 TS 接口接入；不要把产品约束伪装成上游行为。
- 上游快照不可编辑。升级时新增 commit 目录、许可证和新清单，并记录新旧 SHA 与逐章差异。
