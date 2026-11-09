# 第 04 课：Anthropic 的研究主题地图

**目标：** 能从 Anthropic Research 页面按研究问题找到合适的主题入口，并理解栏目标签不等于完整的组织结构图。

## 本课问题

Anthropic 怎样把公开研究内容分类？如果问题关于模型内部机制、劳动力影响或模型极限，分别从哪里开始找？

## 官方资料

- [Research](https://www.anthropic.com/research)：当前研究主题入口、分类筛选和文章列表。
- [Company](https://www.anthropic.com/company)：公司层面较宽的职能介绍，将团队工作概括为 Research、Policy、Product 和 Operations。
- [Economics](https://www.anthropic.com/research/team/economics)：经济研究主题及文章。
- [Engineering](https://www.anthropic.com/engineering)：让 Claude 可靠运行的基础设施与生产工程。
- [Alignment](https://www.anthropic.com/research/team/alignment)：模型风险、训练与评估方向。
- [Frontier Red Team](https://www.anthropic.com/research/team/frontier-red-team)：压力测试模型能力和潜在风险。
- [Interpretability](https://www.anthropic.com/research/team/interpretability)：研究语言模型内部如何工作。
- [Societal Impacts](https://www.anthropic.com/research/team/societal-impacts)：观察 AI 对个人和社会的影响。
- [Science](https://www.anthropic.com/science)：AI 与科学研究及相关合作。

页面核对日期：2026-11-09。栏目名称、文章归类和列表会更新；本课不固定记录文章数量。

## 1. 先区分两种页面地图

Company 页面用 Research、Policy、Product、Operations 介绍较宽的公司职能。Research 页面则把公开研究文章放进若干主题入口，当前页面列出 Alignment、Economics、Engineering、Frontier Red Team、Interpretability、Societal Impacts 和 Science。[Company](https://www.anthropic.com/company) · [Research](https://www.anthropic.com/research)

因此，查一篇文章时，把 Research 页面当作**主题导航和公开文章索引**最合适。不要只凭栏目标签推断完整汇报关系、团队规模，或认为每个主题都是互斥的学科边界。

## 2. 按研究问题选入口

| 你的问题 | 优先主题 | 页面描述的大致范围 |
| --- | --- | --- |
| 怎样训练和评估模型，使其更符合预期？ | Alignment | 模型风险、训练方法、诚实与无害等行为评估 |
| AI 会怎样影响就业、企业和经济？ | Economics | AI 使用情况、生产力、劳动力与经济变化 |
| 怎样让 Claude 的系统和基础设施更可靠？ | Engineering | 生产系统、基础设施、评测与部署工程 |
| 模型能做什么，哪些能力带来新的风险？ | Frontier Red Team | 对 AI 系统进行压力测试，研究其能力边界 |
| 模型内部怎样表示信息、产生行为？ | Interpretability | 研究大语言模型内部机制，为 AI 安全提供理解基础 |
| AI 怎样影响个人和群体？ | Societal Impacts | 现实使用方式、用户体验和更广泛社会影响 |
| AI 怎样参与科学发现或科研工作？ | Science | AI 加速科研的可能性，以及研究合作与案例 |

这些入口之间会有交叉。例如，研究 Claude 协助科学工作的文章，可能同时涉及 Science、Economics 或模型行为评估。先按问题选入口，再从文章的方法和证据判断它适合回答什么。

## 3. 从栏目进入一篇研究文章

建议按这个顺序读：

1. 在 Research 页按主题或关键词筛选文章。
2. 记录文章标题、发布日期和页面标注的主题。
3. 进入文章，确认它研究的问题、使用的方法和样本范围。
4. 分清文章报告的是实验结果、案例观察、预测，还是研究计划。
5. 查看作者写出的限制，再判断结论能否迁移到你的问题。

主题标签能帮你找到材料，但决定结论范围的是文章本身的方法和数据。不能把某一篇研究文章直接推广成 Anthropic 所有模型或全部用户的表现。

## 4. 观察练习

给以下问题各选一个优先入口，并说明为什么：

1. “Claude 在推理时如何表示某种概念？”
2. “AI 使用对职业结构和薪资可能有什么影响？”
3. “一个新模型是否展现了新的高风险能力？”
4. “Claude 在真实用户群体中的使用会怎样影响人的行为？”
5. “Claude 是否能帮助科研人员缩短实验或分析流程？”

**参考路由：** 1 Interpretability；2 Economics；3 Frontier Red Team；4 Societal Impacts；5 Science。具体文章可能跨主题；选定栏目后仍要读原文的研究方法和范围。

## 本课结论

Anthropic 的研究页面提供主题分类和文章索引。可以先根据问题路由到 Alignment、Economics、Engineering、Frontier Red Team、Interpretability、Societal Impacts 或 Science，再读文章本身确认它提供的是哪种证据。栏目列表会变化，不应被当作固定组织图。

## 范围与时效

- 课程记录的是 2026-11-09 页面快照，不代表未来团队名称或页面结构不变。
- Research 页面里的文章标签用于导航；组织汇报关系应查当前 Company 或团队资料，不能从标签直接推断。
- 文章发布日期、样本、方法和限制决定其结论适用范围；本课不把官方文章的单项结果当成对所有模型的保证。
