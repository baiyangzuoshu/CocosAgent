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

以“我想让游戏里的 NPC 查询玩家背包，再生成一句建议”为例，写出三个资料问题：

1. 需要 Claude API 时，先从 Platform 文档的 Quickstart 和 Messages 指南了解调用流程。
2. 如果模型需要查询背包，继续读工具调用文档，区分模型提出工具请求与游戏后端执行查询。
3. 若要判断某个模型是否适合该功能，再查看当前模型页面和对应评估材料；不能只凭首页宣传语下结论。

检查结果：每个问题都有对应的一手资料；你能指出哪部分是官方文档事实、哪部分是自己的应用设计判断。

## 本课结论

Anthropic 官网是公司、研究、政策和产品资料的导航入口；Claude Platform 才是开发者 API 指南和精确字段说明的主要入口。相邻页面可能描述不同层次的问题，阅读时先判断自己要找的是公司立场、研究结论、政策要求、产品能力还是 API 行为。

## 范围与时效

- 页面栏目和可用入口会调整。本课记录的是 2026-11-09 对官方页面的核对结果。
- 本课不评价 Anthropic 的使命、政策或产品效果，只教如何找到并分类官方材料。
- 产品名称、模型版本、价格、API 功能和政策版本属于易变信息，应在具体课程开始时重新核对。
- 官方资料能说明 Anthropic 公开了什么，不自动证明其对实际部署效果的全部判断。
