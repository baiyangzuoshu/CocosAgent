# 第 23 课：经济系统与平衡检查

**目标：** 追踪 CCGS 如何用设计目标审查经济数据，并亲手计算一个简化的资源流量场景。

完成本课后，你应该能：

1. 区分 economy-designer 的设计职责与 `/balance-check` 的审查职责。
2. 从 registry、GDD 和数据文件中找到可比较的目标值。
3. 计算每日 faucet、sink、净流量、sink-to-source ratio 和购买所需时间。
4. 说明何时应给出 `NOT ASSESSED`，以及模拟结果为何不能单独当成健康结论。

## 问题

一个游戏每天发给玩家 110 金币，同时玩家平均花掉 55 金币。这个经济系统平衡吗？只有“收入大于支出”还不够：玩家余额会怎样变化、商店是否会被买空、设计目标是什么、统计周期是否覆盖不同玩家行为？本课从 CCGS 的经济设计 Agent 和 `/balance-check` 找答案。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/balance-check/SKILL.md` | 数据与目标输入、经济域分析、健康结论和后续选项 |
| `.claude/agents/economy-designer.md` | faucets/sinks、显式概率、经济指标和设计审批边界 |
| `.claude/docs/templates/economy-model.md` | 货币、来源、消耗、目标、进度曲线和健康指标的模型结构 |
| `design/registry/entities.yaml` | 跨文档 formulas、constants 及其权威来源 |
| `.claude/scripts/registry.sh` | 读取 registry 项及其原始字段 |
| `.claude/docs/automation-modes.md` | 修复、写报告等决策如何随 automation 模式处理 |

## 从设计到审查

`economy-designer` 负责提出资源流、奖励和成长曲线方案；它需要先问清体验目标、约束和参考方向，给出可比较方案，再按用户选择逐段起草。它不能自行决定付费设计，也不能擅自改掉 registry 中的跨系统数值。

`/balance-check` 检查已有的战斗、经济、成长或掉落系统：

1. **先判定是否有输入。** 记录每份数据、报告、registry、源码和目标文档是 FOUND 还是 ABSENT。必要输入全缺时停止并报告 `NOT ASSESSED — NO DATA`。
2. **确定审查域并读取数据。** 参数可指定 Combat、Economy、Progression、Loot 或数据路径；未指定时向用户询问。经济域读 `assets/data/` 与 `design/balance/`。
3. **从 registry 找权威目标，再查 GDD。** registry 的 formula `output_range` 与 constant `value` 是跨 GDD 的目标；未覆盖的调优范围再从对应 GDD 获取。如果数据存在而两处都没有目标，就不能把值判成异常或正常，应记为 `no stated range — not judged`。
4. **用目标检查数据和结构。** 经济域绘制资源 faucet 与 sink 的流量，估计一段时间的积累、检查无 sink 的循环和 sink 是否会耗尽；还要观察金钱来源是否与消耗增长相称、物品是否完全不值得购买。
5. **按最严重发现给出健康摘要。** 无 sink 的无限循环、主策略完全压倒其他选择或无法完成的成长属于 `CRITICAL ISSUES`；可通过调参解决的越界是 `CONCERNS`；缺数据或缺目标为 `NOT ASSESSED`；只有所有值都有目标且无异常时才是 `HEALTHY`。

检查报告后，Skill 会让用户选择修最高优先问题、保存报告或人工复核。若调参改动了 GDD 或 ADR 中定义的值，还要用 `/propagate-design-change` 查受影响文件。Skill 的分析不等于已修改、已验证或已批准上线。

## 实践：计算一个金币流量情景

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_economy_balance.py
~~~

脚本复制 CCGS 的真实 `registry.sh` 到临时项目，调用 `get sink_to_source_ratio` 读取合成 registry 中的目标区间；随后根据 `practice/fixtures/s23_economy_flow.csv` 计算每日收入、支出、净流量、sink/source 比率，以及从 50 金币攒到 200 金币购买目标物品的天数。

样例输入的核心结果是：每日 faucet 为 110 金币，重复 sink 为 55，净增加 55；sink/source 为 0.50，低于样例 registry 设定的 0.70–0.90 区间；从 50 金币攒到 200 金币约需 3 天。脚本会指出这是情景计算中的目标偏差，**不**替 `/balance-check` 给完整健康结论。

可以编辑 CSV 的 `amount` 或 `occurrences_per_day` 后重跑，观察比率与购买周期如何变化；再把两条 faucet 的频率都设为 0，检查脚本如何报告无法计算比率和攒钱时间。练习不修改 CCGS 源码或真实项目。

## 本课结论

经济平衡不是单看价格表，而要把资源来源、消耗能力、库存/商店上限、玩家行为频率和目标范围放在同一时间尺度下。CCGS 明确要求用项目给出的数据计算，不用类型游戏的行业猜测代替项目证据；缺少目标时，正确结论是未评估，而不是凭直觉补一个健康标准。

## 简化说明

- 练习用 CCGS 的 `registry.sh` 读取目标范围；每日流量和攒钱天数由课程脚本按 CSV 做算术，CCGS 快照没有独立的经济模拟命令。
- 练习只建模一种货币、固定的每日发生次数和一个目标售价；它没有模拟玩家分布、随机奖励、季节变化、有限库存、通胀反馈或付费行为。
- registry 中的区间是合成练习目标，不是 CCGS 项目真实经济目标。真实审查还需与 GDD、运行数据及项目策略核对。
- 不同 CCGS 快照可能改变 Skill、Agent 和 registry 布局；动手前应复核本地版本。

## 自测

1. 为什么在 110 金币 faucet、55 金币 sink 的情况下，还不能直接说经济“健康”？
2. registry 中没有目标值，但 GDD 中存在范围时，审查应如何继续？
3. 数据存在、目标缺失时，为什么不应把实际值记成 outlier？
4. 可重复的 sink 与一次性、有限库存的 sink 对长期流量模型有何区别？
5. 哪些情况属于 `CRITICAL ISSUES`，哪些只是 `CONCERNS`？
6. 修改 GDD 中定义的金币来源值后，为什么需要追踪下游引用？
