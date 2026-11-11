# 第 30 课：技术债务登记与优先级

**目标：** 读取 CCGS 的债务登记表，用真实 helper 计算优先级、统计变更窗口、检查重复条目并生成下一个 ID。

完成本课后，你应该能：

1. 按“影响 ÷ 修复成本”理解 `/tech-debt prioritize` 的评分和排序。
2. 区分登记表里的 Open、Resolved 和未评估状态，并读懂时间窗口统计。
3. 在新增条目前检查同一文件已有的 Open 条目，并延续不复用的 TD 编号。
4. 说明只读 helper 的观察结果与 Skill 的写入审批、verdict 之间的边界。

## 问题

一个影响严重但修复要数周的问题，应排在一个小而高影响的问题前面吗？如果登记表已经有同一文件的 Open 条目，又该怎样避免重复记录？本课追踪 CCGS 如何用统一字段回答这些问题，同时保留人工判断和写入确认。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/tech-debt/SKILL.md` | 扫描、新增、优先排序、报告、审批和 verdict |
| `.claude/scripts/debt-register.sh` | 分数、统计、匹配、日期窗口和只读输出 |
| `.claude/scripts/registry.sh` | TD ID 从已见最高编号递增，避免复用已删除 ID |
| `studio-tests/skills/analysis/tech-debt.md` | 空扫描、重复项、未评估值和用户拒绝写入等行为规格 |

## 排序不等于严重程度

Skill 用影响等级除以修复成本：Low、Med、High、Critical 分别按 1–4 计分，S、M、L、XL 分别按 1–4 计分，结果四舍五入到一位小数。分数高代表相对更值得优先处理；如果分数相同，先列登记日期更早的项。影响或成本未判断的条目不猜分，排在已评分项目之后。

helper 的 `score` 从表格当前值重新计算排序，不会把 Priority 写回登记表，也不替团队选择下个 sprint。Skill 在展示结果后还要征求写回许可；`workflow: minimal` 没有 sprint，应把优先项放进 build order。

## 报告与去重

`stats` 把寄存器状态按 Open、Resolved、Accepted 等分开统计，可用 `--since` 和 `--until` 计算日期窗口内的新增、解决数量及净变化。`--older-than N` 按天数筛出更早的 Open 项。helper 只有日期，没有项目的 sprint 日历，因此“超过三个 sprint”仍需 Skill 根据项目时间线解释，不能把 90 天之类的固定数冒充 sprint 数。

`match` 按文件路径查找已有 Open 项，可再限定类别，支持在新增前检查重复覆盖。`next-id` 把编号规则交给 `registry.sh`，扫描登记表中的最高 `TD-NNN` 再加一；删除或解决旧条目不会让编号重新发放。

这四种命令都输出 TSV 观察值且只读。它们不扫描源码中的 TODO/FIXME、不新增或重排登记文件，也不输出 `/tech-debt` 的最终 verdict。Skill 负责分析、询问用户并按许可写文件；`report` 则是只读 Skill 模式。

## 实践：运行真实 helper

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_tech_debt_register.py
~~~

脚本把合成登记表复制到临时项目，然后调用 CCGS 的 `debt-register.sh` 和它委托的 `registry.sh`：

- `score` 将 TD-001 排在前面；TD-005 与 TD-002 都是 1.3 分，较早登记的 TD-005 在前；TD-003 因成本未判断而不评分。
- `stats` 固定以 2026-11-11 为统计日，计算 11 月 1–11 日窗口，并按 30 天阈值列出较旧的 Open 项。
- `match` 用 `./src/world.gd` 找到已有 TD-002，展示新增前检查匹配项的用法。
- `next-id` 在看到 TD-005 后返回 TD-006。

可以编辑 `practice/fixtures/s30_technical_debt/tech-debt-register.md` 中的合成数据再运行，观察分数、状态和统计窗口如何变化。练习会验证临时登记文件在 helper 调用前后字节完全一致。

## 本课结论

登记表把类别、文件、成本、影响、状态和日期组织成可追踪的债务记录；统一 helper 让计分、统计和编号规则一致。数字帮助审查者发现排序与历史变化，是否接受估算、安排工作或更新文件仍由 Skill 流程和用户决定。

## 简化说明

- 输入是合成登记表，不是实际游戏项目的债务数据。
- 练习调用 CCGS 1.2.0 的真实只读脚本，不启动 Claude Code，也不执行 `/tech-debt` Skill。
- helper 不扫描源代码、不解释根因、不改写 Priority、不申请或代替写入批准。
- 年龄单位是天；要按 sprint 判断陈旧项目，仍需要项目自己的 sprint 时间信息。
- CCGS 快照升级后，应重新核对脚本参数、评分和输出格式。

## 自测

1. 一个 Critical、L 的项目与一个 High、S 的项目，分数分别是多少？排序由什么决定？
2. 成本未判断的 Open 项会如何参与排序和 open_ranked 计数？
3. `net_in_window` 是负数能证明整个项目技术债正在减少吗？还需要什么时间范围？
4. `match` 返回已有 Open 项后，Skill 会自动新增或更新它吗？
5. `next-id` 为什么从最高已见 ID 递增，而不从当前行数递增？
