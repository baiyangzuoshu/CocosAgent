# 第 15 课：阶段、Gate 与推进条件

**目标：** 看清 CCGS 用什么表示项目阶段、Gate 如何评估推进条件，以及什么操作会真正更新阶段。

完成本课后，你应该能：

1. 区分七个生产阶段、六个相邻阶段 Gate 和 `minimal` 独立路线。
2. 区分 workflow catalog 的文件观察、gate 文件的评估标准与 `/gate-check` 的 verdict。
3. 分清配置中的 `project.stage`、按文件推断的 `phase_inferred` 和用户推进决定。
4. 说明什么情况下 `/gate-check` 会询问并写入新阶段。

## 问题

当项目里缺一个文档，是否就不能进入下一阶段？看见 `PASS` 是否会自动推进？CCGS 把流程目录、具体 Gate 条件、阶段状态和确认写入分在不同位置。本课以 Concept → Systems Design 为例，读出这些层次的关系，并检查 `minimal` 为什么走另一条路。

## 源码位置

路径均相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/docs/workflow-catalog.yaml` | 七个 phase、`next_phase`、步骤的 required 标记，以及 `paths.minimal`；文件头说明 Gate verdict 的定位 |
| `.claude/scripts/artifact-check.sh` | `--phase` / `--path` 参数；它输出磁盘观察，不输出 PASS/FAIL |
| `.claude/scripts/project-state.sh` | `stage_yaml`、`stage_txt`、解析后的 `stage` / `phase` 与 `phase_inferred` 的区别 |
| `.claude/skills/gate-check/SKILL.md`、`CONTRACT.md` | Gate 入口、评估范围、写入边界和推进限制 |
| `.claude/skills/gate-check/references/gate-systems-design.md` | Concept → Systems Design Gate 的必需项、建议项和 workflow 降档规则 |
| `.claude/skills/gate-check/references/5-verdict.md`、`6-update-stage.md` | verdict 顺序、用户风险接受、阶段双写及写后核验 |
| `.claude/docs/director-gates.md` | `review_mode` 决定 Director Gate 是否运行；workflow 决定 phase panel 宽度 |

## 三种“阶段信号”

### 1. Catalog 列出流程步骤

catalog 有七个阶段：Concept、Systems Design、Technical Setup、Pre-Production、Production、Polish、Release；前六个各自指向下一阶段，Release 没有下一阶段。`required: true` / `false` 描述 `/help` 流程中的必需或可选步骤，不会单独形成 Gate verdict。

`artifact-check.sh` 按 catalog 中的 `glob`、`pattern`、`min_count` 等规则输出 `PRESENT`、`ABSENT`、`SHORT`、`PATTERN_MISS` 或 `NO_CHECK`。它不判断内容是否充分，也不把缺失项裁成 Blocker；`NO_CHECK` 表示无法从磁盘自动观察，不能当作 PRESENT。

### 2. Gate 文件定义这次要评估什么

`/gate-check systems-design` 评估 Concept → Systems Design。Gate 文件比 catalog 更具体：`full` 要求概念文档、pillars 和 Visual Identity Anchor；`standard` 将后两项降为建议；`minimal` 改查 `design/game-brief.md`，并移除 GDD 相关检查。因此即使 artifact helper 显示某一步 `required=true` 且 `ABSENT`，也不能直接得出所有 workflow tier 都无法推进。

Gate 还会对关键产物做内容检查、运行质量检查、询问不可自动验证的事项，并按 `review_mode` 与 workflow 设置运行或缩窄 Director panel。Director 的 READY 也只是 Gate 证据的一部分，不能替代 artifact / quality 检查。

### 3. stage 是状态记录，推进需要明确交互

`project-state.sh` 分别报告 `project.yaml` 中的 `stage_yaml`、旧文件 `production/stage.txt` 中的 `stage_txt`，再按优先级解析有效 `stage` 并映射到 `phase`。`phase_inferred` 是根据目录内容数量推得的观察值，不会自动覆盖 `project.stage`。一个表示配置状态，一个表示磁盘特征；若两者不同，应先查原因，不能把它们当作同一个 verdict。

`/gate-check` 会先给出报告和 verdict。`PASS` 后仍要明确确认阶段更新，Skill 才通过 `set-stage.sh` 同时写 `project.yaml` 和 `production/stage.txt`，再读回核对。`CONCERNS` 不会默认写入：用户需明确接受列出的风险并确认写入。该 Skill 的合同规定 `FAIL` 和 `NOT ASSESSED` 不写新阶段。

workflow catalog 顶部称 phase Gate verdict 为 advisory，表明它是供决策的审查结果；落实到此版本的 `/gate-check` 写入合同，`PASS` 或经用户接受风险的 `CONCERNS` 才有阶段写入路径。不要把“用户确认”简化成可以覆盖任意 verdict。

## `minimal` 为什么不在阶段阶梯上？

catalog 的 `paths.minimal` 是独立的 Engine Setup → Game Brief → Stories → Build Next Story → Close the Story 路径；正常路线不走 phase ladder，也不运行 `/gate-check`。catalog 注释据此称 `project.stage` 不离开 Concept。另有 Gate 文件把 Systems Design → Technical Setup 标为 minimal 下“不适用”，给出说明性 PASS，并说明确认后仍可写入阶段。

这里有一处源码边界不一致：`gate-systems-design.md` 也允许 minimal 用 `game-brief.md` 评估 Concept → Systems Design；`gate-technical-setup.md` 又允许不适用 Gate 在用户确认后写 stage。也就是说，catalog 描述的是 minimal **正常路线**不运行 Gate，而 Gate 文档仍保留了**手动调用**时的阶段写入规则；“stage 永不离开 Concept”不能当作所有调用方式下的保证。阅读或改造 CCGS 时应保留这一区分，并把它视为文档合同需要澄清的地方。

因此，读 minimal 项目时应查 `paths.minimal` 和对应 Gate 的 tier 规则，而不是把它的游戏简报或 Story 缺席标成概念文档缺失，再拿 full 路径的判断套用。

## 实践一：运行 CCGS 的只读盘点器

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_gate_flow.py
~~~

脚本对本地快照运行 `project-state.sh`、`artifact-check.sh --phase concept` 和 `artifact-check.sh --path minimal`。当前快照没有游戏项目的 `project.yaml` / `production/stage.txt`，所以预期 stage 为 unset；Concept 与 minimal 的游戏产物也会显示缺失。这些值描述模板快照，不是游戏项目的 Gate 结果。

若已有按 CCGS 结构配置的隔离游戏副本，可指定它并选择某个阶段：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_gate_flow.py \
  --project learn_claude_code_game_studios/practice/workspace \\
  --phase pre-production
~~~

观察 `stage` 与 `phase_inferred` 是否一致；再看 phase 与 minimal 输出的目录来源。挑一个 `ABSENT` 项，打开对应 Gate 文件，核对该项在项目 workflow tier 下是必需、建议还是不适用。**不要**根据脚本输出自行改 stage。

## 实践二：在隔离副本观察 Gate 的人工确认

在[实践环境说明](../practice/README.md)创建的 CCGS 副本中，用一个确实具备对应输入的游戏项目进行：

1. 先运行 `project-state.sh` 对照声明 stage 与 `phase_inferred`，确定要评估的相邻阶段。
2. 对已有 Concept 产物的项目运行 `/gate-check systems-design`，观察它按配置加载目标 Gate，而不是遍历所有阶段的 Gate 定义。
3. 对照报告的 artifact、quality、manual check 和 Director 结果，辨别 `PASS`、`CONCERNS`、`FAIL` 与 `NOT ASSESSED` 的原因。
4. 若出现 PASS，先检查写入目标和报告，再回答是否推进；完成后检查两个 stage 文件是否一致。CONCERNS 时只在明确接受风险后考虑推进。
5. 如果没有可运行的 Claude Code 会话，只完成脚本盘点并标注“未执行实际 Gate”；不要把 helper 的 `ABSENT` / `PRESENT` 当作 `/gate-check` verdict。

## 本课结论

Catalog 帮助定位流程项，helper 盘点磁盘现状，目标 Gate 文件规定 tier 下的评估标准，`/gate-check` 综合人工与自动证据形成 verdict，用户确认后才可能写入 stage。`minimal` 使用独立路线，不能把 phase ladder 的全部 artifact 要求照搬过去。

## 简化说明

- `trace_gate_flow.py` 只运行 CCGS 自带的只读辅助脚本，不模拟 Claude Code 的 Agent、询问或 verdict，也不修改项目文件。
- `artifact-check.sh` 按 catalog 观察文件，不评估文档内容或 Gate tier；实际 Gate 还需读目标 Gate 文件并执行其质量检查。
- `project-state.sh` 的 `phase_inferred` 是基于有限文件计数规则的提示，不等同于 `/project-stage-detect` 的完整诊断，更不是推进建议。
- 本课依据本地 CCGS 1.2.0 快照。升级后重新核对 catalog、gate-check Skill、Gate 参考文件和 helper 行为。

## 自测

1. `artifact-check.sh` 对一项输出 `ABSENT`，为什么不能直接判断它在当前 Gate 是 blocker？
2. `required: true` 和 Gate 文件中的 required artifact 清单分别在哪一层起作用？
3. `stage` 与 `phase_inferred` 各表示什么？为什么冲突时不应直接自动覆盖？
4. `PASS` 会不会自动写入新阶段？`CONCERNS`、`FAIL` 和 `NOT ASSESSED` 分别需要什么处理？
5. `review_mode` 和 `workflow` 分别如何影响 Director Gate？
6. `minimal` 为什么不应按完整阶段阶梯检查？
