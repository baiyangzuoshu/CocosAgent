# 第 24 课：Bug 分诊与线上事故复盘

**目标：** 从缺陷记录读出影响与紧急度，再追踪 CCGS 如何把 backlog 分诊、修复验证和线上事故复盘连接起来。

完成本课后，你应该能：

1. 分清严重度（Severity）与优先级（Priority），不把 S1 自动等同于 P1。
2. 对照 `/bug-triage` 的 sprint、full、trend 三种模式，说明它们读取什么、会不会分配任务。
3. 用 `bug-stats.sh` 观察开放缺陷、严重度、系统热点和单条缺陷事实。
4. 区分单个 Bug 报告、缺陷 backlog 分诊和线上事故记录，并列出事故复盘的关键证据。

## 问题

QA 记录了一批问题：有些影响很严重但不挡当前里程碑，有些本身不严重却正好阻塞这个 sprint；同一个系统还出现了多条相似缺陷。怎样排序，又怎样避免把单条 Bug 表格当成一次线上事故的完整复盘？

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/bug-triage/SKILL.md` | Bug 发现顺序、三种模式、严重度/优先级、容量处理、趋势和 P4 确认 |
| `.claude/skills/bug-report/SKILL.md` | 新建草稿、复现信息、verify 与 close 状态闭环 |
| `.claude/scripts/bug-stats.sh` | 缺陷记录的只读汇总、开放规则、按系统计数和单条记录输出 |
| `.claude/docs/templates/incident-response.md` | 事件影响、时间线、根因、缓解、玩家沟通、预防措施与签核 |
| `.claude/docs/automation-modes.md` | 分诊报告写入、状态决策及用户确认边界 |
| `.claude/docs/directory-structure.md` | Bug 文件、QA 产物与事故记录的目录约定 |

## 从记录到分诊

`/bug-report` 把描述整理成带有复现步骤、预期/实际结果、环境和技术上下文的草稿。它不能替用户把外部引擎或供应商仓库的 issue 发出去。修复后，`verify` 需要实际复验和适用的测试证据；只有状态为 `Verified Fixed` 才能走 `close`，关闭时保留验证者与修复记录。

`/bug-triage` 以单条 `production/qa/bugs/*.md` 为首选输入；没有单文件时才回退到合并日志或 QA 计划表。它提供三种运行模式：

- **sprint**：针对当前 sprint 重评开放 Bug，并检查对应 story、剩余容量和溢出。
- **full**：对全部 Bug 排优先级，P1 放当前 sprint，P2 估入下一个 sprint，其他进 backlog。
- **trend**：只读趋势模式，只读头部字段；不为了计算数量而读完整 Bug 正文或分配任务。

如果没有 sprint plan，报告要注明只能分配到 backlog；`workflow: minimal` 下则应说清项目没有 sprint 机制，并把 P1 列为 build order 中下一批修复项。

severity 描述影响：S1 崩溃/丢数据/主要功能完全失效，S2 主要功能受损，S3 有 workaround 的退化，S4 外观或文字问题。priority 描述紧急度：P1 本 sprint 修、P2 下一里程碑前、P3 backlog、P4 接受风险或延期。因此 `S1/P2` 和 `S3/P1` 都可能成立；严重度判断可基于事实，优先级仍由团队决定。

Skill 额外寻找三类偏差：同一 sprint 同一系统 3 条以上提示系统质量问题；同一 story 有 2 条以上 S1/S2 提示 story 应重开审查；已完成 story 上的新 Bug 提示回归。容量已满时不能自动挤入 sprint，要标明 priority overflow。P4 只能是候选状态，用户确认前不能定为 Won't Fix；趋势是信息，不单独作为阻塞门禁。

`bug-stats.sh` 提供只读观察值：总数、开放状态、S1–S4、系统、最旧开放 Bug 和单条报告字段。它按 `Closed` 或 `Verified Fixed` 以外的状态计为开放，并按文件中第一个 Status 字段读取状态。helper 给出的 Bug 年龄是天数，是否超过两个 sprint 仍要结合 sprint 计划判断。它不会自行决定 sprint、P4、回归处理或发布阻断；这些仍由对应 Skill 与用户决策。

## Bug 分诊与事故复盘

每条 Bug 记录的是一个可复现的问题；分诊报告管理一组问题的顺序与容量；`incident-response.md` 模板记录的是一次有玩家影响的线上事件。事故模板要求用玩家视角说明影响，按 UTC 记录检测、根因、缓解、恢复与全绿时间，并区分“直接发生了什么”和“为何现有流程没能阻止”。之后再记录玩家沟通、补偿依据、预防行动负责人/期限，以及技术、QA、制作和社区签核。

这份模板不等于自动事故流程，也不代表所有 Bug 都构成线上事故。反过来，一次事故可能产生多条 Bug、修复任务、沟通和补偿动作；只关闭某个 Bug 不代表事故已完成复盘。

## 实践：分诊合成 Bug backlog

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_bug_triage.py
~~~

脚本把 `practice/fixtures/s24_bugs/` 下的合成报告复制到系统临时目录，调用 CCGS 的真实 `bug-stats.sh --today 2026-11-11`，再打印聚合行和两条可对照的 Bug。预期结果是 6 条记录、5 条开放、1 条已验证关闭；Network 有 3 条开放，其中 2 条为 S1/S2；样例同时包含 `S1/P2` 与 `S3/P1`。

结合 fixture 中的 sprint/story 字段，按 Skill 的条件判断 Network 是否形成同 sprint 热点，以及 story-101 是否达到重新审查线。再检查 Save 的 S1 是否缺少 sprint 分配。脚本展示事实，不替你决定优先级，也不生成 triage verdict。

事故复盘练习：从 Bug 记录中挑一个假设已经影响玩家的事件，用本地模板写出玩家影响、UTC 时间线、根因与预防行动；标清哪些事实仍未知，不能用推测填空。不要把练习产物写到真实项目。

## 本课结论

缺陷处理要把证据、影响、紧急度和容量分开看。Bug report 描述可复现事实，triage 分配处理顺序，verify/close 维护状态闭环，事故模板保存一次玩家事件的响应与预防记录。`bug-stats.sh` 能减少手工计数，却不能替团队批准优先级、改状态或宣告事件结束。

## 简化说明

- 实践运行 CCGS 快照内的真实只读 `bug-stats.sh`，Bug 数据是课程合成文件；没有启动 Claude Code `/bug-triage`、`/bug-report` 或真实事故流程。
- 练习使用一个固定日期，使缺陷年龄输出可复现；它没有重建真实 sprint 容量或产品影响范围。
- 同系统、同 sprint、同 story 的规则来自 `/bug-triage` Skill，辅助脚本只按缺陷头部输出事实。
- `incident-response.md` 是模板，不是自动化 Agent 或应急值班系统。
- 实际操作前应复核对应 CCGS 快照的状态字段和目录约定。

## 自测

1. `S1/P2` 和 `S3/P1` 分别如何描述问题？为什么不矛盾？
2. `/bug-triage trend` 为什么可以不读完整 Bug 正文？它不能做什么？
3. 当 P1 优先级超过当前 sprint 容量时，Skill 要怎样表达？
4. 为什么不能未经用户确认就把 P4 设为 Won't Fix？
5. Bug 已是 `Verified Fixed` 与 `Closed` 有什么流程差别？
6. 线上事故模板中的根因、玩家沟通与后续 Bug triage 分别解决什么问题？
