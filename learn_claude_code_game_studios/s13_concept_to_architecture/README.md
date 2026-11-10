# 第 13 课：从概念到架构

**目标：** 追踪 CCGS 如何把玩家体验的创意，逐步落实成系统设计、架构决定和可追踪的技术要求。

完成本课后，你应该能：

1. 区分 `minimal` 的一页 brief 路线与 `standard/full` 的系统设计路线。
2. 沿概念、系统索引、单系统 GDD、总架构、ADR 和架构审查定位各阶段产物。
3. 解释 ADR 的 `Proposed` 与 `Accepted` 差异，以及两种 Registry 各自保存什么。
4. 在隔离副本里实际走一小段流程，并用脚本盘点文件链，不把文件存在误认为质量通过。

## 问题

一句游戏创意还不能直接告诉程序员系统如何交互、谁拥有共享状态、接口要满足什么性能要求。反过来，先写技术架构也会让设计者在尚未确定玩法时过早承诺实现方案。本课沿 CCGS 的工件链，观察创意如何经由多轮用户决策成为技术约束，并确认每一步的输出和写入边界。

## 源码位置

路径均相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/docs/workflow-catalog.yaml`、`.claude/docs/workflow-modes.md` | `minimal` 特殊路径与 `standard/full` 阶段路径，以及哪些设计产物按档位要求 |
| `.claude/skills/brainstorm/SKILL.md`、`.claude/skills/brainstorm/references/full-concept.md` | minimal 写一页 brief；standard/full 形成正式游戏概念；文件写入前确认 |
| `.claude/skills/setup-engine/SKILL.md`、`docs/engine-reference/README.md` | 选择并 Pin 实际引擎；架构参考必须有引擎与版本依据 |
| `.claude/skills/art-bible/SKILL.md` | standard/full 路线在系统设计前确定视觉规范 |
| `.claude/skills/map-systems/SKILL.md`、`.claude/docs/templates/systems-index.md` | 从显式与隐含需求列出系统，排依赖、优先级和设计顺序；索引表列结构固定 |
| `.claude/skills/design-system/SKILL.md`、`.claude/skills/design-review/SKILL.md`、`.claude/skills/review-all-gdds/SKILL.md` | 逐系统创作、审查 GDD，按段落征求同意并及时写入，再做跨 GDD 检查 |
| `.claude/skills/create-architecture/SKILL.md` | 汇总系统边界、数据所有权、数据流、API 和待决 ADR 的主架构图 |
| `.claude/skills/architecture-decision/SKILL.md`、`.claude/skills/architecture-decision/references/0-accept.md`、`.claude/docs/templates/architecture-decision-record.md` | ADR 的状态、备选方案、影响；提出和接受是不同动作 |
| `.claude/skills/architecture-review/SKILL.md`、`.claude/skills/architecture-review/references/3-traceability.md`、`.claude/skills/architecture-review/references/8-write.md` | 要求追踪、冲突和引擎兼容审查，以及报告、矩阵和 Registry 的写入确认 |
| `docs/architecture/tr-registry.yaml`、`docs/registry/architecture.yaml` | 永久需求 ID 与跨系统架构立场的两种 Registry |

## 两条路线：先看 workflow

CCGS 的 `modes.workflow` 决定必须具备哪些设计文档；它与 Automation 模式、Review 方式分别控制不同事情。

| 路线 | 主要产物 | 适用解读 |
| --- | --- | --- |
| `minimal` | `/brainstorm` 写 `design/game-brief.md`，然后按 MVP 和构建顺序拆 Stories | 一页 brief 替代正式概念文档、Art Bible、系统索引和各系统 GDD；默认路线不经过本课的大部分架构产物 |
| `standard` / `full` | 正式概念、Art Bible、系统索引、各系统 GDD 与审查、总架构、ADR、架构审查 | 用于需要跨系统设计与技术追踪的项目；具体 GDD 必填段落随档位不同 |

`workflow-catalog.yaml` 仍列出概念阶段中的系统索引等项目，但 `minimal` 明确使用独立的 `paths.minimal` 路线，不能把阶段阶梯上的缺项套用到 minimal 项目上。实践脚本默认只盘点事实；只有显式传 `--workflow` 才显示对应背景提示，也不会自行判定 Gate。

## 从玩家体验到工程约束

以“玩家在小场地闪避火球，坚持 60 秒”为**课程自造示例**。下面的数值和需求用于说明关系，不是 CCGS 源码或真实游戏项目中的数据。

| 阶段 | CCGS 做什么 | 典型产物 / 示例 |
| --- | --- | --- |
| 概念 | `/brainstorm` 先和用户确定体验、核心循环、目标、失败条件及 MVP。standard/full 形成正式概念文档；minimal 只写一页 brief。 | “保持移动，读懂火球轨迹，撑过 60 秒。” |
| 引擎配置 | `/setup-engine` 按用户选择配置实际引擎和版本 Pin。 | 当前 CCGS 快照提供 Godot、Unity、Unreal 参考；没有 Cocos Creator 版本参考。 |
| 系统拆解 | `/map-systems` 从概念找出明确和隐含系统，再请用户审阅；补上依赖、MVP/Vertical Slice/Alpha 优先级与设计顺序。 | 玩家移动、输入、火球生成/碰撞、计时与回合结果；输入依赖玩家移动。 |
| 系统规则 | `/design-system` 为系统逐段编写 GDD，检查依赖系统，逐段请求批准；之后对各系统运行设计审查和跨 GDD 一致性审查。 | 玩家移动 GDD 可规定“冲刺无敌窗口 0.35 秒”。这条规则应可读、可实现、可验证。 |
| 总体架构 | `/create-architecture` 把获批设计整理为层次、模块责任、共享状态所有权、数据流和 API 边界，并标出还需要 ADR 决定的问题。 | 移动系统负责写入玩家位置；火球系统通过碰撞接口报告命中；UI 只读取回合状态。 |
| 单项决定 | `/architecture-decision` 为一项技术问题记录上下文、方案、替代方案、代价、风险和关联 GDD 要求。新 ADR 从 `Proposed` 开始。 | 一份 ADR 决定冲刺冷却如何由玩家移动系统计时，并说明为什么选该方式。 |
| 架构审查 | `/architecture-review` 将 GDD 要求和 ADR 对照，检查覆盖、冲突、引擎兼容及架构文档缺口；用户选择写哪些报告/索引。 | 示例需求得到稳定 ID `TR-player-movement-001`，映射至相应 ADR；之后可继续关联 Story 和测试。 |

这是依赖链，不是把一个 prompt 自动变成架构。用户在概念、系统清单、依赖、优先级、GDD 章节、架构决策和文件写入点都保留确认机会。standard/full 下，Art Bible 在系统设计前；系统 GDD 需要逐个设计、审查并做交叉检查。完成系统设计后可以运行技术设置 Gate，再由用户决定是否继续总架构；Gate 是建议，不替用户做推进决定。`/create-architecture` 不是跳过这些输入的捷径。

Systems Enumeration 表使用固定列：`#`、`System Name`、`Category`、`Priority`、`Status`、`Design Doc`、`Depends On`。不要额外加 `Description` 列；系统说明和理由放在索引的 Overview、Dependency Map 等段落中，避免改变消费者所依据的表结构。

### 别把三个技术工件混为一谈

| 工件 | 位置 | 记录内容 |
| --- | --- | --- |
| 架构立场 Registry | `docs/registry/architecture.yaml` | 多个 ADR 要遵守的共享立场，例如共享状态唯一所有者、系统接口协议、性能预算、API 决定和禁止模式。示例模板内容以注释示出，不等于已经登记。 |
| TR Registry | `docs/architecture/tr-registry.yaml` | 从 GDD 技术要求提取的稳定 `TR-[system]-NNN` ID 和当前要求文本。已有 ID 不重编号、不删除；过期要求标记 deprecated 或 superseded。 |
| 架构追踪索引 / RTM | `docs/architecture/requirements-traceability.md` | 显示要求与 ADR 的覆盖和缺口；`rtm` 模式可扩展到 Story、测试文件和测试状态。它是矩阵，不是 TR ID 的权威登记处。 |

`Proposed` ADR 即使描述了对应方案，也只能在矩阵里标为 **Covered (Proposed)**，不能当作已接受。只有 `/architecture-decision accept ADR-NNNN` 并获得用户明确确认，才能将状态改成 `Accepted`；架构审查发现覆盖也不会替用户做这个决定。

## 实践一：盘点模板与项目工件

从课程仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_design_chain.py
~~~

默认读取 `engine/Claude-Code-Game-Studios/`。当前目录是 CCGS 模板快照，不是具体游戏项目；预期看不到概念、系统 GDD、总架构或 ADR，但两个 Registry 模板存在且实际登记项为空。脚本打印的“未找到”是文件事实，不等于 Gate 失败。

如果你有由 CCGS 管理的实际游戏项目，显式指定它的根路径和 workflow：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_design_chain.py --project /path/to/game-project --workflow standard
~~~

将输出与项目阶段对照，回答：哪一段链路已有文件？ADR 中有多少仍是 `Proposed`？矩阵里是否覆盖了 GDD 要求？TR Registry 是否已有永久 ID？不要仅用文件数判断设计内容通过。

## 实践二：在隔离副本走一条设计链

不要在课程所读的源码快照里运行会写入的 Skill。复用[实践环境说明](../practice/README.md)创建的 `practice/workspace/` 副本，并先确认 CCGS 目录位于副本内。

1. 在副本 Claude Code 会话里运行 `/settings modes.workflow=standard`，再查看配置解析结果，确认当前 `workflow` 是 `standard`。本课程的最小路线不覆盖系统/架构链。
2. 如果副本还没有实际引擎配置，运行 `/setup-engine` 并 Pin 所选引擎版本。当前快照没有 Cocos Creator 引擎参考；Creator API 需要独立的版本资料，不能用 Godot/Unity/Unreal 文档代替。
3. 以“小场地闪避火球 60 秒”为输入运行 `/brainstorm`。先回答概念问题，检查完整草案，再按 Skill 的确认步骤决定是否写 `design/gdd/game-concept.md`。
4. 按标准路线补做 `/art-bible`，随后运行 `/map-systems`。检查系统列表是否包含概念未直说但实际需要的计时、回合状态和结果 UI；审阅依赖与 MVP 优先级，再决定是否写系统索引。
5. 对每个 MVP 系统运行 `/design-system [系统名]`，逐段确认并运行该 GDD 的 `/design-review`。设计完整后再做 `/review-all-gdds`；需要一致性扫描时运行 `/consistency-check`。
6. 输入齐备后运行 `/create-architecture`，记录一项架构问题，再用 `/architecture-decision [问题标题]` 形成 Proposed ADR。请观察写入审批及 ADR 没有自动变成 Accepted 的原因。
7. 按项目要求补齐架构决定后运行 `/architecture-review`。阅读要求追踪矩阵，区分 Accepted 与 Proposed 覆盖；选择审查输出前，确认是否同意写报告、矩阵和 TR Registry。
8. 回到课程仓库根目录运行 `python3 learn_claude_code_game_studios/practice/trace_design_chain.py --project learn_claude_code_game_studios/practice/workspace --workflow standard`，确认审查前后实际有哪些文件变化。若副本放在其他位置，把 `--project` 改成该项目根路径。输出只说明文件和状态，不替代 Skill 审查或人工内容检查。

若想精简实际练习，可只走 `/brainstorm` → `/map-systems` → 一个 MVP GDD；在记录里说明架构部分尚未执行，不要伪造 ADR 或 TR-ID。运行技能时，每个批准问题都由学习者本人判断；本课程没有在本机快照上调用这些写入型 Skill。

## 本课结论

概念规定玩家要体验什么；系统索引列出游戏要由什么组成、先做什么；单系统 GDD 说明具体行为；总架构明确边界和数据关系；ADR 记录需跨系统遵循的技术决定；架构审查把 GDD 要求、ADR、追踪索引和稳定 TR-ID 接起来。`minimal` 路线有意压缩这条文档链，缺少架构文件本身不能作为缺陷结论。

## 简化说明

- `trace_design_chain.py` 只检查固定路径下的文件存在性和少量 ADR / Registry 字段；不解析完整 YAML schema，不判断 GDD 可执行性、ADR 覆盖质量或 Gate 状态。
- 当前快照是 CCGS 1.2.0 框架模板：其中 `tr-registry.yaml` 的 `requirements` 为空；`architecture.yaml` 里样例是注释。不能把注释样例当作本游戏的架构决定。
- TR-ID 示例 `TR-player-movement-001` 是本课虚构示例。真实 ID 由 `/architecture-review` 按实际 GDD 要求登记，不要提前手写或复用示例。
- 本课不执行 CCGS Skills、编辑器、构建或游戏运行；隔离副本的实践依赖已安装并可启动的 Claude Code。
- 各 Skill、必需文档和模板可能随 CCGS 版本变化；结论针对仓库内快照，升级后应重新核对路径和行为。

## 自测

1. 为什么 `minimal` 下找不到 systems index 不能直接判定概念阶段未完成？
2. `/map-systems` 的系统表有哪些固定字段？为什么不能为了加描述任意扩表？
3. 系统 GDD、总架构文档和 ADR 各自回答什么不同的问题？
4. `docs/registry/architecture.yaml` 与 `docs/architecture/tr-registry.yaml` 分别由什么信息驱动？
5. Proposed ADR 覆盖了某条 GDD 要求，为什么架构审查仍不能记为完整通过？
6. `requirements-traceability.md` 在 `rtm` 模式中会比普通架构追踪多出哪些链路？
7. 当脚本显示某文件存在时，还需要哪些证据才能说它已审查并获批？
