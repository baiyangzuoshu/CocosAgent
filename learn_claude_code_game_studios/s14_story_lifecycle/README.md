# 第 14 课：Story 生命周期

**目标：** 追踪一条 Story 如何从设计要求被拆分，经过就绪检查和实现，最终凭可核查证据关闭。

完成本课后，你应该能：

1. 读懂 Story 文件中的需求、实现边界、依赖和证据路径。
2. 区分 `/story-readiness` 的只读 verdict 与 Story 文件本身的状态。
3. 解释 `/dev-story` 和 `/story-done` 各自允许写什么、需要哪些确认。
4. 使用 CCGS 自带 helper 检查 Story 状态与事实，并判断它们不能证明什么。

## 问题

Story 不是一句待办标题。它把 GDD 要求、ADR 决策、实现边界、依赖关系和验收证据装进一个可执行单元。如果没有明确的完成条件，开发者就会补出未决定的设计；如果只看到 `Status: Complete`，又可能误以为测试已经通过。本课按本地 CCGS 1.2.0 源码追踪 Story 的创建、检查、开发和关闭。

## 源码位置

路径均相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/docs/workflow-catalog.yaml`、`.claude/docs/workflow-modes.md` | minimal 与 standard/full 的 Story 路径差异；Story 粒度、workflow 和 QA 档位各控制什么 |
| `.claude/docs/templates/story.md` | Story 文件字段、验收标准、实现范围、测试和依赖格式 |
| `.claude/skills/create-stories/SKILL.md`、`.claude/skills/create-stories/CONTRACT.md` | Story 的来源、分型、Ready/Blocked 判定、写入审批和下游交接 |
| `.claude/skills/story-readiness/SKILL.md`、`.claude/skills/story-readiness/CONTRACT.md` | 只读清单、BLOCKED / NEEDS WORK / NOT ASSESSED / READY verdict |
| `.claude/skills/dev-story/SKILL.md`、`.claude/skills/dev-story/CONTRACT.md` | 实现前置条件、In Progress 确认、Agent 路由、解析与运行观察 |
| `.claude/skills/code-review/SKILL.md` | standard/full 实现后、关闭前的代码审查 |
| `.claude/skills/story-done/SKILL.md`、`.claude/skills/story-done/CONTRACT.md`、`.claude/skills/story-done/references/review-gates.md` | 验收标准、证据门槛、范围偏差、关闭审批和 Complete 写入 |
| `.claude/scripts/story-status.sh`、`.claude/scripts/story-facts.sh` | 路线状态排序、Story 字段和 readiness lint 观察值 |

## 一条 Story 从哪里来？

### 创建阶段：设计成为可实现的工作

`/create-stories` 对每个 epic 运行一次，并按 Foundation → Core → Feature → Presentation 的顺序拆分。

- `minimal`：读取一页 `design/game-brief.md`，一个 Story 对应一个 MVP feature，并按 brief 的 Build order 排列。不需要 `/create-epics`、GDD、TR Registry、ADR 或 control manifest。
- `standard/full`：读取 epic、对应 GDD、TR Registry、control manifest 和所有关联 ADR；Story 里的需求要引用 TR-ID，实施说明来自 ADR，边界和分层来自 epic/manifest。
- 每条 Story 先确定 Type：Logic、Integration、Visual/Feel、UI 或 Config/Data。Type 会影响测试和证据。
- 如果其 governing ADR 仍为 Proposed、Deprecated 或 Superseded，Story 会是 Blocked；Story 不得把尚未接受的决定写成 Ready。
- Skill 先展示整批 Story 并征求一次写入同意，之后才写各 `story-NNN-*.md`、Epic 的 Stories 表，以及存在时的 `production/epics/index.md`。创建 Story 不会开始写游戏代码。

模板中的关键合同：

| 字段 | 开发者用它做什么 |
| --- | --- |
| `GDD` + `Requirement` / TR-ID | 找到设计要求；当前要求文本仍以 TR Registry 为准 |
| `ADR Governing Implementation` + `ADR Decision Summary` + `ADR Version` | 按选定的技术决定实现，并识别决定更新 |
| `Acceptance Criteria` | 对每一项给出可观察、可验证的完成条件 |
| `Out of Scope`、`Dependencies` | 限定实现范围，并列出必须先完成的 Story |
| `Files` | 创建阶段规划文件；`/dev-story` 完成后替换为实际修改清单 |
| `Test Evidence`、`QA Test Cases` | 记录测试/截图/试玩证据位置和预先给出的 QA 规格 |

### 就绪检查：判断是否可以开工

`/story-readiness` 在 standard/full 的交接中位于 `/dev-story` 前；minimal 路径默认直接交给开发，但也可以显式运行 readiness。它是只读 Skill：不会修 Story 或把 `Status` 改成 Ready。

对每条 Story，先用 `story-facts.sh --lint` 收集状态、Type、Layer、Estimate、TR-ID、ADR、AC 数量、证据字段、依赖及结构 lint，再逐段读 Story/GDD/相关配置判断内容。就绪检查会区分：

- `BLOCKED`：必须先解除的依赖、ADR 或未决设计问题。
- `NEEDS WORK`：可修复的必需项不满足。
- `NOT ASSESSED`：输入不可读、设计文件不存在或没有 Story 在检查范围内。
- `READY`：阻塞项均通过，advisory gap 仍会列出。

没有 Story 时结果是 `NOT ASSESSED — no stories in scope`，不能把 `Ready: 0 / Needs Work: 0` 当成全绿。standard 下部分架构检查是 advisory；full 更严格。`story_granularity` 决定 AC 最少数量，`qa.level` 决定证据要求，不能用一个档位替代另一个。

### 实现阶段：再次核验前置条件

`/dev-story` 会重新读 Story 和关键事实，不盲信较早的 readiness 结果。它检查引擎是否已配置、被引用 ADR 是否仍 Accepted、依赖是否 Complete，以及档位要求的 TR Registry / control manifest 是否可用。Proposed ADR、缺失的强制依赖或未配置引擎会阻止 Agent 开工。

进入实现前，Skill 先征求把 Story 标记为 `In Progress` 的同意；同意后更新 Story 与存在的 sprint 状态。随后按 Story 类型、分层和引擎配置选择程序员 Agent/引擎专家；程序员依据 AC、scope、ADR 摘要和 Test Evidence 写实现。`/dev-story` 只把状态推进到 In Progress，不负责关闭 Story。

实现结束后还要核实 Agent 报告里的文件确实存在，运行适用的解析检查，并对可见的游戏行为启动工程、截图和观察。测试按 `qa.level` 处理：minimal 可免 Logic/Integration 自动测试；UI 和 Visual/Feel 的截图观察不能因此省略。结果写入 checkpoint 和 Story 的 `Files` 清单。

standard/full 的交接建议在 `/story-done` 前运行 `/code-review`；工作流目录把代码审查列为 optional，所以要区分推荐交接与目录标注。

### 关闭阶段：用证据逐项核对

`/story-done` 将每条 AC 对照当前 GDD/需求、代码、测试文件、用户确认、运行截图或试玩记录。具体行为、性能和手感不能仅凭读代码判定；可见内容需要已打开检查的图片。缺少适用证据时按配置形成 BLOCKING 或 ADVISORY 缺口。

故事 Type 与 `qa.level` 决定最低证据：

| Type | 常见证据位置 | `qa.level: minimal` |
| --- | --- | --- |
| Logic | `tests/unit/[system]/...` | 自动测试可豁免 |
| Integration | `tests/integration/[system]/...` 或试玩记录 | 自动测试可豁免 |
| Visual/Feel | `production/qa/evidence/` 截图与签核记录 | 截图仍需保留 |
| UI | 每个受影响界面的截图 | 截图仍需保留 |
| Config/Data | `production/qa/smoke-*.md` | smoke evidence 可豁免 |

最终 verdict 是 `COMPLETE`、`COMPLETE WITH NOTES`、`NOT ASSESSED` 或 `BLOCKED`。无失败但有 advisory gap 时是 COMPLETE WITH NOTES；缺少输入无法评估时是 NOT ASSESSED；未通过条件是 BLOCKED。Skill 先报告 verdict，再明确询问如何处理；只有用户选择关闭后才写 `Status: Complete` 和 Completion Notes。它会更新存在的 sprint 状态和 session checkpoint，但不会修改实现代码。

## 两个 helper 分别告诉你什么？

从课程仓库根目录运行：

~~~sh
bash engine/Claude-Code-Game-Studios/.claude/scripts/story-status.sh
bash engine/Claude-Code-Game-Studios/.claude/scripts/story-facts.sh --lint --granularity coarse --all
~~~

`story-status.sh` 按开发路线顺序列出 In Review、In Progress、Ready/Not Started、Blocked 等未完成 Story，并报告完成数。它只整理状态行；它不评估 AC，也不替 `/story-done` 关闭 Story。`story-facts.sh` 输出 TSV 事实和 lint 命中；它不生成 verdict，readiness Skill 才结合内容作判断。

CCGS 快照目前没有游戏自己的 `production/epics/**/story-*.md`。因此当前命令预期分别看到 `STORIES none`，以及 `stories 0` / `lint 0`。零条 Story 上的零条 lint 不是 READY，也不证明设计已完成；若无 Story 在范围内，readiness 应报 NOT ASSESSED。

## 实践一：用课程脚本运行 CCGS helper

课程脚本将上面两个只读 helper 指向同一项目，并显示它们各自的退出码：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_story_lifecycle.py
~~~

默认目标是课程附带的 CCGS 源码快照。如需检查隔离副本：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_story_lifecycle.py \
  --project learn_claude_code_game_studios/practice/workspace \
  --granularity coarse
~~~

`--granularity` 要与项目的 `story_granularity` 匹配。对照输出，回答：当前有没有 Story？状态脚本是否在替 Agent 宣布“下一条已 READY”？helper 是否把 lint 结果直接定为 Blocked？

## 实践二：在隔离副本走一条最短闭环

不要在只读源码快照运行会写入或实现代码的 Skill。使用[实践环境说明](../practice/README.md)创建的副本。

1. 在 Claude Code 副本中确认或设置 `modes.workflow=minimal`，按项目需要先完成 `/setup-engine`。
2. 以一个小型单人游戏构想运行 `/brainstorm`，检查并批准 brief 写入。
3. 运行 `/create-stories`。核对它按 MVP features 和 Build order 产生 Story，且没有先替你写代码；在确认列表后再决定是否写文件。
4. 显式运行 `/story-readiness [story-path]`，观察它只报告而不编辑。找一处 lint 与 Skill verdict 对照，理解二者的区别。
5. 对 READY Story 运行 `/dev-story [story-path]`。在开工前检查引擎、依赖及状态确认；若项目中没有可用引擎，只记录 parse/run 未验证，不把静态阅读写成成功运行。
6. 运行 `/story-done [story-path]`，逐项提供 AC 实际观察结果和要求的证据。选择关闭后再检查 Story 状态、Completion Notes 和后续推荐。
7. 再运行 `python3 learn_claude_code_game_studios/practice/trace_story_lifecycle.py --project learn_claude_code_game_studios/practice/workspace --granularity coarse`，对照开始前后的状态与事实。

若只做静态实践，完成“helper 命令 → 输出观察 → 阅读对应 Skill verdict 规则”即可，并明确标记未运行实际 Claude Code、未实现游戏、未运行目标引擎。

## 本课结论

`/create-stories` 把已定设计转成经过确认的实现契约；`/story-readiness` 只读评估契约是否够清楚；`/dev-story` 重新检查前置条件并实现；`/story-done` 根据逐项证据生成 verdict，并在用户同意后关闭。`Status`、readiness verdict、测试文件存在、测试运行通过和游戏画面已观察，是彼此不同的证据。

## 简化说明

- `trace_story_lifecycle.py` 只调用 CCGS 自带的只读脚本，不执行任何 Claude Code Skill，也不写项目文件。
- `story-facts.sh` 的 lint 是结构/规则命中值，不是 READY/NEEDS WORK 结论；内容可测性、GDD 对照和用户可见行为还需按 Skill 核查。
- `/story-done` 检查 test evidence 文件存在性，但不运行测试；测试是否通过由后续 `/gate-check` 或 `/smoke-check` 等实际运行来证明。
- minimal 的自动化测试豁免依据 `qa.level`；UI/Visual-Feel 截图要求仍存在。具体 gate level 还可能受 `testing.strict` 覆盖。
- 本课依据本地 CCGS 1.2.0 快照；升级后重新核对 Story 模板、helper 输出和各 Skill 的前置条件。

## 自测

1. 为什么 `/story-readiness` 返回 READY 也不代表 Story 文件已被更新或已开始开发？
2. `/create-stories` 为什么不能把 Proposed ADR 对应的 Story 标为 Ready？
3. `/dev-story` 修改的状态是什么？它为什么不应把 Story 关成 Complete？
4. `/story-facts.sh` 的 lint 和 `/story-readiness` 的 verdict 有什么关系？
5. `/story-done` 看到测试文件存在后，能否报告“测试通过”？后续哪个流程会运行测试？
6. `qa.level: minimal` 下哪些类型仍需要截图？
7. 没有 Story 时，为什么 helper 输出 `lint 0` 不能称为全绿？
