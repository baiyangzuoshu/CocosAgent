# 第 07 课：Frontier Red Team、经济与社会影响研究

**目标：** 能按研究问题区分 Frontier Red Team、Economics 和 Societal Impacts，并说明每类官方研究案例提供了什么证据和哪些限制。

## 本课问题

如果想了解模型能否执行一项高风险任务、AI 正怎样影响工作，或人们在现实中如何使用 AI，应该从哪个研究入口开始？这几类研究的证据可以说明什么？

## 官方资料

- [Frontier Red Team](https://www.anthropic.com/research/team/frontier-red-team)：压力测试 AI 系统当前及新兴能力，并研究其对网络安全、国家安全和自主系统的影响。
- [Project Pilot: Can AI control a drone?](https://www.anthropic.com/research/project-pilot)：使用 Drone-Bench 测试模型能否控制无人机完成室内搜寻与跟随任务。文章发表于 2026-07-24。
- [Economics](https://www.anthropic.com/research/team/economics)：研究 AI 如何影响工作、生产力、经济机会、劳动者、企业和整体经济。
- [Labor market impacts of AI: A new measure and early evidence](https://www.anthropic.com/research/labor-market-impacts)：把任务能力估计与实际使用数据结合，研究职业暴露度和劳动力市场结果。文章发表于 2026-03-05。
- [Societal Impacts](https://www.anthropic.com/research/team/societal-impacts)：研究 AI 如何影响个人与群体，包括福祉、推理、关系及现实使用方式。
- [Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)：用 Claude Code 和 API 中的人机互动数据研究代理自主性与人工监督。文章发表于 2026-02-18。

页面核对日期：2026-11-09。研究入口、文章归类和模型状态可能更新；以下案例是用于理解问题类型的样本，不是各团队全部工作的清单。

## 1. 先按问题选入口

| 你想了解什么？ | 优先入口 | 常见证据 | 不宜直接推出什么？ |
| --- | --- | --- | --- |
| 模型现在能做什么？某种能力会带来哪些安全风险？ | Frontier Red Team | 红队测试、能力基准、场景演练和防御原型 | 一次任务成功不代表所有真实环境都能成功，也不说明实际滥用发生率 |
| AI 在哪些工作任务中已经被使用？劳动力和经济可能怎样变化？ | Economics | 真实使用数据、职业任务映射、劳动力统计与经济模型 | AI 使用数据或职业暴露度不能单独证明某个就业结果由 AI 导致 |
| 人们实际上怎样使用 AI？它怎样影响人的工作、判断和关系？ | Societal Impacts | 产品使用数据、用户访谈、调查和行为分析 | 一个平台或自愿参与者的观察不自动代表全体社会或普遍因果效果 |

三者会交叉。比如代理在工作中的自主性既涉及实际用户体验，也可能关系到生产力、岗位和监督设计。可以先按主问题选入口，再查看具体研究的样本与方法；团队名称只是导航，不是互不重叠的边界。

## 2. Frontier Red Team：探测能力边界和风险

Frontier Red Team 的工作重点是通过压力测试了解模型的当前能力，并提前观察可能出现的安全影响。Anthropic 的团队介绍点名网络安全、国家安全和自主系统等领域。[团队页面](https://www.anthropic.com/research/team/frontier-red-team)

**案例：Project Pilot。** Anthropic 与 Andon Labs 设计了 Drone-Bench，考察模型能否在室内办公室控制无人机寻找并跟随指定人员。任务被拆成重建环境、定位、导航、检测目标和跟随五个子任务；Andon Labs 又把这些任务做成软件模拟，以便重复测试。该场景具有双重用途：搜救等合法用途与未经授权的监视风险并存。[Project Pilot](https://www.anthropic.com/research/project-pilot)

**这类结果能说明：** 在给定基准、工具、环境和目标下，模型完成了哪些能力环节，哪里仍是瓶颈。拆分子任务还能帮助区分“某个部件表现好”与“端到端任务可靠完成”。

**范围限制：** 文章说明 Drone-Bench 由 Andon Labs 创建并运行评估；Anthropic 没有获得基准访问权。测试只涵盖有限的室内环境、缓慢移动的无人机和少量人员，没有覆盖户外人群等更复杂场景。因此，能力演示不能直接外推为一般环境中的可靠自主能力或实际风险发生率。

## 3. Economics：衡量采用、工作和经济变化

Economics 团队用数据研究 AI 在工作与经济中的扩散及其影响。Anthropic Economic Index 是其重要资料入口之一，用于追踪 Claude 工具在不同任务和领域的实际使用，再与劳动者、企业和经济层面的研究结合。[Economics 团队](https://www.anthropic.com/research/team/economics)

**案例：职业的 AI 暴露度。** 2026 年的劳动力研究提出 “observed exposure” 指标，将职业任务理论上可由 LLM 加速的程度，与 Anthropic Economic Index 中观察到的实际使用结合；工作情境和自动化使用获得更高权重。研究再将任务层指标映射到美国职业和劳动力统计。[研究文章](https://www.anthropic.com/research/labor-market-impacts)

文章报告：高暴露职业的美国劳工统计局就业增长预测略低；截至研究分析时，高暴露群体的失业率没有系统性上升；对 22–25 岁劳动者，研究者看到招聘放缓的初步迹象。文章称这是早期框架和证据，并强调劳动市场影响仍有不确定性。

**范围限制：** “暴露度”是结合能力与平台使用的测量，不等于已发生的岗位替代。Claude 使用数据不是所有 AI 工具的完整样本；职业增长预测与观察到的就业变化也不能单独识别 AI 的因果影响。作者把这一研究称为持续更新的第一步，而不是最终劳动力预测。

## 4. Societal Impacts：研究现实使用中的人的处境

Societal Impacts 团队关注 AI 对个人与群体的影响，研究人们怎样与 Claude 互动，以及这些互动怎样影响人的思考、工作和关系。团队页面还提到使用研究发现改进模型行为、评估和产品。[Societal Impacts 团队](https://www.anthropic.com/research/team/societal-impacts)

**案例：现实中的 AI 代理自主性。** Anthropic 分析 Claude Code 与公共 API 中数百万次人机互动，考察用户给代理多少自主权、随经验怎样变化、代理运行在哪些领域，以及人们如何监督。研究报告称，Claude Code 交互轮次时长的 99.9 百分位数在 2025 年 10 月至 2026 年 1 月从不到 25 分钟增至超过 45 分钟；经验较多的用户更常允许自动批准，也更常在必要时中途打断。[研究文章](https://www.anthropic.com/research/measuring-agent-autonomy)

**范围限制：** 研究者指出，轮次时长只是自主性的一个不完美代理指标，可能同时受模型效率、用户任务难度和产品变化影响。公共 API 的分析较广，但以单个工具调用为单位，无法复原完整工作流；Claude Code 能看到更完整工作流，却只代表一个产品。观察到的变化不应简单归因于模型能力提升。

## 5. 对照练习

为每个问题选择优先入口，并说出需要继续核对的证据：

1. “模型能否在无人直接操控时完成无人机目标跟随？”
2. “哪些职业任务已经出现 AI 使用，暴露程度与就业数据有什么关系？”
3. “代理实际运行多久？用户怎样批准、打断或监督它？”
4. “某个编码代理在企业中提高生产力，但也改变了开发者的技能和工作体验。”

**参考路由：** 1 Frontier Red Team；2 Economics；3 Societal Impacts；4 可能同时涉及 Economics 和 Societal Impacts。读第 4 题时，要区分产出/生产力指标与开发者的体验、能力和监督结果。每题都要注明研究数据和适用范围。

## 本课结论

Frontier Red Team 主要探测前沿能力及其风险，Economics 主要衡量 AI 使用与经济、工作之间的关系，Societal Impacts 主要观察 AI 在现实互动中对个人和群体的影响。它们使用的基准测试、经济数据和人机互动资料支持不同类型的结论。选对入口后，仍需回到具体研究，检查样本、测量方式、因果识别和未覆盖情境。

## 范围与时效

- 三个团队的职责概述依据 Anthropic 官方团队页面，核对日期为 2026-11-09。
- 文中的数值、测量方法与限制来自各篇 Anthropic 官方文章；本课未独立复现或审计。
- 页面类别和团队描述会变化。跨领域问题应优先按研究问题、方法和证据阅读，不把文章标签当成互斥学科或固定组织图。
