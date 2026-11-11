# 第 29 课：测试不稳定性与运行历史

**目标：** 用 CCGS 的结果统计脚本追踪多次测试运行，并区分间歇失败、持续失败、跳过项和证据不足。

完成本课后，你应该能：

1. 按测试 ID 汇总多份 JUnit 结果，计算有效运行数和失败率。
2. 解释为什么跳过项不进入失败率分母，以及少于三次结果时为何只能标记“疑似”。
3. 区分间歇失败与持续失败，并根据 Skill 的阈值选择隔离、修复或观察。
4. 说明统计 helper、原因分析、隔离登记和最终报告各自的责任边界。

## 问题

一次测试失败后下一次通过，是偶发故障还是测试不稳定？如果同一测试只运行两次，一次失败一次通过，直接按 50% 的失败率隔离它是否可靠？本课从运行历史出发，观察 CCGS 如何避免把少量数据误当成确定结论。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/test-flakiness/SKILL.md` | 历史数据、失败率分层、原因检查、隔离和写入确认 |
| `.claude/scripts/flaky-stats.sh` | JUnit/NUnit/Unreal/文本结果解析、每测试历史、tier 和退出码 |
| `studio-tests/skills/analysis/test-flakiness.md` | 少于三次运行、空日志、阈值和 Skill 行为的测试规格 |
| `.claude/skills/regression-suite/SKILL.md` | 回归套件中的既有 quarantine 清单如何与本 Skill 衔接 |

## 什么才算 flaky

Skill 把 flaky 定义为：在没有代码变化的多次运行中，同一测试既通过又失败。实际审查日志前要确认这些运行来自同一代码状态；`flaky-stats.sh` 只汇总日志，不核对 Git commit。

helper 以每个测试的 PASS + FAIL 作为运行数，SKIP 不进入失败率分母。只有 PASS 而没有 FAIL 的是稳定结果；只有 FAIL 而没有 PASS 的归为 `always-fail`，不是 flaky；只有 SKIP 的测试是 `no-result`。这些情况不能互相折算。

Skill 要求少于三次有效结果时，把同时有 PASS 和 FAIL 的测试标为 **suspected**，不论表面失败率多高，也不能直接隔离。达到三次后，按失败比例分类：

| 层级 | helper 边界 | Skill 建议 |
| --- | --- | --- |
| High | >25% | 暂时隔离，并修复根因 |
| Moderate | 5%–25%（含两端） | 直接调查和修复，暂不隔离 |
| Low | 1%–<5% | 继续观察 |
| Below-low | 0%–<1% | helper 有统计行；Skill 未定义单独的行动层级 |
| Suspected | PASS/FAIL 不足 3 次 | 收集更多运行数据，不隔离 |

helper 将边界明确为每个百分比只落入一个层级。例如 5% 属 Moderate，25% 也属 Moderate。`flaky-stats.sh` 计算分层并输出观察行，不替 Skill 决定隔离或修复，也不调查代码根因。

## 从统计转向原因分析

Skill 对间歇失败给出 timing/async、执行顺序、随机种子、资源泄漏、外部状态、浮点精度和场景加载竞态等原因线索。helper 不读测试源码，也不输出原因；还要用 Grep 检查时间等待、未固定的 RNG、全局状态和浮点相等比较，才可提出可能原因。静态线索依旧不是根因证明。

High 层建议临时 quarantine 并修复；Moderate 应直接修，不先隔离；Low 和 suspected 要继续收集证据。任何隔离都要保留原测试并登记在 `tests/regression-suite.md`。Skill 分别询问是否更新 quarantine 清单、是否写入 `production/qa/flakiness-report-[date].md`，不得把统计结果静默写盘。该 Skill 不调用 director gate。

## 实践：解析合成 JUnit 历史

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_test_flakiness.py
~~~

脚本把 CSV 运行矩阵转成五份临时 JUnit XML，按明确顺序调用 CCGS 的真实 `flaky-stats.sh --format junit --runs --all`，再解析一份空测试结果的 XML：

- `timing_sensitive` 五次中失败两次，显示 High（40%）；
- `physics_tolerance` 五次中失败一次，显示 Moderate（20%）；
- `scene_race` 只出现两次，一过一败，显示 suspected（50%），不触发隔离结论；
- `always_red` 每次都失败，归为 always-fail；`skip_only` 只有跳过；`stable_menu` 始终通过；
- 空 XML 文件被读取但没有测试结果，helper 退出码为 4；这不是通过或零失败的结论。

输入日志和测试名称都是合成的，脚本不运行游戏、不核验代码提交相同，也不自动给出原因、quarantine 决策或报告 verdict。可改 CSV 再运行，观察失败次数、跳过和缺少运行记录如何改变分层。

本地快照里 `/test-flakiness` Skill 未调用 `flaky-stats.sh`，其工具声明也没有授权调用这个脚本。练习直接运行 helper，不能说成 Claude Code 已执行 `/test-flakiness`；实际 Skill 流程还需要检查同一代码状态、读取测试源码并等待用户确认写入。

## 本课结论

不稳定性判断依赖同一测试在同一代码状态下的有效历史。失败率必须排除跳过项；少量结果、持续失败和始终通过分别有不同含义。统计 helper 提供可复核数字，原因、处置和文件写入仍由 Skill 规则及用户决定。

## 简化说明

- 实践调用 CCGS 1.2.0 快照的真实只读 `flaky-stats.sh`，未启动 Claude Code `/test-flakiness`。
- JUnit 日志由练习脚本根据 CSV 生成，不是游戏或 CI 实际测试记录。
- 没有执行底层测试，也没有验证各 run 间代码未变；真实分析前需要补齐这两类事实。
- helper 输出阈值和统计事实，不会自动分类根因、写 quarantine 清单或生成最终报告。
- 失败率边界以当前 Skill 和 helper 的本地版本为准，升级后应再次核对。

## 自测

1. 一个测试五次通过、一次失败，跳过两次，失败率分母是多少？
2. 两次结果一过一败为何是 suspected，即使显示 50%？
3. 五次运行五次失败为什么不是 flaky？
4. 一个 High 测试的统计行能证明失败根因是随机种子吗？
5. `flaky-stats.sh` 退出码 0 与 `/test-flakiness` 的 quarantine 决定分别代表什么？
