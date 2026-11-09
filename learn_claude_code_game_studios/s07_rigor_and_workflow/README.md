# 第 7 课：Rigor 与工作流档位

**目标：** 把 `modes.rigor` 的六项预设拆开理解，再追踪 `modes.workflow` 怎样改变设计产物和阶段检查。

完成本课后，你应该能：

1. 说明 `modes.rigor` 同时设定哪些相互独立的配置轴。
2. 对比 `minimal`、`standard`、`full` 在设计资料、QA 和工作流路径上的实际差异。
3. 识别显式子设置、单系统覆盖与额外严格规则如何改变预设结果。

## 问题

CCGS 的 `modes.rigor` 容易被误读成“开多少流程”。实际上它是一组便捷预设，会一起给六个设置提供值；其中 `modes.workflow` 决定哪些设计资料是必需的，`qa.level` 决定哪些测试证据必需，`review_mode` 和 `team.size` 则影响审核方式和参与的专家范围。它们一起随预设变化，但各自处理不同问题。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/docs/workflow-modes.md` | 三档工作流、GDD 章节规则、每系统覆盖和更改档位后的处理 |
| `engine/Claude-Code-Game-Studios/.claude/docs/workflow-catalog.yaml` | `minimal` 独立路径与其他档位使用的阶段路线 |
| `engine/Claude-Code-Game-Studios/.claude/docs/effects-map.md` | 六项设置的规范定义与组合关系；这是维护/改写设置规格时的依据，工作流 Skill 运行时按 `workflow-modes.md` 即可，不应加载这份大文件 |
| `engine/Claude-Code-Game-Studios/.claude/skills/gate-check/SKILL.md` | Gate 如何分别读取 `workflow`、`qa.level`、`review_mode`、`team.size` |
| `engine/Claude-Code-Game-Studios/.claude/skills/gate-check/references/gate-systems-design.md` | 同一阶段 Gate 在不同 `workflow` 下如何调整清单 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/yaml-helper.sh` | `modes.rigor` 对六个设置的实际展开表 |

## Rigor 预设给六个设置什么值

| `modes.rigor` | `workflow` | `docs.density` | `qa.level` | `story_granularity` | `review_mode` | `team.size` |
| --- | --- | --- | --- | --- | --- | --- |
| `minimal`（默认） | `minimal` | `terse` | `minimal` | `coarse` | `solo` | `individual` |
| `standard` | `standard` | `balanced` | `standard` | `balanced` | `lean` | `individual` |
| `full` | `full` | `thorough` | `full` | `fine` | `full` | `studio` |

这是默认展开，不是不可改的绑定。给某个子设置写入显式值后，该项保持显式值；其余项目继续由 `rigor` 提供。第 6 课已观察过来源标签；本课要进一步解释每个子设置在工作流中的作用。

## `workflow` 控制哪些设计资料和检查

| 档位 | 写代码前的设计底线 | GDD 章节要求 | 工作流路线 |
| --- | --- | --- | --- |
| `minimal` | 选定引擎，填写一页 `design/game-brief.md`；其中的 build order 就是实现计划 | 不要求 GDD 章节；可以自愿编写 GDD | 使用 `paths.minimal`：Setup Engine → Game Brief → Stories → 实现并逐个关闭 Story；不要求 `/create-epics` 或 `/sprint-plan` |
| `standard` | 游戏概念、系统索引、系统 GDD、架构文档和关键 ADR 等；有视觉素材 Story 时还需 art bible | 5 项必需：Overview、Detailed Rules、Edge Cases、Dependencies、Acceptance Criteria；有数字规则时 Formulas 也必需 | 使用完整阶段路线；各 Gate 依自己的 tier 清单将部分项目降为建议 |
| `full` | 完整设计和架构资料，包括所有 GDD、ADR、art bible 与逐屏 UX 规格 | 8 项全部必需 | 使用完整阶段路线和该档位完整清单 |

`minimal` 不是“没有门槛”：代码开始前仍需引擎选择和已填写的 game brief。不过它走一条不同路线，不经过阶段 `/gate-check`；`workflow-catalog.yaml` 因此让 `/help` 读取 `paths.minimal`，而不是普通阶段阶梯。其他档位使用 `phases`，具体必需项按 Gate 文件逐项定义。

工作流档位是许可式的：任何 Skill 仍可被调用，档位调整的是完整性检查和 Gate 要求，不是命令能不能运行。阶段 Gate 的结论用于指导推进；`workflow-catalog.yaml` 明确保留用户最终决定权。

## 这六个设置并非同一个开关

- **`workflow`：** 哪些设计资料必须存在、Gate 按什么档位检查。它本身不决定 Skill 如何向用户提问，也不决定专家团队规模。
- **`qa.level`：** Gate 如何要求测试证据。`minimal` 可豁免 Story 测试证据和单元测试要求；它仍保留需要时的构建健康检查，UI 与 Visual/Feel Story 的截图也不会因 QA 档位而豁免。`standard` 要求 Logic + Integration 测试通过，`full` 增加全覆盖检查和回归套件。
- **`review_mode`：** 审核采用 `solo`、`lean` 还是 `full`；在 `gate-check` 中，`solo` 会跳过 phase-gate director，`lean` 仍运行 phase-gate director。
- **`team.size`：** 调整每位 reviewer 内使用的专家深度；它本身不决定 phase-gate director 是否运行。
- **`docs.density` 与 `story_granularity`：** 约束说明详略和 Story 大小，不替代 `workflow` 的文档存在要求。

这些轴通过 `modes.rigor` 一起选定，但可以单独覆盖。例如 `workflow: full` 配 `qa.level: minimal` 仍按 full 清点设计资料，同时按 minimal 放宽逐 Story 测试证据；两者没有互相覆盖。`story_granularity` 影响每个 Story 的验收标准负载：`coarse` 约 5–10 条，`balanced` 约 2–4 条，`fine` 每个 Story 约 1 条。`docs.density` 则控制正文详略，从要点式、简短背景到说明理由与备选方案。Smoke check 和视觉截图的保留规则应以 Gate 的引用说明为准。

## 覆盖规则与中途调整

`workflow_overrides.system_overrides` 会替换某一个系统的工作流档位，可以比项目档位更严格，也可以更宽松。例如项目为 `full`、`inventory` 覆盖为 `minimal` 时，该系统不再要求 GDD 章节；其他系统仍按项目档位检查。使用前还要确认覆盖键能匹配到 `design/gdd/<system>.md`。

`edge_cases`、`tuning_knobs`、`art_bible_strict` 是不同的覆盖类型：它们只能额外收紧要求，不能取消所选档位已有的要求。不要把布尔强化规则与可双向替换的 `system_overrides` 混为一谈。

中途改变 `workflow` 不会自动生成、删除或迁移文件；`workflow-modes.md` 要求提醒用户用 `/content-audit` 检查新的必需资料和多余资料。

## 实践一：用 CCGS 自带脚本比较三个预设

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/compare_rigor_tiers.py
~~~

练习脚本把快照中的 `project.yaml` 复制到临时目录，在临时目录中依次调用 CCGS 自带的 `config-set.sh`（先 dry-run）与 `yaml-helper.sh`。脚本结束后临时目录自动清理；它不会改动源码快照或 `practice/workspace/`。在当前模板快照里，输出的六个值应与本课上表一致，并标出 `project.yaml` 或 `rigor:<level>` 来源。若你通过 `--source` 指向已经显式固定了子设置的项目，相关值和来源会显示显式覆盖；那正是优先级生效的证据。

填写并解释这张表：

| 观察问题 | `minimal` | `standard` | `full` |
| --- | --- | --- | --- |
| `workflow` 与 `qa.level` 的有效值/来源 |  |  |  |
| Story 粒度与审核模式 |  |  |  |
| 专家规模 |  |  |  |
| 哪个变化影响文档存在要求？哪个变化影响测试证据？ |  |  |  |

## 实践二：追踪一个 Gate 如何换档

仍从仓库根目录运行：

~~~sh
sed -n '123,180p' engine/Claude-Code-Game-Studios/.claude/docs/workflow-modes.md
sed -n '20,75p' engine/Claude-Code-Game-Studios/.claude/docs/workflow-catalog.yaml
rg -n -A 12 '^## Workflow tier reductions' engine/Claude-Code-Game-Studios/.claude/skills/gate-check/references/gate-systems-design.md
~~~

把 `/gate-check` 的 Systems Design → Technical Setup Gate 按档位整理成变化表：

| 档位 | 主要设计文件 | 哪些项目降为建议或被替换 | 能否仅凭静态清单断言本地项目 Gate 会通过 |
| --- | --- | --- | --- |
| `minimal` |  |  |  |
| `standard` |  |  |  |
| `full` |  |  |  |

核对重点：`minimal` 检查 `design/game-brief.md`，而不是 `game-concept.md`；`standard` 让 pillars 和 Visual Identity Anchor 变为建议，但概念文档仍必需；`full` 保留完整基线。**清单只能说明 Gate 检查规则，不能证明某个真实项目已有这些文件或能够通过 Gate。**

## 本课结论

先把 `modes.rigor` 展开为六个独立设置，再分别查它们控制的行为。判断项目要准备哪些设计资料时看 `workflow` 和相应 Gate 文件；判断测试证据看 `qa.level`；判断谁参与审核看 `review_mode` / `team.size`；判断交互确认频率则属于第 8 课的 `automation`。

## 简化说明

- `compare_rigor_tiers.py` 调用的是本地快照里的真实 Bash 辅助脚本，但只运行设置解析，不会启动 Claude Code Skill 或 Gate。
- 本地源码快照没有配置中的游戏 GDD / `design/game-brief.md` 练习项目。因此本课追踪规则与设置解析，不伪称运行了实际 `/gate-check`。
- `workflow-catalog.yaml` 说明 `/help` 用什么阶段路线提示；它不是一次 Gate 执行结果，也不能替代特定 Gate 的 `gate-<phase>.md` 清单。
- 本课没有涵盖 Automation 的确认策略，也没有逐一重述每个阶段 Gate 的所有条目；相关章节仍按顺序学习。

## 自测

1. 为什么不能把 `modes.rigor` 与 `modes.workflow` 当成同一个设置？
2. `minimal` 仍要求什么设计产物？它与 `standard` / `full` 的路线有何不同？
3. `workflow: full` 与显式 `qa.level: minimal` 同时设置时，文档要求和测试证据分别按什么规则处理？
4. `team.size` 会决定 phase-gate director 是否运行吗？由哪个设置决定？
5. `system_overrides` 与三个布尔型 `workflow_overrides` 在方向上有什么不同？
6. 把项目从 `standard` 改成 `minimal` 后，已有文件会自动删除吗？下一步该检查什么？

答案应能分别指向解析器输出、工作流说明或 Gate 引用文件；没有运行的实际 Gate 明确标为未执行。
