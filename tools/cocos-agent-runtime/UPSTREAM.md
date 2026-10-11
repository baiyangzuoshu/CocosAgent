# `learn-claude-code` 上游基线与 CocosAgent 模块对应

本文固定 CocosAgent TypeScript 内核的研究基线，并逐章记录哪些机制移植、哪些由 Creator 产品语义适配、哪些暂缓或按产品约定排除。它不表示 CocosAgent 已实现上游课程的全部功能。

## 固定上游版本

- 仓库：[`shareAI-lab/learn-claude-code`](https://github.com/shareAI-lab/learn-claude-code)
- 研究基线：[`0dcafa2ae053a1ddd6a72f265431104b08a5aa13`](https://github.com/shareAI-lab/learn-claude-code/commit/0dcafa2ae053a1ddd6a72f265431104b08a5aa13)，对应上游 `main` 在 2026-10-12 核对到的版本。
- 该提交的课程主线是根目录 `s01`–`s17`。下表链接均指向这个 commit，不随 `main` 后续变化。
- 课程以 Python 示例呈现机制；CocosAgent 产品运行时采用 TypeScript + Node.js，不运行上游 Python。
- **没有直接复制或翻译上游源码。** 本文中的“机制移植”指根据课程说明和行为自行用 TypeScript 重写；“Creator 适配”指把通用想法接到 Cocos 命令、Creator 面板、MCP 与项目约束。当前源码属于独立实现，不是上游代码的衍生拷贝。

## 逐章对应表

| 上游章节（固定版本） | 处理方式 | CocosAgent 对应实现 | 当前边界与状态 |
| --- | --- | --- | --- |
| [`s01_agent_loop`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s01_agent_loop/code.py) | **机制移植：TS 重写** | [`src/agent-loop.ts`](src/agent-loop.ts)、[`src/contracts.ts`](src/contracts.ts) | 单 Agent 请求/工具/回执循环，加入 Creator 专属技能门槛、有限重试和不确定写入恢复限制。原生面板已验收只读任务及一次受控补偿；不代表一般任务都通过。 |
| [`s02_tool_use`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s02_tool_use/code.py) | **机制移植 + Creator 适配** | [`src/contracts.ts`](src/contracts.ts)、[`src/mcp-tool-registry.ts`](src/mcp-tool-registry.ts)、[`src/cocos-ask.ts`](src/cocos-ask.ts) | 使用实时 MCP 工具目录、输入 schema、工具访问级别和回执。命令仍按 Creator 版本、合同、目标实例及能力逐项校验；不提供课程中的通用 shell 或任意文件操作工具。 |
| [`s03_permission`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s03_permission/code.py) | **Creator 适配** | [`src/contracts.ts`](src/contracts.ts)、[`src/agent-loop.ts`](src/agent-loop.ts)、[`src/creator-host-adapter.ts`](src/creator-host-adapter.ts) 与 Assistant Host 审批接线 | 改为按 Cocos 命令访问级别、面板批准、工程根目录、项目约定哈希和恢复状态控制。不是上游通用命令权限系统；写入仍须服从 Creator 操作账本。 |
| [`s04_hooks`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s04_hooks/code.py) | **Creator 适配** | [`src/agent-loop.ts`](src/agent-loop.ts) 的 Agent 事件与 Host/UI 回调 | 暴露 Agent/工具执行事件供面板呈现和策略检查；不引入可执行 shell hook、工程自定义钩子脚本或通用插件钩子运行时。 |
| [`s05_todo_write`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s05_todo_write/code.py) | **暂缓** | Assistant Host 的计划/会话状态仅为相邻设施 | 结构化 Plan 和持久任务状态不等于 Agent 的 TodoWrite 工具与待办更新协议；目前没有声称移植本章。 |
| [`s06_subagent`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s06_subagent/code.py) | **按约定排除** | 无 | Creator Agent 不创建子 Agent 或并行委派任务。 |
| [`s07_skill_loading`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s07_skill_loading/code.py) | **Creator 适配** | [`src/agent-loop.ts`](src/agent-loop.ts) 的回执门槛；技能读取目前由 `deepseek-agent.mjs` 的 MCP Resource 适配器提供 | 从 Creator 产品技能目录发现并读取正文、引用，核对同一轮的工具回执。权威技能来源是 `plugins/cocos-agent-2x/skills/`；不依赖 Codex 插件缓存，也未移植上游 Python 技能加载器。 |
| [`s08_context_compact`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s08_context_compact/code.py) | **机制移植 + Creator 适配** | [`src/context-compact.ts`](src/context-compact.ts)、[`src/agent-loop.ts`](src/agent-loop.ts)、`src/contracts.ts`、Creator Host 事件和面板 | 请求前估算预算、保留近期交互、确定性折叠旧工具结果。摘要保留 `callId → resultCallId`、Cocos operation ID 和未完成验收/恢复项；畸形配对不发给模型，仍超预算则停在 Provider 请求前。TS runtime 全套自动测试通过；Creator 面板超预算实机验收仍未完成。此机制不包含跨会话记忆或模型拒绝后的自动重试。详见 [上下文压缩合同与边界](../../docs/agent-foundation/cocos-agent-context-compaction-0.1.md)。 |
| [`s09_memory`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s09_memory/code.py) | **选择性机制移植 + Creator 适配** | [`src/project-memory.ts`](src/project-memory.ts)、[`../cocos-agent-bridge/mcp/assistant-memory-store.mjs`](../cocos-agent-bridge/mcp/assistant-memory-store.mjs)、Creator Host 与面板写入审批 | 每个 canonical project path 哈希独立持久化；确定性按任务召回；来源须为可核对的用户原文或成功工具回执。支持版本纠正、内容删除和精确 tool-call ID 恢复。它不是对上游 Python memory manager 的直接移植；不自动抽取推断、不提供用户/工作区跨工程记忆、自动压缩归档或通用文件工具。Creator 面板的创建/纠正/删除实机验收仍待完成。设计与证据状态见[工程隔离记忆合同](../../docs/agent-foundation/cocos-agent-project-memory-0.1.md)。 |
| [`s10_task_system`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s10_task_system/code.py) | **暂缓** | Host 持久任务状态；Cocos 命令自身的操作记录 | 当前没有通用任务依赖图、任务认领或多执行者协作。操作账本用于具体 Creator 写入恢复，不能当作上游 Task System 移植。 |
| [`s11_background_tasks`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s11_background_tasks/code.py) | **按约定排除** | 无通用后台任务系统 | Agent 不启动脱离当前 Creator 任务的通用后台工作。Creator 命令自己的异步状态与恢复记录仍由对应领域流程管理。 |
| [`s12_cron_scheduler`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s12_cron_scheduler/code.py) | **按约定排除** | 无 | Creator Agent 不加入定时任务或调度服务。 |
| [`s13_agent_teams`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s13_agent_teams/code.py) | **按约定排除** | 无 | Creator Agent 不加入团队协作、并行子 Agent、工作树分工或团队协议。 |
| [`s14_mcp_plugin`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s14_mcp_plugin/code.py) | **Creator 适配** | [`src/mcp-tool-registry.ts`](src/mcp-tool-registry.ts)、[`src/cocos-ask.ts`](src/cocos-ask.ts) 与 Creator 管理的 MCP stdio 客户端 | 动态读取当前 Creator 实例的 Cocos 工具目录并校验回执。它不是任意 MCP 插件市场；当前产品命令仍受 Creator 2.4.15、工程和实例边界限制。 |
| [`s15_integrated_harness`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s15_integrated_harness/code.py) | **选择性机制移植 + Creator 适配** | [`src/agent-loop.ts`](src/agent-loop.ts)、[`src/deepseek-provider.ts`](src/deepseek-provider.ts)、[`src/mcp-tool-registry.ts`](src/mcp-tool-registry.ts)、[`src/creator-host-adapter.ts`](src/creator-host-adapter.ts) | Ask/Plan/Agent 已接 TS 内核；使用 DeepSeek、Creator 管理的 sidecar、面板审批、项目上下文和真实 Cocos MCP。上游完整 harness 的通用工具、团队、后台与调度机制不一并引入。 |
| [`s16_workflow_runtime`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s16_workflow_runtime/code.py) | **暂缓** | 现有 JS Host/Cocos 命令流水线与领域操作记录仅为相邻设施 | 尚无 TS 通用脚本编排、生命周期事件和可恢复工作流运行时。资源、场景、构建等记录仍由 Cocos 领域流程拥有。 |
| [`s17_goal_loop`](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s17_goal_loop/code.py) | **暂缓** | Agent 内已有确定性的成功/失败/待恢复门槛 | 尚无独立目标评估器驱动的自动续跑。由回执决定工具是否可继续，不等同于完整 Goal Loop。 |

## 融合边界

- **机制移植（以 TS 独立重写）：** s01 Agent Loop、s02 Tool Use、s08 Context Compact、s09 中有限的跨会话记忆/任务召回机制，以及 s15 Integrated Harness 中服务单 Agent 的必要骨架。没有上游 Python 源码直接移入 CocosAgent。
- **Creator 适配：** s03 Permission、s04 Hooks、s07 Skill Loading、s08 的操作账本身份/验收状态与面板预算事件、s09 的工程隔离/来源验证/审批门槛、s14 MCP，以及 s15 中 Provider、运行上下文和工具组装的产品接线。行为以 2.4.15 Creator 实测与 Cocos 合同为准。
- **按约定排除：** s06 子 Agent、s11 通用后台任务、s12 定时任务、s13 Agent Teams；同时排除通用 shell、通用文件写入和不受 Creator 项目/实例合同约束的工具。
- **暂缓研究或实现：** s05 TodoWrite、s10 通用 Task System、s16 Workflow Runtime、s17 Goal Loop。工程长期记忆只支持明确、可追溯的 Creator 项目事实；不等同于上游完整的记忆整理和通用 Agent 学习系统。
- **凭据与状态所有权：** DeepSeek 凭据、会话/计划持久化和产品技能读取仍由 Creator 扩展管理的现有 Host/适配器提供；Cocos 命令继续负责版本/合同/实例检查、审批边界、磁盘读回、回执、对账与补偿。

## 版本与许可维护

- 后续分析或移植必须针对上述固定 SHA；要升级基线时，先记录旧/新 SHA、逐章差异和本地合同影响，再更新本表。不要直接把链接改回浮动的 `main`。
- 上游许可为 MIT，版权归 shareAI Lab。仓库保留 `LICENSE.learn-claude-code` 作为研究来源记录；由于当前没有复制上游源码，不将本地 TS 模块描述为上游源码衍生作品。未来若直接复制或翻译上游代码，需在分发包中一并保留对应版权和许可声明。
- 本包开发使用 `npm ci` 安装锁定依赖并构建 `src/`；Creator 扩展分发 TypeScript 编译后的 JavaScript。Python 只用于上游课程示例或既有研究脚本，不是 CocosAgent 产品运行时依赖。
