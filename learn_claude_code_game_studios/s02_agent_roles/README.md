# 第 2 课：Agent 角色与责任边界

**目标：** 从 CCGS 的 Agent 名录和定义文件中，选出适合某项工作的角色，并说明它负责什么、不能替谁做决定。

完成本课后，你应该能：

1. 区分 Agent 名录、Agent 定义文件和运行时委派记录。
2. 从 `description`、职责正文和 `What This Agent Must NOT Do` 判断适配范围。
3. 把专业领域、引擎知识、可用工具和模型档位分开理解。

## 问题

CCGS 为不同工作定义了 49 个 Agent。任务里出现“敌人”“导航”或“发行”这样的关键词，并不意味着只看 Agent 名称就能分配工作。要判断责任边界，需要对照名录中的适用场景、定义文件里的职责和限制，以及具体任务实际需要的专业能力。

## 三层证据

| 层 | 去哪里看 | 读什么 | 能回答什么 |
| --- | --- | --- | --- |
| 角色目录 | `.claude/docs/agent-roster.md` | Tier、领域、When to Use | 初步筛选哪个角色适合任务 |
| Agent 定义 | `.claude/agents/<name>.md` | YAML frontmatter、职责、禁止职责、汇报与协作对象 | 该角色被委派后应做什么、应把什么交给别的角色 |
| 运行记录 | Claude Code 会话中的 Agent 调用 | 实际调用的 Agent 和它收到的任务描述 | 某次会话是否真的委派给该 Agent |

名录把角色分成领导层、部门负责人、专业 Agent 和引擎专长角色。它是职责导航，不等同于“更高层 Agent 天然拥有其他 Agent 的全部专业权”。`.claude/agents/` 中的 Markdown 文件才是各角色的定义；文件存在只能说明已定义，不能证明某一次对话使用过它。

## 观察：读 Agent 定义而非只看名字

Agent 文件的 YAML frontmatter 提供 `name`、`description` 和 `model` 等元数据；正文通常包含协作方式、关键职责、禁止职责以及汇报/协作对象。示例：

| Agent | 主要责任 | 明确边界 |
| --- | --- | --- |
| `ai-programmer` | 行为树/状态机、寻路、感知、NPC 决策与 AI 调试 | 不设计敌人行为；不改核心引擎系统；按设计规格实现 |
| `gameplay-programmer` | 把已确定的玩法设计实现成可测试、数据驱动的游戏代码 | 不擅自改变设计；引擎特定方案遵循目标引擎资料 |
| `godot-specialist` | Godot 节点、场景、API 与引擎架构建议 | 不做玩法设计；不替 producer 管理排期；复杂实现会转给更专门的 Agent |
| `godot-gdscript-specialist` | GDScript 类型、信号、异步和代码模式 | 不拥有敌人 AI 的玩法决策或整体架构决策 |
| `producer` | 计划、范围、风险和跨部门协调 | 不做创意、技术架构或玩法设计决定，也不写游戏代码 |

这些区分来自本地定义正文，而不是本课替每项工作做出的固定路由。相同项目任务若规格、引擎或待办工作不同，主责也可能不同。

### 职责与配置是两条轴

- `description` 帮助 Claude 判断何时适合调用 Agent；职责正文说明调用后如何工作。
- `tools` / `disallowedTools` 描述工具范围。它们不等于某项工作的专业负责权。
- `model` 是模型档位，不是领域等级。`opus` 不会自动让 Agent 成为正确的玩法设计者；`inherit` 表示跟随会话模型。
- `skills`、`memory` 等 frontmatter 配置可能补充可用流程或状态，但不会自动扩大该角色在正文中的责任范围。
- Agent 定义不是一次委派；谁在何时调用、交付什么输入，会在第 3 课展开。

Claude Code 官方文档介绍了自定义 Subagent 的 `description`、工具与模型字段；本地 CCGS 快照仍是本课分析角色范围的主要证据：[自定义 Subagent 文档](https://code.claude.com/docs/en/sub-agents)。官方产品语义可能随 CLI 版本变化，运行时表现应结合实际会话核对。

## 源码对照

| 源码 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/docs/agent-roster.md` | 分层目录、领域和适用场景 |
| `engine/Claude-Code-Game-Studios/.claude/docs/model-tiers.md` | `inherit` 与固定模型档位的区别，以及哪些 Agent 被 pin |
| `engine/Claude-Code-Game-Studios/.claude/agents/ai-programmer.md` | AI 系统的职责与禁止职责 |
| `engine/Claude-Code-Game-Studios/.claude/agents/godot-specialist.md` | 引擎专长和委派边界 |
| `engine/Claude-Code-Game-Studios/.claude/agents/gameplay-programmer.md` | 玩法代码实现边界 |
| `engine/Claude-Code-Game-Studios/.claude/agents/producer.md` | 多部门协调边界 |

## 实践一：盘点真实 Agent 定义

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/inventory_agents.py
~~~

工具会读取当前 CCGS 快照的 Agent frontmatter，并与 `.claude/docs/agent-roster.md` 对表。1.2.0 快照应显示 49 个定义、49 个名录条目；模型字段分布应为 `inherit=30`、`sonnet=16`、`opus=3`。

再用文本筛选找到 AI 寻路候选项：

~~~sh
python3 learn_claude_code_game_studios/practice/inventory_agents.py --search pathfinding
python3 learn_claude_code_game_studios/practice/inventory_agents.py --search Godot
~~~

筛选结果只是搜索命中，不是自动路由。打开 `ai-programmer.md`、`godot-specialist.md` 和 `godot-gdscript-specialist.md`，对照职责正文与禁止职责，判断每个候选 Agent 能承担哪一段。

## 实践二：做一次有依据的角色选择

场景：设计已经规定敌人的巡逻、警戒和追击状态，现在要在 Godot 4 / GDScript 中实现行为树与寻路。

先自己填表，再读上面的定义核对：

| 决策项 | 你的选择 |
| --- | --- |
| 主要负责行为树与寻路实现的 Agent |  |
| 需要引擎 API 建议时咨询谁 |  |
| 谁拥有敌人行为/玩法规则的决定权 |  |
| 哪些职责不能由实现 Agent 自行接管 |  |

按当前快照，`ai-programmer` 的定义覆盖行为树、状态机和寻路，并明确要求实现已设计的行为，而不是自行设计敌人类型或行为。Godot 引擎 API 问题可查 `godot-specialist`；GDScript 类型与代码模式可查 `godot-gdscript-specialist`。玩法规则由设计角色负责。

再将场景改成“跨设计、美术、程序、QA 制定 Boss 里程碑”。对照 `producer.md`，写下 producer 可以协调什么、不能替哪些领域做决定。

### 可选：核对真实委派

在隔离 CCGS 副本中启动 Claude Code，要求它仅阅读 Agent 定义并用 `ai-programmer` 分析上面的实现任务，明确“不要写文件”。观察会话是否出现 Agent 调用，以及子任务简报是否包含设计已确定的状态和目标引擎。若没有运行 Claude Code，这一步记为未执行；静态名录不能替代真实委派记录。

## 本课结论

名录适合发现角色，Agent 文件用于核对责任，运行记录用于确认实际调用。选择时先按任务阶段和领域找主责，再检查禁止职责；需要跨领域知识时，明确区分主责与咨询角色。模型档位和工具范围是配置维度，不代替专业职责判断。

## 简化说明

- `inventory_agents.py` 解析当前 Agent 文件中简单的 frontmatter 字段，不是完整 YAML 解析器，也不预测 Claude 将如何委派。
- 脚本对表能证明文件名录一致，不能证明角色定义没有歧义或运行时 Agent 会严格遵守。
- 1.2.0 中的模型计数来自本地文件；别名具体对应的模型会随 Claude Code 与服务提供方而变化。

## 自测

1. `agent-roster.md`、Agent 文件和会话调用记录分别能证明什么？
2. 为什么 AI Programmer 和 Godot Specialist 可能都参与寻路任务，但责任并不相同？
3. `model: opus` 是否意味着该 Agent 是所有争议的最终决策人？
4. 选择一个 Agent，指出它定义中的一条明确禁止职责，并说明发生越界时应找谁。

每项答案都能用一段源码或一次会话记录支持，即完成本课。
