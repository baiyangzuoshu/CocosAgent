# 第 0 课：Anthropic 官网与官方资料地图

**目标：** 能按问题类型找到 Anthropic 的官方资料入口，并区分公司自述、研究文章、政策文件、产品页面和开发者文档。

## 本课问题

访问 Anthropic 网站时，应该去哪一类页面查公司使命、研究进展、安全承诺、Claude 产品或 API 字段？

## 官方入口

- [Anthropic 官网](https://www.anthropic.com/)：首页概述公司使命，并提供 Research、Policy、Commitments、Company、Products、Models、Solutions、Help and security 等资料入口。
- [Company](https://www.anthropic.com/company)：公司如何描述其使命、组织和治理。
- [Research](https://www.anthropic.com/research)：研究主题与研究团队入口。
- [Claude’s Constitution](https://www.anthropic.com/constitution)：Anthropic 对 Claude 行为原则和目标的说明。
- [Responsible Scaling Policy](https://www.anthropic.com/responsible-scaling-policy)：风险治理政策及版本更新入口。
- [Transparency Hub](https://www.anthropic.com/transparency)：模型报告、系统信任与公开承诺的汇总入口。
- [Claude Platform 文档](https://platform.claude.com/docs)：开发者 Quickstart、API 指南、功能文档和 API Reference。
- [Models overview](https://platform.claude.com/docs/en/models/overview)：当前模型目录、平台可用情况和模型规格入口。
- [Tool use with Claude](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)：工具类型、执行位置及工具调用流程。
- [Anthropic News](https://www.anthropic.com/news)：产品、公司、研究和政策相关公告；新闻用于确认发布日期和更新线索，技术细节应回到对应文档。

## 问题路由

| 我的问题 | 优先入口 | 读它来做什么 |
| --- | --- | --- |
| Anthropic 如何描述使命和治理？ | Company、首页 Mission | 提取公司的公开自述；不要把自述本身当成独立验证 |
| 某个研究主题做了什么？ | Research 团队页、具体研究文章 | 读研究问题、方法、结果和作者标注的限制 |
| Claude 的行为原则是什么？ | Claude’s Constitution | 了解指导目标和原则，区分规范文本与行为保证 |
| Anthropic 的风险政策如何运作？ | Responsible Scaling Policy 及更新记录 | 确认版本、日期、政策目标和适用条件 |
| 某个模型经过什么评估？ | Transparency Hub、对应 System Card/Model Report | 阅读能力和安全评估及其方法边界 |
| Claude API 如何调用？字段是什么？ | Claude Platform 指南与 API Reference | 先学流程，再查精确参数、响应和错误 |
| 产品或模型现在是否可用？ | 当前产品/模型页面与公告 | 在使用当天核对；不要依赖旧课文中的产品清单 |

## 先判断资料能支持什么结论

看官方资料时，先区分页面的性质，再引用它支持的结论：

| 资料类型 | 可以用来了解 | 不应直接推成 |
| --- | --- | --- |
| Company 与首页 | Anthropic 如何介绍使命、组织和价值取向 | 这些目标已经独立证明或在所有场景都已实现 |
| Research 文章 | 一项研究的问题、方法、实验或观察结果 | 结果自动适用于所有模型、用户和真实环境 |
| Claude’s Constitution | Anthropic 希望 Claude 遵循的价值和行为方向 | Claude 每次都必然按文本表现 |
| RSP 与更新记录 | 某个版本的政策框架、要求和公开更新 | 所有安全工作都只由 RSP 覆盖，或未来政策不再变化 |
| System Card / Model Report | 特定模型的能力、安全评估和部署防护说明 | 其他模型也有相同结果，或评估覆盖了所有风险 |
| Claude Platform 文档与 API Reference | API 当前公开的接口、参数、事件和平台差异 | 应用已经安全、可靠或适合某个具体业务 |
| News | 公告发布时间和需要进一步核对的更新线索 | 新闻摘要足以代替政策原文、研究方法或 API Reference |

这是本课程最重要的阅读习惯：把“官方页面写了什么”“页面中的证据具体支持什么”和“我据此做了什么判断”分开记录。

## 当前页面观察

截至 2026-11-09，本次核对的官网首页把 Research、Policy、Commitments、Company、Products、Models、Solutions、Help and security 等放在主导航/页脚体系中；Company 页按 Research、Policy、Product、Operations 介绍团队。Research 页当时列出的团队入口包括 Alignment、Economics、Engineering、Frontier Red Team、Interpretability、Societal Impacts 和 Science。[官网首页](https://www.anthropic.com/) · [Company](https://www.anthropic.com/company) · [Research](https://www.anthropic.com/research)

这些栏目和团队名称是页面快照，不是固定组织定义。后续课程引用某个团队或产品时，应重新打开当前页面核对。

## 核心地图

```text
Anthropic 官网
  ├─ Company：公司使命、组织与治理
  ├─ Research：研究团队和论文
  ├─ Policy / Commitments：公开政策与承诺
  ├─ Products / Models：Claude 产品入口与当前模型信息
  ├─ Transparency：模型报告、系统信任和自愿承诺
  └─ News：更新线索与发布日期

Claude Platform 文档
  ├─ Quickstart 与概念指南
  ├─ 功能指南与开发实践
  └─ API Reference：请求字段、响应结构和错误
```

## 观察练习

以“我想让游戏里的 NPC 查询玩家背包，再生成一句建议”为例，沿下面路径找资料：

1. 从 Claude Platform 的 Quickstart 与 Messages 指南了解应用如何发送一次请求。
2. 读 Tool Use 文档，了解如何声明 `get_inventory` 这类工具。Claude 返回工具请求后，游戏后端执行背包查询，再把结果发回 API；模型本身不会直接读取游戏数据库。
3. 若要比较模型，查看当前 Models overview 的模型规格与平台信息，再结合自己的 NPC 样本做评估；不要只凭首页介绍决定。
4. 查某个字段、响应结构或错误时，转到 API Reference，而不是从新闻稿推测接口行为。

检查结果：你能画出“游戏后端准备上下文 → 调用 Messages API → 模型返回文本或工具请求 → 应用执行工具并回传结果”的流程，并指出工具权限和背包数据访问由应用控制。

## 课后练习

为下面每个问题挑选一个优先资料入口，并说出该入口能支持的结论：

1. Anthropic 如何描述自己的使命？
2. Claude 的某一项安全评估得出了什么结果？
3. 某个模型现在的 API ID、价格和可用平台是什么？
4. API 请求中某个字段的准确类型和行为是什么？
5. Anthropic 的 RSP 最近改了什么？

参考路由：Company/Home；对应模型的 System Card 或 Transparency Hub；当前 Models overview；API Reference；RSP 页面和版本更新记录。回答时分别注明官方自述、特定模型评估、当前产品规格、接口定义或政策版本。

## 本课结论

Anthropic 官网是公司、研究、政策和产品资料的导航入口；Claude Platform 才是开发者 API 指南和精确字段说明的主要入口。相邻页面可能描述不同层次的问题，阅读时先判断自己要找的是公司立场、研究结论、政策要求、产品能力还是 API 行为。

## 范围与时效

- 页面栏目和可用入口会调整。本课记录的是 2026-11-09 对官方页面的核对结果。
- 本课不评价 Anthropic 的使命、政策或产品效果，只教如何找到并分类官方材料。
- 产品名称、模型版本、价格、API 功能和政策版本属于易变信息，应在具体课程开始时重新核对。
- 官方资料能说明 Anthropic 公开了什么，不自动证明其对实际部署效果的全部判断。
