# 第 30 课：如何把 Anthropic 官方资料整理成可复查的结论？

**目标：** 能把一个宽泛问题拆成可核对的主张，为每条主张找到合适的 Anthropic 一手资料，并标明来源性质、日期、版本、适用范围和不能推出的结论。

## 本课问题

当有人问“Anthropic 的政策能证明 Claude 在生产中安全吗？”时，Company 页面、研究文章、RSP、System Card、新闻公告和 API 文档分别能回答什么？怎样把结论写得可追溯，又不超出证据？

## 官方资料

- [Company](https://www.anthropic.com/company)：Anthropic 对自身使命、组织和工作的介绍。
- [Research](https://www.anthropic.com/research)：研究主题、团队入口和研究文章。
- [Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy)：现行与历史政策版本及 Risk Reports 的入口。
- [Transparency Hub](https://www.anthropic.com/transparency)：Model Report、System Trust and Reporting、Voluntary Commitments 三类透明度材料的入口。
- [Anthropic News](https://www.anthropic.com/news)：带日期的公告；适合定位变更和原始链接，不替代对应的政策、研究或 API 说明。
- [Claude Platform 文档](https://platform.claude.com/docs)：开发者指南、API Reference 与功能文档。
- [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)：Claude API、SDK 和 Console 的更新记录。
- [Claude Platform API overview](https://platform.claude.com/docs/en/api/overview)：API 指南与 Reference 的入口。
- [Models overview](https://platform.claude.com/docs/en/models/overview)：当前模型和不同平台的可用信息。
- [API Versions](https://platform.claude.com/docs/en/api/versioning)：API 版本规则和版本历史。

核对日期：2026-11-10。页面栏目、模型、政策和接口会更新；上列链接是查证入口，不代表课程保存了它们的永久快照。

## 1. 先把问题拆成具体主张

宽泛问题常常把公司目标、政策要求、研究结果和产品行为揉在一起。先把问题拆开，再逐项找证据。例如“Claude API 客服 Agent 可以安全上线吗？”至少包含：

1. Anthropic 如何描述自己的安全目标？
2. 哪份政策规定了组织的风险管理流程，适用哪个版本和时间范围？
3. 目标模型的哪些评估与风险披露适用于当前型号？
4. 目标 API 与云平台支持哪些接口和控制？
5. 该应用是否满足自己的数据、权限、质量和运行要求？

前四项可以从不同类型的官方来源找到材料；第五项仍需结合本应用的威胁模型、评估样本、权限配置和部署情况。把它们合成一句“官方确认安全”，会漏掉关键范围。

## 2. 按证据类型选择入口

| 要核对的主张 | 优先来源 | 记录什么 | 不能单独推出什么 |
| --- | --- | --- | --- |
| 公司如何描述使命、目标或组织 | Company 页面 | 页面日期、陈述主体和上下文 | 目标已经实现，或效果已由独立机构验证 |
| 某项研究观察到什么 | 具体 Research 文章或论文 | 研究问题、方法、样本、结果、作者列出的限制和日期 | 结果适用于所有模型、用户或真实部署 |
| 政策要求或公开承诺是什么 | RSP 具体版本、更新记录、对应 Risk Report 或承诺原文 | 版本、生效日期、风险报告覆盖日期、适用对象和删节说明 | 组织在每个场景都已达到要求，或所有执行结果均已外部审计 |
| 某个模型披露了哪些评估与防护 | Transparency Hub 的 Model Report，再追到该模型的 System Card | 型号、评估方法、结果、部署条件和未覆盖风险 | 其他型号有相同结果，或模型适合自己的任务 |
| API/模型当前支持什么 | Claude Platform 指南、API Reference、Models overview、Versions | API 版本、精确模型 ID、平台、功能状态和查阅日期 | 应用本身正确、安全、合规或可直接上线 |
| 某项变化何时宣布 | News 或 Platform release notes，并打开链接的原始文件 | 公告日期、受影响产品/版本和原始说明 | 新闻摘要可以代替接口合同、政策正文或研究方法 |

Anthropic 的官方页面是一手资料，但它们能支持的结论不同。Company 页面适合确认公司自述；研究材料支持对特定研究结果的描述；政策文件说明其公开政策；模型卡限定到具体型号与评估；API 文档说明接口行为。先识别资料类型，再决定句子怎么写。[Company](https://www.anthropic.com/company)、[Research](https://www.anthropic.com/research)、[RSP](https://www.anthropic.com/responsible-scaling-policy)、[Transparency Hub](https://www.anthropic.com/transparency)、[Claude Platform 文档](https://platform.claude.com/docs)

## 3. 建立主张到来源的追溯链

```text
问题
  → 拆成原子主张
  → 选对应的一手来源
  → 追到政策正文、研究方法、模型卡或 API Reference
  → 记录版本、日期、平台、对象和覆盖范围
  → 写出来源支持的结论与仍未知的部分
```

阅读公告时尤其要追到它链接的原始文件。例如，News 可以确认某项变化何时发布；如果要知道 API 请求会怎样变化，应继续读对应的 Platform release notes、版本迁移指南和 API Reference。若要知道某个模型评估覆盖了什么，应打开具体 System Card，而不是只引用摘要。[Anthropic News](https://www.anthropic.com/news)、[Transparency Hub](https://www.anthropic.com/transparency)

日期也要拆开记录：**发布日期/更新日**说明材料何时发布或修订；**生效日**说明政策或接口何时适用；**覆盖期**说明报告统计或评估观察的是哪段时间；**访问日**只说明自己何时查看页面。这些日期不能互相替代。

## 4. 使用一页式证据记录

每条重要结论可以用下面的记录模板：

| 字段 | 填写内容 |
| --- | --- |
| 问题与原子主张 | 要回答的具体问题；一次只写一个可核对主张 |
| 一手来源 | 页面标题、直接链接、必要时链接到原始 PDF、论文、System Card 或 API Reference |
| 来源性质 | 公司自述、研究结果、政策/承诺、模型评估、产品公告或接口说明 |
| 时间与版本 | 发布/更新时间、生效日、政策或 API 版本、报告覆盖期、自己的访问日期 |
| 适用范围 | 模型 ID、平台、功能、样本、用户群或部署条件 |
| 来源明确支持 | 用自己的话写来源能够直接支持的事实 |
| 判断与推断 | 说明哪些是自己的推断，以及根据什么作出推断 |
| 不能推出 / 待核对 | 未覆盖的模型、场景、指标、平台或应用条件 |

较短的决策记录可以把末三项写成三句：**官方资料报告了什么；它对当前问题支持到哪里；还需要什么本地评估或额外资料。**

## 5. 示例：政策发布不等于应用获得安全保证

截至本课核对日期，RSP 页面列有当前和历史版本，并把 Risk Reports 作为另一类材料发布；当前页面还分别标注政策版本和生效日期、风险报告的发布日期与覆盖日期。这能帮助读者确认“Anthropic 在某一时间公开了哪个政策版本，以及某份风险报告说明了哪个观察期间”，但不能仅凭一个政策版本推断任意客户应用已安全。[Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy)

若问题是“某个 Claude 型号在某项测试中表现如何”，再到 Transparency Hub 的 Model Report 找对应 System Card，记录模型、测试方法和披露限制。若问题转为“我们的客服 Agent 是否安全上线”，还要查看目标平台和 API 文档，并用[第26课](../s26_claude_app_evaluation/README.md)的代表性样本评估模型与工具行为，再按[第27课](../s27_tool_security_prompt_injection/README.md)和[第28课](../s28_production_operations/README.md)检查权限、数据、成本和运行控制。不同来源补充不同事实，不能互相代替。[Transparency Hub](https://www.anthropic.com/transparency)、[Claude Platform 文档](https://platform.claude.com/docs)

合适的结论可以写成：

> Anthropic 在其 **[政策版本及生效日]** 的 RSP 中说明了 **[具体政策要求]**；其 **[模型 ID] System Card** 报告了 **[具体评估及覆盖范围]**。这些材料没有单独评估本应用的全部用户、工具权限和数据流，因此上线判断还要结合本应用评估、目标平台的当前文档和实际控制配置。

这段写法把来源陈述与部署判断分开，同时保留下一步查证入口。

## 练习：审核一段过度概括

同事写道：“Anthropic 有 RSP，而且 Transparency Hub 报告了模型安全测试，所以 Anthropic 已保证 Claude API 适用于我们的自动付款 Agent。”请将这句话拆成至少三条主张，为每条选一项官方资料，并改写为证据范围内的表达。

**参考答案：** “Anthropic 发布了 RSP”应核对 RSP 当前版本、生效日期和更新记录；“某模型做过哪些测试”应定位该具体模型的 System Card，列出测试方法、结果和范围；“API 是否提供应用需要的功能”应按目标云平台查当前文档和 API Reference。现有材料不能证明特定付款 Agent 的授权逻辑、抗提示注入能力、错误处理和真实工作负载表现。应将结论改为“这些材料说明了 Anthropic 公开的风险政策和特定模型评估；本应用是否满足上线要求，还需按自己的威胁模型和评估集验证，并核对目标平台当前的功能与限制。”

## 本课结论

可复查的结论不是链接数量多，而是每条主张都能沿来源链回到适用的官方原始材料，并保留来源性质、时间、版本和范围。把官方自述、研究结果、政策承诺、模型评估和接口行为分开写，再明确推断与未覆盖部分，读者才能重现查证并判断结论是否适用于当前问题。

## 范围与时效

- 官方页面核对日期：2026-11-10。
- Company、Research、News、RSP、Transparency Hub 和 Platform 文档均由 Anthropic 发布或维护；本课没有独立审计其中的自述、研究结论、政策执行或评估数据。
- 具体模型、政策、产品和 API 行为可能变化；复用模板时按目标模型、平台与日期重新查证。
- [第00课](../s00_official_site_map/README.md)介绍资料入口，[第10课](../s10_system_cards_model_reports/README.md)和[第11课](../s11_transparency_hub/README.md)介绍模型卡与 Transparency Hub；[第26课](../s26_claude_app_evaluation/README.md)至[第29课](../s29_versioning_migrations/README.md)介绍评估、安全、生产运行和版本迁移。本课把这些查证方法整合成可复用的结论记录。
