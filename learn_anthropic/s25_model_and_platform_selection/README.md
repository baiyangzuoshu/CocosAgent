# 第 25 课：如何选择模型和部署平台？

**目标：** 能先为任务选出合适的 Claude 模型候选，再按功能、基础设施、数据处理和计费条件选择部署渠道，并用自己的评估结果确认选择。

## 本课问题

模型目录有多个能力档位，Claude 又能通过 Anthropic API 和不同云平台调用。应先根据名字选一个“最强”的模型，还是先列清应用的实际要求？选择模型后，换一个平台是否仍能使用同一功能和 ID？

## 官方资料

- [Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)：能力、速度、成本、effort 和评估建议。
- [Models overview](https://platform.claude.com/docs/en/models/overview)：当前模型目录、规格、各平台 ID；Claude API 也提供 `GET /v1/models` 目录端点。
- [Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)：模型 ID、快照和别名的区别。
- [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)：模型生命周期、退役时间和迁移建议。
- [API overview](https://platform.claude.com/docs/en/api/overview)：Claude API 与云平台的选择因素和渠道目录。
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)：模型、功能与平台计费说明。
- [Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws)：Anthropic 托管的 AWS 接入与 Amazon Bedrock 的差异示例。

核对日期：2026-11-10。下文列出的模型名和能力定位是核对日的目录快照，用来演示查阅方法；模型、价格、平台支持及生命周期会更新，实际选型须回到当前目录和目标平台文档复核。

## 1. 先分开回答两个问题

**模型选择**回答“哪个模型能以可接受的质量、时延和成本完成这项工作？”**部署渠道选择**回答“通过哪套 API、身份系统、数据处理安排、区域和账单来调用它？”先定需求与约束，再分别比较这两项。一个云平台同时提供不同服务产品时，也要确认谁运营推理栈、谁处理推理数据，以及该产品支持哪些模型和功能。[Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)、[API overview](https://platform.claude.com/docs/en/api/overview)

## 2. 从任务要求建立模型候选

核对日官方目录的主要模型定位如下。把它当作候选起点，而非测试结论：

| 核对日模型 | 官方定位概括 | 可先评估的任务类型 |
| --- | --- | --- |
| Claude Haiku 5.5 | 当前目录中延迟和价格较低 | 实时、高频、规则较明确的分类、提取和路由 |
| Claude Sonnet 5.5 | 日常能力与速度的平衡 | 代码生成、数据分析、内容处理、视觉理解和工具使用 |
| Claude Opus 5.5 | 面向复杂 Agent 编码和知识工作 | 复杂工程、较长的 Agent 任务、企业工作流 |
| Claude Fable 5.2 | 面向要求最高的推理和长程 Agent 工作 | 多步骤深度研究、长时间运行的 Agent、复杂综合分析 |

Claude Mythos 5.2 在核对日的文档中属于需验证资格的受限访问模型；在确认当前准入条件前，不应把它列作任意组织都可用的生产候选。模型目录还列出上下文窗口、输出上限、支持功能、价格和各渠道 ID，应按任务需要逐项核验。[Models overview](https://platform.claude.com/docs/en/models/overview)、[Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

一个实用起点是：普通工作先选能力足够且更有效率的候选；需要最高能力的任务可先从更强模型开始，再用评估寻找更经济的替代。Anthropic 的当前选择指南建议多数工作负载从 Opus 5.5 开始；效率优先的工作也可先从 Haiku 5.5 开始。指南同时建议用实际评估决定是否升级，因此这不是对所有应用的一条固定规则。

## 3. 用自己的样本验证模型

官方指南建议用代表自身场景的基准测试、真实提示词和数据比较候选模型，至少看准确性、输出质量、边缘案例表现，并权衡速度与成本。[Choosing the right model](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model)

可以按以下顺序形成评估：

1. 写清必须满足的质量标准、允许的错误、延迟目标、每次或每月预算、上下文长度、输入模态和工具需求。
2. 用有代表性的样本、相同提示和相同应用流程测试两个或多个候选；包含常见输入、困难案例和失败案例。
3. 对照质量判据，同时记录实际延迟、输入/输出用量和估算成本；不要只拿演示答案或单个公开基准代替产品数据。
4. 如果模型支持 `effort`，可在同一模型内调节推理投入，以评估质量、速度和成本的变化，再决定是否更换模型。支持范围和默认值按具体模型文档核对。
5. 选择满足质量底线且成本、时延符合要求的候选，保留评估集作为之后升级模型时的对照。

对于任务难度差异很大的工作流，也可评估低成本模型处理常规样本、把难例交给强模型的路由方案。它可能减少平均推理费用，但会增加分类、路由和失败回退逻辑；需用整体流程评估，而不是只比较单次模型价格。[Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)

## 4. 再按约束选择部署渠道

| 渠道 | 常见考虑点 | 需要逐项核对 |
| --- | --- | --- |
| Anthropic Claude API | Anthropic 直接计费和支持；官方文档说明可直接使用最新模型与功能，适合新接入或需要直接使用 Claude Platform 的团队。 | 组织和工作区设置、区域、所需功能、限额、数据处理与合同条件。 |
| Anthropic 托管的云平台产品 | 可结合相应云账户、身份和计费；例如 Claude Platform on AWS 由 Anthropic 运营，接入 AWS IAM/Marketplace。 | 产品自己的模型 ID、认证、工作区配置、数据区域、可用功能和服务限制。 |
| 云厂商运营的 Claude 产品 | 可沿用云厂商服务、IAM、区域控制和账单体系；例如 Amazon Bedrock 由 AWS 运营推理服务。 | API 形状、模型上线节奏、功能支持、配额、价格、区域和数据处理角色。 |

Anthropic 文档提醒：云平台间的功能可用性和发布时间会不同。以 AWS 为例，Claude Platform on AWS 和 Amazon Bedrock 都可通过 AWS 使用 Claude，但运营方、API 入口、模型 ID、配额管理和数据处理者并不相同；若要求 AWS 是唯一数据处理者，当前 AWS 比较页指向 Bedrock。具体合规、区域和合同结论仍需按目标产品页面及组织安排确认。[API overview](https://platform.claude.com/docs/en/api/overview)、[Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws)

成本也应按目标渠道的完整价格表比较：模型输入/输出价格、缓存、批处理、长上下文、区域或推理模式等可能影响账单，云厂商提供的商业价格或计费单位也可能不同。按真实提示和流量估算，并在控制台查看实际用量，不要仅根据模型家族名称推断成本。[Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

## 5. 确认模型 ID、功能支持和生命周期

模型目录提供各平台的 ID；Claude API 也有 `GET /v1/models` 用于列出当前可用模型及详情。不同渠道的 ID 格式可能不同，部署配置应保存目标渠道对应的 ID，不要把某一平台的字符串照搬到另一平台。[Models overview](https://platform.claude.com/docs/en/models/overview)、[API overview](https://platform.claude.com/docs/en/api/overview)

不要只看名字判断模型 ID 是否会自动指向最新版。官方版本说明指出，ID 的具体稳定语义取决于模型代际：当前 4.6 及之后采用的无日期 ID 是该版本固定快照；更早一些 Claude API 的短别名可能指向该版本线最近的日期快照。固定 ID 也不代表服务模型的外围基础设施永不变化；服务路由、安全分类器等调整可能造成轻微的可观察行为差异。每个模型 ID 都有自己的弃用和退役日程。核对 API /平台文档，确认调用的功能、参数、Beta 能力、上下文限制和模型状态；迁移前用相同评估集重新测试。[Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)、[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)

## 6. 选型检查顺序

1. 从任务出发写出质量、延迟、成本、上下文、模态和工具要求。
2. 用当天的模型目录找候选，读取具体规格和目标平台可用性。
3. 根据账户体系、数据处理、区域、合规、功能、支持和计费约束选平台。
4. 在目标平台上用自己的评估集比较质量、边缘案例、延迟和账单估算。
5. 固定已验证的模型 ID，跟踪生命周期；模型或平台改变时重新运行评估。

## 练习：为三项需求分别选模型与渠道

团队有三个任务：A. 每秒处理大量短文本分类，延迟与成本敏感；B. 需要长时间运行的复杂编码 Agent，只有当更经济候选无法满足质量要求时才升级；C. AWS 企业明确要求由 AWS 运营推理并满足其适用的合规安排。为每项给出模型候选或平台候选，并说明还要验证什么。

**参考答案：** A 先把 Haiku 5.5 作为候选，用真实分类样本测质量和吞吐，再按账户与数据要求确定 Claude API 或合适的云渠道；B 先评估 Opus 5.5，若困难案例仍未过质量门槛，再将 Fable 5.2 纳入比较，必要时同时测试低成本路由方案；C 先比较 Amazon Bedrock 及企业要求，核对目标区域、具体模型 ID、支持功能和合规范围。三项都需要在目标平台核对现行模型目录、价格、限额和生命周期。

## 本课结论

模型解决“能力、质量、速度和成本是否合适”；部署平台解决“通过什么运营体系、接口、身份、数据处理和账单方式调用”。先用需求与评估缩小模型候选，再按平台约束筛选渠道，并用目标渠道中的实际配置验证模型 ID、功能、成本与生命周期。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 模型名称、规格、价格、准入条件、平台功能和退役时间会变动；本文模型定位仅为核对日快照。
- 第14课比较 API 与云平台责任边界；第26课展开应用质量评估；第29课讨论版本与弃用跟踪。
