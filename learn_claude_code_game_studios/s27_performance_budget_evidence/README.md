# 第 27 课：性能预算与证据强度

**目标：** 读懂 CCGS `/perf-profile` 如何把性能预算、测量输入和执行策略分开处理，并判断一份性能结论究竟证明了什么。

完成本课后，你应该能：

1. 找到项目约定的帧率、帧时、Draw Call 和内存预算，并识别缺失预算。
2. 解释 `performance.enforce` 的 `warn`、`block`、`off` 差异及配置来源。
3. 区分静态热点候选、合成样例数据和目标设备上的真实运行时测量。
4. 说明性能发现如何影响 Polish Gate，以及何时只能标记 `NOT ASSESSED`。

## 问题

代码里有一个看起来昂贵的循环，是否足以证明它是瓶颈？如果配置没设帧时预算，拿 16.67 ms 当目标再报告“还有余量”，又能说明什么？本课检查 CCGS 怎样把预算、代码观察和执行规则分开，避免把猜测写成性能结论。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/perf-profile/SKILL.md` | 输入充分性、预算读取、静态热点、报告和后续决策 |
| `.claude/agents/performance-analyst.md` | 目标设备测量、预算责任和优化边界 |
| `.claude/hooks/yaml-helper.sh` | 有效预算键和 `performance.enforce` 的配置解析 |
| `.claude/docs/effects-map.md` | `warn`、`block`、`off` 的约定与优先级 |
| `.claude/skills/gate-check/references/3-run-gate-check.md` | 性能超预算如何影响 Gate |
| `studio-tests/skills/analysis/perf-profile.md` | 输入缺失、无预算及本地覆盖的测试规格 |

## 先确认预算，再看余量

`/perf-profile [system-name|full]` 读取 `performance.target_framerate`、`performance.frame_budget_ms`、`performance.draw_call_limit` 和 `performance.memory_ceiling_mb`。配置未设置时可按 Skill 约定查设计文档或 `CLAUDE.md`；如果仍找不到预算，该指标必须写 `NOT ASSESSED`，不能拿模板里的 `[16.67ms]` 当作项目承诺，也不能计算虚构的 headroom。

Skill 先列出本次分析所需输入，逐项标记 `FOUND` 或 `ABSENT`。代码根或某项输入缺失时，相应内容不能被写成零问题。所有必要输入均缺失时，应停止并给出 `NOT ASSESSED — NO DATA`。即使静态分析找到热点候选，也要区分估算和测量。

## 静态候选不等于运行时瓶颈

`/perf-profile` 检查每帧更新函数、嵌套循环、分配、资源加载和渲染模式，形成需要进一步验证的热点候选。CCGS 的 Skill 测试规格明确说明它不读取运行时 Profiler 导出。真正的成本要在目标硬件、对应构建和场景上测量；开发机上的静态判断不能代替那份证据。

报告中的指标只对有来源的预算判断 `OK`、`WARNING` 或 `OVER`；没有预算则是 `NOT ASSESSED`。报告还要保留输入缺口，不能为了看起来完整删掉未评估行。Skill 要求先询问是否写入 `production/polish/[scope]-report-[date].md`。

## `performance.enforce` 改变什么

这个键决定超预算发现的后果，不会创建预算，也不会改变测量值。它的解析链为 `project.local.yaml` → `project.yaml` → 默认 `warn`。由于它可本地覆盖，应通过 `resolve_config --keys performance.enforce` 读取解析结果和来源；只读 `project.yaml` 会漏掉本地覆盖。

| 值 | CCGS 中的含义 |
| --- | --- |
| `warn`（默认） | `/perf-profile` 把超预算列为发现；CI 记录但不失败；Gate 报为 CONCERNS，不作为 Blocker。 |
| `block` | CI 失败；从 Polish Gate 开始，超预算可成为 Blocker 并导致 FAIL。 |
| `off` | 预算只作信息参考，不将超预算列为发现或用于 Gate 判决。 |

`performance.enforce` 独立于 workflow 档位；workflow 降低其他 Gate 要求，并不会自动抹去 `block`。只有 `off` 会让预算退出判决。

## 实践：读取预算并比较一份样例快照

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_performance_budget.py
~~~

脚本为四种合成项目配置复制一份隔离目录，并调用 CCGS 自带的 `yaml-helper.sh`：预算使用 `get_effective_yaml_key` 读取，执行策略使用 `resolve_config --keys performance.enforce` 读取。然后把 `profile_samples.csv` 中的样例值和已设置预算逐项比较：

- 默认策略 `warn`：帧率、帧时和 Draw Call 超出样例预算，显示为发现而非阻断项。
- 项目声明 `warn`、本地改为 `block`：helper 应显示本地来源，超预算变为 Polish Gate 的阻断项。
- `off`：仍打印数值和超预算状态，但说明它们不会进入发现或 Gate 判决。
- 未设预算：即使 CSV 有观测值，也显示 `NOT ASSESSED`，不计算 headroom，不报通过。

脚本中的观测数字是教学样例，不来自游戏运行或 Profiler；比较规则只是直观演示，不是 `/perf-profile` 的官方统计方法。可编辑 CSV 或配置后重跑，观察配置来源、缺失预算和执行级别如何改变结论。

## 本课结论

性能判断要同时交代预算来源、观测来源和执行策略。静态代码扫描可提出测量对象，但目标设备上的运行时证据才能确认性能表现；预算缺失要保留为 `NOT ASSESSED`，执行级别也不能把它转换成通过。

## 简化说明

- 实践调用当前 CCGS 1.2.0 快照的真实 `yaml-helper.sh`，不启动 Claude Code `/perf-profile` 或 `/gate-check`。
- 实践只读取合成配置并比较一行合成观测值，不运行游戏、不读取 Profiler 导出，也不生成生产性能报告。
- 目标硬件、构建、场景、运行时统计窗口及采样策略仍需在真实项目中确定。
- `performance.enforce` 的 Gate 结果来自本地 Skill 和 effects map；快照更新后需重新核对。

## 自测

1. `performance.frame_budget_ms` 未设置时，为什么不能直接用 16.67 ms 计算 headroom？
2. `performance.enforce: block` 与 `performance.enforce: off` 分别怎样影响超预算结果？
3. 为什么 `project.yaml` 写着 `warn`，解析结果仍可能是 `block`？
4. 静态分析找到每帧嵌套循环，能证明目标设备出现卡顿吗？
5. CSV 有实际帧时，但项目未声明预算，该指标应写什么状态？
