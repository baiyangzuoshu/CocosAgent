# 第 3 课：委派、并行任务与冲突升级

**目标：** 沿着 CCGS 的协调规则和 `team-*` Skill，判断任务交给谁、哪些阶段可以并行、何时必须等待，以及发生阻塞或跨领域冲突时如何升级。

完成本课后，你应该能：

1. 区分 Agent 定义、Skill 中的委派流程和一次会话里的真实 Agent 调用。
2. 从阶段输入与输出找出并行工作、依赖关系、审批门和汇合点。
3. 按 CCGS 规则处理阻塞、同级冲突和跨领域设计变更。
4. 分清单会话 Subagent 与跨会话 Agent Teams。

## 问题

上一课从 Agent 定义回答“某个角色负责什么”。本课继续追问：**一项任务具体怎样被分派，哪些角色真的会启动，结果何时能交给下一阶段？**

Skill 里列出多个角色，不等于每次调用都会启动全部角色；写着“并行”也不代表整条流水线没有依赖。要从阶段输入、输出、门禁和失败处理一起还原委派路径。

## 源码中的协作规则

`.claude/docs/coordination-rules.md` 给出全局边界：

| 情况 | CCGS 规则 | 阅读时要区分 |
| --- | --- | --- |
| 复杂决策的委派 | 领导角色交给部门负责人，再由负责人交给专业角色；不要跳过层级 | 纵向委派不等于每个小任务都要经过所有层级 |
| 同级协作 | 可以咨询；不能替自己领域之外作有约束力的决定 | 咨询意见与决策权不同 |
| 角色冲突 | 先升级给共同上级；没有共同上级时，设计冲突交 `creative-director`，技术冲突交 `technical-director` | 不让其中一个 Agent 静默覆盖另一个的决定 |
| 跨领域设计变更 | 由 `producer` 协调变更传播 | producer 协调传播，不因此取得玩法或技术决策权 |
| 文件边界 | 未获明确委派，不得改动职责目录以外的文件 | 委派还要约定可写范围 |
| 并行工作 | 独立的 Agent 调用先一起发出；收齐结果后再进入依赖阶段；阻塞要立刻显式报告 | 并行发生在依赖图的同一层，不是跳过后续汇合条件 |

这些是 CCGS 1.2.0 快照里的项目规则。它们描述模板要求，并不能单凭文本证明 Claude Code 在某次会话中遵守了这些要求。

## 追踪两个真实 Skill

### `team-combat`

在 `.claude/skills/team-combat/SKILL.md` 中可以追到这条主干：

1. Phase 1 由 `game-designer` 起草设计。
2. Phase 2 由 `gameplay-programmer` 形成架构，再按 `team.size` 规则启动或经核心角色咨询引擎专长角色。
3. 进入 Phase 3 前有架构决策门；`collaborative` 要用户批准，`guided` / `autonomous` 则按各自模式推进，除非结果为 BLOCKED。
4. 当本次 active set 包含相应角色时，Phase 3 的程序、AI、美术等实现工作可并行；`individual` 模式不会自动启动完整名单。
5. Phase 4 汇合做集成，Phase 5 验证，Phase 6 汇报签收。

角色是否实际启动还受 `team.size` 影响：默认 `individual` 时由 `gameplay-programmer` 跑流程，只有任务标记涉及 AI 时才升级启动 `ai-programmer`；其他角色由核心角色咨询，不作为独立 Subagent 启动。Skill 要求在开始前报告本次 active set，避免把“定义里提到的角色”误说成“都已调用”。

### `team-live-ops`

`.claude/skills/team-live-ops/SKILL.md` 的 Phase 3（经济设计）和 Phase 4（数据指标）明确可以并行；Phase 5 内容撰写要等这两项结果都收齐。随后 Phase 6 制定玩家沟通计划，Phase 7 才集中审查和签收。

因此，Phase 3 与 Phase 4 是可并行的一层；Phase 5 是有双重输入的汇合点。某个 Agent 返回 BLOCKED 时，Skill 要求先确认产物是否实际存在，并把阻塞作为未解决项呈现，不能用自己的猜测填补缺失结果。

## Subagent 与 Agent Teams

在这个 CCGS 快照的 `.claude/docs/coordination-rules.md` 中，`team-*` Skills 使用 `Agent` 工具在同一个 Claude Code 会话里委派 Subagent；Subagent 把结果返回父会话。`Agent Teams` 则指多个独立会话共享任务列表，是实验性、显式选择加入的机制，详见 `.claude/docs/agent-teams.md`。

“Team Combat”这个 Skill 名称不表示它启动了 Agent Teams。先看 Skill 里的 `Agent` 委派说明和运行时记录，再判断实际用了哪种机制。

Claude Code 官方文档目前仍将 Agent Teams 标记为实验性、默认关闭；官方也区分单会话 Subagent 与可互相通信、共享任务列表的独立会话团队。运行机制可能随 CLI 版本变化，实际操作前应查当前官方文档：[Subagents](https://code.claude.com/docs/en/sub-agents)、[Agent Teams](https://code.claude.com/docs/en/agent-teams)。

## 实践一：运行源码追踪器

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_team_flow.py
~~~

默认追踪 `team-combat` 和 `team-live-ops`。输出包含阶段标题、显式 `subagent_type` 声明，以及并行、依赖、门禁和阻塞相关的行号。也可以指定一个 Skill：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_team_flow.py team-narrative
~~~

如果源码在其他目录，可传 CCGS 根目录：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_team_flow.py --source /path/to/Claude-Code-Game-Studios team-combat team-live-ops
~~~

根据输出打开相应 `SKILL.md` 上下文，填写这张依赖表：

| Skill / 阶段 | 输入从哪里来 | 哪些可并行 | 进入下一步前等什么 | 阻塞时怎么做 |
| --- | --- | --- | --- | --- |
| team-combat Phase 1–3 |  |  |  |  |
| team-combat Phase 4–6 |  |  |  |  |
| team-live-ops Phase 3–5 |  |  |  |  |
| team-live-ops Phase 6–7 |  |  |  |  |

核对重点：Combat 的实现阶段受架构门控制；Live Ops 的 Phase 5 要等 Phase 3 和 4 都返回。出现阻塞时，保留已完成结果，同时明确缺失项和被它阻断的后续阶段。你的表格至少应区分“可以同时启动的工作”和“必须收齐结果后才能开始的工作”，不能把两者都写成简单的顺序列表。

## 实践二：处理一个协作冲突

场景：战斗设计师希望格挡判定窗口为 0.35 秒；程序员认为目标平台需要 0.25 秒。请按 `coordination-rules.md` 写下：

1. 两人是否可以先互相咨询？
2. 谁能对设计数值作最终决定？如果有共同上级，先升级给谁？
3. 如果这次调整还影响动画、音效和 QA 计划，谁负责协调变更传播？
4. 在争议解决前，程序员能否自行改动设计文件或其他领域目录？

再用 Live Ops 场景练习阻塞处理：如果 Phase 3 经济设计返回 BLOCKED、Phase 4 指标设计已完成，Phase 5 是否能按原计划启动？你应如何报告已完成结果和缺口？

## 可选：观察真实会话委派

在实践副本中启动 Claude Code，要求它只读取 `team-live-ops` 的 Phase 3、4 和 5，说明哪些工作可以并行、Phase 5 的输入条件，并明确“不要调用 Agent，不要写文件”。如果要观察真正的 Subagent 调用，应在副本中显式要求一个只读分析任务，并核对会话记录；静态追踪器本身不会生成该证据。Agent Teams 属于独立会话实验功能，除非你专门要练习该机制，否则不必为了本课开启它。

## 本课结论

委派路径由角色范围、Skill 流程、配置档位和任务依赖共同决定。并行只适用于相互独立的工作；结果必须在依赖门处汇合。冲突按共同上级和领域归属升级，跨领域设计变化由 producer 协调传播。要证明真实调用，查看会话记录，不能用 Skill 文本或脚本命中替代。

## 简化说明

- `trace_team_flow.py` 只按关键词和 Markdown 标题提取静态源码行，不理解完整流程，也不预测 Agent 调度。
- 练习表中的路径由学习者结合前后文整理；脚本命中不能单独证明阶段依赖。
- 官方 Claude Code 文档描述产品当前机制；CCGS 仓库文档描述本地 1.2.0 模板如何要求 Agent 协作，二者的版本边界不同。
- 本课不运行真实 Claude Code Subagent 或 Agent Teams，因此没有实机委派证据。

## 自测

1. 为什么 `team-combat` 文件提到了多个角色，也不能证明一次调用启动了全部角色？
2. Live Ops 为什么能并行 Phase 3 / 4，却必须等它们的结果后再开始 Phase 5？
3. 同级角色意见不一致时，何时找共同上级，何时升级到 `creative-director` 或 `technical-director`？
4. `team-*` Skill 使用 Subagent 是否就表示开启了跨会话 Agent Teams？
5. 你能否指出一次真实委派所需的会话证据，以及静态 Skill 文本无法提供的那项证据？

答案应能由行号证据或明确标记“未执行的真实运行观察”支持。
