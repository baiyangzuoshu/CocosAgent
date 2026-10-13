# `learn-claude-code` 上游基线与 CocosAgent 模块对应

本文固定 CocosAgent TypeScript 内核的研究基线，并逐章记录哪些机制移植、哪些由 Creator 产品语义适配、哪些暂缓或按产品约定排除。它不表示 CocosAgent 已实现上游课程的全部功能。

## 固定上游版本

- 仓库：[`shareAI-lab/learn-claude-code`](https://github.com/shareAI-lab/learn-claude-code)
- 研究基线：[`0dcafa2ae053a1ddd6a72f265431104b08a5aa13`](https://github.com/shareAI-lab/learn-claude-code/commit/0dcafa2ae053a1ddd6a72f265431104b08a5aa13)，对应上游 `main` 在 2026-10-12 核对到的版本。
- 该提交的课程主线是根目录 `s01`–`s17`。下表链接均指向这个 commit，不随 `main` 后续变化。
- 根课程的 `s01`–`s17` 原始 `code.py` 与 MIT License 已按原字节归档于 [vendor/learn-claude-code](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/)。这些 Python 文件只用于研究和移植对照，不进入 Creator 扩展、运行时或分发包。
- CocosAgent 产品运行时采用 TypeScript + Node.js。**当前没有逐行或机械翻译自上游的 TS 代码；现有 TS 模块是独立实现。** 上游源码原文、文件哈希和可执行校验器构成移植基线；逐章节的保留行为、TS 对应模块和差异见 [PORTING-MAP.md](PORTING-MAP.md)。
- 这里的“机制移植”表示按上游行为独立实现；“Creator 适配”表示将机制接入 Cocos 命令、Creator 面板、MCP 和项目约束。只有实际对照上游源码完成的函数或结构，才可标记为源码移植。

## 逐章对应表

| 上游章节（固定版本） | 处理方式 | CocosAgent 对应实现 | 当前边界与状态 |
| --- | --- | --- | --- |
| [`s01_agent_loop`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s01_agent_loop/code.py) | **机制移植：TS 重写** | [`src/agent-loop.ts`](src/agent-loop.ts)、[`src/contracts.ts`](src/contracts.ts)、[`src/creator-policy.ts`](src/creator-policy.ts) | 循环只负责 Provider 往返、动态工具发现/分发、工具结果配对、轮次/上下文边界与事件。模式过滤及产品门槛通过 `AgentRunPolicy` 注入；Creator 技能、预览验收和不确定写入恢复由 Creator policy 实现。原生面板已验收只读任务及一次受控补偿；不代表一般任务都通过。 |
| [`s02_tool_use`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s02_tool_use/code.py) | **机制移植 + Creator 适配** | [`src/contracts.ts`](src/contracts.ts)、[`src/mcp-tool-registry.ts`](src/mcp-tool-registry.ts)、[`src/cocos-ask.ts`](src/cocos-ask.ts) | 使用实时 MCP 工具目录、输入 schema、工具访问级别和回执。命令仍按 Creator 版本、合同、目标实例及能力逐项校验；不提供课程中的通用 shell 或任意文件操作工具。 |
| [`s03_permission`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s03_permission/code.py) | **Creator 适配** | [`src/contracts.ts`](src/contracts.ts)、[`src/creator-policy.ts`](src/creator-policy.ts)、[`src/cocos-ask.ts`](src/cocos-ask.ts)、[`src/creator-host-adapter.ts`](src/creator-host-adapter.ts) 与 Assistant Host 审批接线 | Creator policy 通过通用审批接口接面板批准，并限制不确定写入只能走身份匹配的恢复工具；Creator MCP registry 继续强制实例/版本/能力、工程根目录和 AGENTS.md 哈希门槛。写入仍须服从 Creator 操作账本。 |
| [`s04_hooks`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s04_hooks/code.py) | **机制移植 + Creator 适配** | [`src/lifecycle-hooks.ts`](src/lifecycle-hooks.ts)、[`src/contracts.ts`](src/contracts.ts)、[`src/agent-loop.ts`](src/agent-loop.ts)、[`src/creator-host-adapter.ts`](src/creator-host-adapter.ts) | 支持 UserPromptSubmit、PreToolUse、PostToolUse、Stop 多处理器注册；按注册顺序触发，工具前拒绝无副作用，停止钩子可在轮次预算内要求继续。Creator policy 仍独立先执行安全门槛；面板/运行记录观察由适配层提供。没有工程自定义脚本或 shell hooks。自动测试通过，Creator 面板生命周期轨迹待实机验收。 |
| [`s05_todo_write`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s05_todo_write/code.py) | **机制移植 + Creator 适配** | [`src/todo.ts`](src/todo.ts)、[`src/agent-loop.ts`](src/agent-loop.ts)、Assistant Host 与 Creator 面板 | Agent 模式可调用 run-local `agent_todo_write` 更新最多 20 项清单，最多一项进行中；工具角色是 `todo`、访问级别为 read，不走 Creator 写入批准或写入账本。执行清单与用户批准的 Plan 分开；Host 持久化并在面板展示，模型失败/取消保留未完成项。自动测试通过，Creator 面板持久化/取消实机验收待完成。 |
| [`s06_subagent`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s06_subagent/code.py) | **按约定排除** | 无 | Creator Agent 不创建子 Agent 或并行委派任务。 |
| [`s07_skill_loading`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s07_skill_loading/code.py) | **Creator 适配** | [`src/agent-loop.ts`](src/agent-loop.ts) 的回执门槛；技能读取目前由 `deepseek-agent.mjs` 的 MCP Resource 适配器提供 | 从 Creator 产品技能目录发现并读取正文、引用，核对同一轮的工具回执。权威技能来源是 `plugins/cocos-agent-2x/skills/`；不依赖 Codex 插件缓存，也未移植上游 Python 技能加载器。 |
| [`s08_context_compact`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s08_context_compact/code.py) | **机制移植 + Creator 适配** | [`src/context-compact.ts`](src/context-compact.ts)、[`src/agent-loop.ts`](src/agent-loop.ts)、[`../cocos-agent-bridge/mcp/assistant-tool-result-archive.mjs`](../cocos-agent-bridge/mcp/assistant-tool-result-archive.mjs)、`src/contracts.ts`、Creator Host 事件和面板 | 大型文本结果先保存到本机每-run 私有档案，再在上下文提供预览；`agent_tool_result_read` 按精确 call ID 在当前 run 内分块找回。其后再缩减旧历史，继续保留 `callId → resultCallId`、Cocos operation ID 和未完成验收/恢复项；恢复锁不允许证据工具旁路。TS/MCP 自动测试通过；Creator 面板超预算及模型实机取证仍未验收。模型拒绝后的自动重试仍未接入。详见 [上下文压缩合同与边界](../../docs/agent-foundation/cocos-agent-context-compaction-0.1.md)。 |
| [`s09_memory`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s09_memory/code.py) | **选择性机制移植 + Creator 适配** | [`src/project-memory.ts`](src/project-memory.ts)、[`../cocos-agent-bridge/mcp/assistant-memory-store.mjs`](../cocos-agent-bridge/mcp/assistant-memory-store.mjs)、Creator Host 与面板写入审批 | 每个 canonical project path 哈希独立持久化；确定性按任务召回；来源须为可核对的用户原文或成功工具回执。`memory_propose` 返回来源校验后的 run-local 候选和相似记录；用户明确授权后，可用 `memory_compact` 合并同类条目，必须先读回每条精确 revision，经面板单次批准、来源并集保留和 CAS 操作记录完成。没有自动推断/写入或自动归档。Creator 面板实机验收仍待完成。设计与证据状态见[工程隔离记忆合同](../../docs/agent-foundation/cocos-agent-project-memory-0.1.md)。 |
| [`s10_task_system`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s10_task_system/code.py) | **Creator 单 Agent 子集已适配** | `src/task-system.ts`、`assistant-task-store.mjs` | 保留 task ID、pending/in_progress/completed、依赖、认领、循环依赖检查和工程隔离持久化；模型不能直接写 completed，必须有成功回执且依赖完成。刻意不移植 owner/team 执行者协作。 |
| [`s11_background_tasks`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s11_background_tasks/code.py) | **按约定排除** | 无通用后台任务系统 | Agent 不启动脱离当前 Creator 任务的通用后台工作。Creator 命令自己的异步状态与恢复记录仍由对应领域流程管理。 |
| [`s12_cron_scheduler`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s12_cron_scheduler/code.py) | **按约定排除** | 无 | Creator Agent 不加入定时任务或调度服务。 |
| [`s13_agent_teams`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s13_agent_teams/code.py) | **按约定排除** | 无 | Creator Agent 不加入团队协作、并行子 Agent、工作树分工或团队协议。 |
| [`s14_mcp_plugin`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s14_mcp_plugin/code.py) | **Creator 适配** | [`src/mcp-tool-registry.ts`](src/mcp-tool-registry.ts)、[`src/cocos-ask.ts`](src/cocos-ask.ts) 与 Creator 管理的 MCP stdio 客户端 | 动态读取当前 Creator 实例的 Cocos 工具目录并校验回执。它不是任意 MCP 插件市场；当前产品命令仍受 Creator 2.4.15、工程和实例边界限制。 |
| [`s15_integrated_harness`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s15_integrated_harness/code.py) | **选择性机制移植 + Creator 适配** | [`src/agent-loop.ts`](src/agent-loop.ts)、[`src/contracts.ts`](src/contracts.ts)、[`src/creator-policy.ts`](src/creator-policy.ts)、[`src/deepseek-provider.ts`](src/deepseek-provider.ts)、[`src/mcp-tool-registry.ts`](src/mcp-tool-registry.ts)、[`src/creator-host-adapter.ts`](src/creator-host-adapter.ts) | Provider、工具注册/目录、循环、回执和策略接口分层；Creator adapter 组合 DeepSeek、Creator-managed sidecar、面板审批、项目上下文、实例/能力预检、项目约定门槛和 Cocos MCP。上游完整 harness 的通用工具、团队、后台与调度机制不一并引入。 |
| [`s16_workflow_runtime`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s16_workflow_runtime/code.py) | **暂缓** | 现有 JS Host/Cocos 命令流水线与领域操作记录仅为相邻设施 | 尚无 TS 通用脚本编排、生命周期事件和可恢复工作流运行时。资源、场景、构建等记录仍由 Cocos 领域流程拥有。 |
| [`s17_goal_loop`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s17_goal_loop/code.py) | **Creator 确定性适配** | `src/agent-loop.ts`、`src/task-system.ts`、`src/creator-policy.ts` | 模型最终回答时，按显式 requiredTools 验收条件核对成功回执；缺项给出缺失项并最多续跑 2 次。继续仍受总轮次/工具调用预算、取消、逐写入审批、Creator policy、恢复锁及上下文预算限制。为避免模型自评误判，不调用独立 LLM 评估器；预览/运行语义仍由 Creator 专属回执门槛核验。 |

## 融合边界

- **机制移植（以 TS 独立重写）：** s01 Agent Loop、s02 Tool Use、s04 Hooks、s05 TodoWrite、s08 Context Compact、s09 中有限的跨会话记忆/任务召回机制，以及 s15 Integrated Harness 中服务单 Agent 的必要骨架。没有上游 Python 源码直接移入 CocosAgent。
- **Creator 适配：** s03 Permission、s04 Hooks 的运行轨迹/面板呈现、s05 TodoWrite 的本地持久化与进度呈现、s07 Skill Loading、s08 的操作账本身份/验收状态与面板预算事件、s09 的工程隔离/来源验证/审批门槛、s14 MCP，以及 s15 中 Provider、运行上下文和工具组装的产品接线。行为以 2.4.15 Creator 实测与 Cocos 合同为准。
- **按约定排除：** s06 子 Agent、s11 通用后台任务、s12 定时任务、s13 Agent Teams；同时排除通用 shell、通用文件写入和不受 Creator 项目/实例合同约束的工具。
- **暂缓研究或实现：** s16 Workflow Runtime；不移植上游团队/多执行者任务调度。s10 Task System 和 s17 Goal Loop 已移植 Creator 单 Agent 子集，Creator Hook/TodoWrite/任务图/目标循环的面板端到端仍需真实 2.4.15 验收，不以自动测试替代。工程长期记忆只支持明确、可追溯的 Creator 项目事实；不等同于上游完整的记忆整理和通用 Agent 学习系统。
- **凭据与状态所有权：** DeepSeek 凭据、会话/计划持久化和产品技能读取仍由 Creator 扩展管理的现有 Host/适配器提供；Cocos 命令继续负责版本/合同/实例检查、审批边界、磁盘读回、回执、对账与补偿。

## 版本与许可维护

- 后续分析或移植必须针对上述固定 SHA；要升级基线时，先记录旧/新 SHA、逐章差异和本地合同影响，再更新本表。不要直接把链接改回浮动的 `main`。
- 上游许可为 MIT，版权归 shareAI Lab。上游源码快照目录内保留原始 `LICENSE` 和 `NOTICE.md`；[SOURCE-MANIFEST.json](../../vendor/learn-claude-code/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/SOURCE-MANIFEST.json) 固定每个文件的 SHA-256 与 Git blob SHA-1。若将来把上游代码复制或翻译进产品分发物，须继续保留版权和许可声明，并记录具体衍生文件。
- 本包开发使用 `npm ci` 安装锁定依赖并构建 `src/`；Creator 扩展分发 TypeScript 编译后的 JavaScript。Python 只用于上游课程示例或既有研究脚本，不是 CocosAgent 产品运行时依赖。
