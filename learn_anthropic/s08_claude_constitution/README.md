# 第 08 课：Claude’s Constitution 是什么类型的文件？

**目标：** 能把 Claude’s Constitution 识别为 Anthropic 对 Claude 行为价值的规范框架、训练材料和公开透明度文本，并与法律规则、实测结果和行为保证区分开。

## 本课问题

《Claude’s Constitution》写了 Claude 应当如何行动。它是不是一份法律、模型的完整规则表，或对产品行为的保证？它又怎样进入模型训练和公开评估？

## 官方资料

- [Claude’s Constitution（现行公开文本）](https://www.anthropic.com/constitution)：公开文档、适用范围、核心价值与全文。
- [Claude’s new constitution](https://www.anthropic.com/news/claude-new-constitution)：Anthropic 于 2026-01-22 发布的介绍，说明文档用途、写作方式和训练过程。
- [Frontier Safety Roadmap 更新记录](https://www.anthropic.com/responsible-scaling-policy/updates)：2026-10-19 对 Constitution 监督与对齐评估目标的状态更新。

核对日期：2026-11-09。公开 Constitution 是持续维护的文本；本课描述的是核对日可见的文档与路线图说明。

## 1. 先定位文件类型

Anthropic 将 Constitution 描述为关于 Claude 价值与行为的详细说明。它主要写给 Claude 阅读，既解释希望模型遵循的方向，也说明这些方向背后的理由。Anthropic 还把它用于训练过程，而不只是作为面向公众的宣言。[现行文本](https://www.anthropic.com/constitution) · [发布说明](https://www.anthropic.com/news/claude-new-constitution)

可以从三个角度理解它：

1. **规范框架：** 表达 Anthropic 希望 Claude 成为什么样的助手，以及在价值冲突时如何思考。
2. **训练材料：** Anthropic 表示会在不同训练阶段使用 Constitution；Claude 也会据此生成合成训练材料，例如帮助理解原则的样本、相关对话和候选回答排序。
3. **公开透明度文本：** 让外界查看 Anthropic 如何描述期望行为，并据此讨论、批评或提出反馈。

它不是一份机械执行的法律条文或穷尽所有情形的规则清单。文档以广泛原则、情境判断和理由解释为主，也包含某些特别重要行为的硬性约束。Anthropic 表示，在多数情况下，希望模型理解考虑因素后做出判断，而非僵化套用逐条规则。

## 2. 文件表达哪些行为方向？

现行文本将 Claude 的核心优先事项概括为四项：

| 顺序 | 期望方向 | 文档中的大意 |
| --- | --- | --- |
| 1 | Broadly safe | 不破坏人类对 AI 进行适当监督和纠正的机制 |
| 2 | Broadly ethical | 诚实、体现良好价值，并避免不适当的危险或有害行为 |
| 3 | 遵循 Anthropic 的指南 | 在相关情况下遵从更具体的指南，例如特定领域的处理方式 |
| 4 | Genuinely helpful | 真正帮助它服务的使用者与操作者 |

文本说这些优先级用于处理可能的冲突，但也提醒它们应作整体判断，而不是把低顺位价值一概降为无关紧要的“最后备选”。文档同时讨论有帮助、遵守指南、伦理、安全、Claude 的本质等主题，并说明这些价值为什么重要。[核心价值摘要](https://www.anthropic.com/constitution)

## 3. 从规范文本到模型行为

把 Constitution 理解为影响链条的一部分，而非行为结果本身：

```text
Anthropic 的价值与理由
        ↓ 写入
公开 Constitution 与相关指南
        ↓ 用于
训练、合成训练数据及回答偏好
        ↓ 形成
实际模型倾向和输出
        ↓ 另外检查
行为评估、对齐评估、System Cards / Risk Reports
```

Anthropic 称 Constitution 在多个训练阶段使用，并直接影响 Claude 的行为；但同一篇发布说明也明确说，训练困难，Claude 的输出不一定总符合文档理想。**因此，规范或训练材料不能单独证明模型在所有场景都符合它。**要描述实际表现，需要额外查看针对模型、场景与评估方法的证据。[发布说明](https://www.anthropic.com/news/claude-new-constitution)

现行公开页面说明，文档主要面向通用、主线 Claude 模型；为特定用途构建的模型可能不会完全符合这份 Constitution。引用时应注明适用范围，不能不加区分地套用于所有模型形态。[适用范围说明](https://www.anthropic.com/constitution)

## 4. “最终权威”指什么？

Anthropic 称 Constitution 是它对 Claude 行为愿景中的“最终权威”，并希望其他训练和指南与之保持一致。这描述的是**Anthropic 期望的内部规范优先级**，不是公共法律效力，也不是外部机构验证过的行为承诺。

同样，文档中出现的 “should”“should never”等表达，首先是在说明规范期望。它们不能单独证明模型总能遵循要求；验证需要看实际评估结果、System Cards 或风险报告，也要注意测试的模型版本、任务和方法。

## 5. 对照路线图：承诺、流程与结果要分开

Anthropic 在 2026-10-19 的 Frontier Safety Roadmap 更新中报告：自动化对齐评估已把“与 Constitution 对齐”作为核心指标，并为所有受评估模型报告该指标；解释性方法也已进入其整体对齐评估。该页面同时说明，曾尝试对一部分后训练数据和奖励进行监督，但认为这项检查未发现现有流程之外的问题，因此不再例行运行，并以当前形式退役了这项目标。该页称，至少计划在使用更新版 Constitution 训练的模型发生相关内部或外部部署后 90 天内，将公开文本更新至最近训练版本。[路线图更新](https://www.anthropic.com/responsible-scaling-policy/updates)

这段更新可按三层阅读：

- **规范：** Constitution 说明想要什么行为。
- **流程：** 训练和对齐评估说明如何尝试实现、检查规范。
- **结果：** 某个具体模型在某项评估中的数据说明观察到了什么。

路线图状态更新是 Anthropic 对自身流程的公开报告；它不是独立审计结论，也不等于模型已在所有真实使用中满足 Constitution。数据监督项目退役也说明，承诺和措施可能依据实施经验调整，读者应核对状态和日期，不要只看旧版计划文字。

## 6. 练习：为主张分类

判断每句话主要是**规范、训练方式、评估流程**还是**行为保证**：

1. “Claude 应诚实，并避免不适当的有害行为。”
2. “Anthropic 在多个训练阶段使用 Constitution，并据此生成部分合成训练材料。”
3. “自动化对齐评估把 Constitution 对齐程度作为一项核心指标。”
4. “Claude 在任何场景下都会遵守 Constitution。”

**参考答案：** 1 是规范；2 是训练方式；3 是评估流程；4 是行为保证，但官方文档并未作此保证，发布说明反而指出输出可能不总符合文档理想。

## 本课结论

Claude’s Constitution 是 Anthropic 公开的价值与行为规范，也是其称会用于训练的材料，并承担透明度作用。它描述期望，不是法律文件、完整规则引擎或模型行为保证。要了解这套规范怎样影响实际行为，还要把训练流程、针对具体模型的评估结果与独立外部验证区分开来。

## 范围与时效

- Constitution 页面与发布说明按 2026-11-09 核对；发布说明日期为 2026-01-22。
- 路线图状态依据 Anthropic 2026-10-19 的公开更新；计划和流程状态可能继续变化。
- 文档面向主线通用 Claude 模型；特殊用途模型可能有差异。规范文本不能替代具体模型的评估证据。
