# 第 11 课：Transparency Hub 如何汇总模型信息和公开承诺？

**目标：** 能根据问题找到 Transparency Hub 的合适章节，分辨模型评估、平台治理数据和公开承诺各自回答什么，并记录页面日期与证据来源。

## 本课问题

Transparency Hub 把哪些材料放在一起？面对一个模型能力问题、一组平台执行数据或一项公开承诺，应该从哪里开始，又该如何避免把不同类型的材料混成同一种证据？

## 官方资料

- [Anthropic Transparency Hub](https://www.anthropic.com/transparency)：当前入口包含 Model Report、System Trust and Reporting、Voluntary Commitments 三个部分。
- [Transparency Hub 发布说明](https://www.anthropic.com/news/introducing-anthropic-transparency-hub)：说明 Hub 旨在把不同透明度倡议和自愿承诺所需的信息放进一个更易浏览的框架。
- [System Trust and Reporting](https://www.anthropic.com/transparency/system-trust-reporting)：平台安全、执行数据、法律请求和用户安全信息。
- [Voluntary Commitments](https://www.anthropic.com/transparency/voluntary-commitments)：按领域概览 Anthropic 如何履行或推进不同公开承诺，并链接到具体承诺文件。
- [System Cards 索引](https://www.anthropic.com/system-cards)：Model Report 引向具体模型评估细节的入口，详见第10课。

核对日期：2026-11-09。Hub 各部分更新时间不同；阅读时记录**具体章节日期、数据覆盖期和引用的原始文件**，不要只记录 Hub 首页的访问日期。

## 1. Hub 解决什么问题？

Anthropic 在发布说明中将 Hub 描述为一个统一、结构化的公开入口，用来处理模型发展、安全测试、平台执行、内部治理、社会影响、研究以及安全与隐私等方面的资料。其背景是多个透明度计划和自愿承诺各自要求披露不同内容；Hub 试图让用户、政策制定者和其他相关方更容易找到相应材料。

因此，Hub 更像一张**资料导航与汇总页面**，不是一份单一报告，也不意味着页面里的所有结论采用同一种评估方法。不同章节仍需回到具体模型卡、统计报告、政策或承诺原文核对。[Transparency Hub 发布说明](https://www.anthropic.com/news/introducing-anthropic-transparency-hub)

## 2. 三个章节使用三种观察尺度

| 章节 | 主要尺度 | 典型内容 | 阅读时要记录 |
| --- | --- | --- | --- |
| **01 Model Report** | 模型 | 按 Claude 型号摘要能力、安全评估和部署防护，并链接到 System Card。 | 模型与版本、报告日期、评估方法、产品配置、指标及卡片链接。 |
| **02 System Trust and Reporting** | 服务与平台 | Usage Policy、部分执行数据、法律请求、用户安全与福祉等。 | 指标定义、统计单位、报告期间、适用产品或地区，以及链接的完整报告。 |
| **03 Voluntary Commitments** | 承诺与治理主题 | 按风险评估、网络安全与隐私、社会影响、系统防护、儿童安全等主题介绍相关安排，并列出承诺文件。 | 是承诺原文、执行进展还是背景介绍；谁作出承诺、覆盖范围及验证方式。 |

**导航关系：**

```text
问题对象
├─ 某个 Claude 型号的能力或安全评估 → Model Report → System Card
├─ 平台上的政策执行、用户保护或统计数据 → System Trust and Reporting → 原始报告/定义
└─ Anthropic 公开承诺及推进情况 → Voluntary Commitments → 对应承诺全文
```

如果问题是灾难性风险阈值或 Anthropic 对整体风险的判断，还需查看第09课涉及的 RSP 和 Risk Report；如果问题是 API 字段、平台认证或接入方式，应转到 Claude Platform 文档。

## 3. 示例：不要把平台统计读成模型评估

截至本课核对日期，System Trust and Reporting 页面标注最近更新于 **2026-07-23**，其中一组数字覆盖 **2026 年 1–6 月**。页面分别列出 1,140 万个被封禁账户、39.8 万次申诉和 4.2 万次申诉改判，并说明被封禁用户可以提出复核请求。

这些数字能够支持的表述是：**Anthropic 在该页面报告了这段时期的账户封禁、申诉和改判计数。** 它们不是模型能力分数，也不能单独说明违规行为的总体发生率、账户和用户是否去重或改判原因。若要计算比例或比较前后时期，先检查具体定义、分母、统计单位和历史报告是否一致。[System Trust and Reporting](https://www.anthropic.com/transparency/system-trust-reporting)

这与 Model Report 中“某个型号在某种测试下得到什么结果”不同，也与 Voluntary Commitments 中“公司说明自己如何履行或推进承诺”不同。三者可以互相补充，但不能彼此替代。

## 4. 示例：承诺概览不等于承诺全文

Voluntary Commitments 按共同主题组织多类公开承诺，读者可以从“Risk Assessment and Mitigation”等主题进入相关政策和承诺文件。当前页面还把 Responsible Scaling Policy（RSP）称为自愿安全政策，并将 Frontier Compliance Framework（FCF）描述为面向 SB 53 等监管要求的合规框架。这些是 Anthropic 对自身文件关系的说明；要理解具体要求，仍要打开相应文件并核对范围、日期和状态。[Voluntary Commitments](https://www.anthropic.com/transparency/voluntary-commitments)

阅读承诺时，可把信息分成四层：

1. **承诺文本：** 原文件究竟要求或倡议什么。
2. **执行说明：** Anthropic 表示已经做了什么、正在推进什么。
3. **验证证据：** 是否提供测量结果、外部评估、审阅或认证，以及覆盖范围。
4. **状态与时间：** 是已完成、持续工作、目标还是历史存档；页面何时更新。

Hub 的概览会把不同来源放在相邻位置，阅读时要保留这些状态差别。若页面链接到外部评估或认证，应查看该项证据本身的主体、范围和日期，不能把它自动推广成对 Hub 所有内容的独立验证。

## 5. 页面日期和数据日期要分开

| 当前页面显示 | 日期含义 |
| --- | --- |
| Model Report：2026-10-02 | 此处模型摘要标注的日期；逐项结论仍应回到模型对应的 System Card。 |
| System Trust and Reporting：最近更新 2026-07-23 | 该章节页面更新时间；页面中的示例统计覆盖 2026 年 1–6 月。 |
| Voluntary Commitments：最近更新 2026-07-23 | 该主题概览的更新时间；链接的具体政策和承诺可能有各自版本与日期。 |

这组日期来自 2026-11-09 的页面核对。Hub 后续更新后，重新检查页面时间戳和原始链接，不要把上表当作永久目录或当前最新状态的保证。

## 6. 练习：为问题选择资料入口

为每个问题选一个起点，并说明还需要核对什么：

1. “Claude Sonnet 5.5 的某项评估测试了什么，结果如何？”
2. “某半年平台报告列出的封禁和申诉数字能说明什么？”
3. “Anthropic 是否作出了某项行业承诺，承诺覆盖什么？”
4. “该承诺是否已由外部机构验证？”

**参考答案：** 1 从 Model Report 定位型号，再读相应 System Card 的方法和限制；2 从 System Trust and Reporting 开始，核对报告期、指标定义和统计单位，不把计数直接解释为总体比例；3 从 Voluntary Commitments 找主题入口，再读承诺原文；4 查找该项具体外部评估、审阅或认证文件，确认主体、范围和日期，不能只凭概览页面判断。

## 本课结论

Transparency Hub 把模型、平台治理和公开承诺材料整理到一个入口，但每类材料支持的结论不同。按问题选择章节，再追到原始模型卡、统计报告、政策或承诺文件；记录更新时间、数据覆盖期、统计单位与验证范围，才能准确说明 Anthropic 报告了什么，以及这些材料不能单独证明什么。

## 范围与时效

- 本课引用的章节日期和平台统计核对于 2026-11-09，平台计数的示例覆盖 2026 年 1–6 月。
- Transparency Hub 是 Anthropic 发布和维护的资料入口；本课没有独立审计其中的统计、承诺进度或执行情况。
- RSP、FCF、模型评估、承诺原文及公开统计均可能更新；以对应来源页面和文件的当前版本为准。
