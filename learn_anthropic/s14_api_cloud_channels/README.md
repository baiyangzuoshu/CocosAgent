# 第 14 课：Claude API 与云平台渠道的文档和责任边界是什么？

**目标：** 能从服务名称判断 Claude 接入渠道的运营方、认证与账单入口、API/功能边界和数据处理方，并找到对应的当前官方文档。

## 本课问题

同样是把 Claude 接入应用，为什么有时从 Claude Console 创建凭据，有时在 AWS、Google Cloud 或 Microsoft Foundry 配置？“通过云平台计费”是否意味着云厂商运营推理服务？

## 官方资料

- [API overview](https://platform.claude.com/docs/en/api/overview)：比较直接 Claude API 与各云平台入口；列出当前平台名称、认证和功能差异。
- [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)：说明不同接入渠道的数据处理方与保留政策入口。
- [Claude Platform on AWS](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws)：区分 Anthropic 运营的 Claude Platform on AWS 与 AWS 原生 Amazon Bedrock。
- [Claude in Amazon Bedrock](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock)：了解 Bedrock 的 AWS 认证、模型准入、区域和当前 API 路径。
- [Claude Models on Google Cloud：渠道比较](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/overview)：比较 Anthropic-managed 与 Google-managed 两种接入。
- [Claude Models on Google Cloud（Anthropic managed）](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/anthropic-managed) 与 [（Google managed）](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/google-managed)：分别查看认证、API、支持功能和数据处理说明。
- [Claude in Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)：查看 Azure 端点、身份验证、账单和该集成当前的发布状态。

核对日期：2026-11-09。下文是官方资料当日快照；平台产品名、运营方安排、模型/功能、地区与认证方式会变化。

## 1. “云平台渠道”不是一种统一架构

官方 API 总览除了 Anthropic 直接提供的 Claude API，还列出 AWS、Google Cloud 与 Microsoft Azure 上的不同产品。其中有些由 Anthropic 运营，有些由云厂商运营。选渠道时，先确认具体服务名，不能只说“我们用 AWS 的 Claude”或“走 Google”。[API overview](https://platform.claude.com/docs/en/api/overview)

| 接入服务（2026-11-09） | 推理服务由谁运营 | 认证与账单入口 | 当前需要查清的 API / 数据边界 |
| --- | --- | --- | --- |
| **Claude API（直接接入）** | Anthropic | Claude Console 账户与凭据；Anthropic 计量和账单。 | Claude API 的端点、模型和功能文档；Anthropic 是输入与输出的数据处理方。 |
| **Claude Platform on AWS** | Anthropic 在 AWS 基础设施上运营 | 通过 AWS 账户接入，使用 AWS IAM/SigV4 或文档支持的 API key；经 AWS Marketplace 计费。 | 使用 Claude API 端点，通常较接近直接 API 的功能，但仍要检查平台例外；Anthropic 处理推理数据，AWS 处理 Marketplace 的身份和账单信息。 |
| **Amazon Bedrock** | AWS | AWS IAM/SigV4 等 Bedrock 凭据；AWS 原生服务计费。 | AWS 运营推理服务并作为推理数据处理方；可用模型、地区、API 和功能按 Bedrock 自己的发布与支持表核对。 |
| **Claude Models on Google Cloud（Anthropic managed）** | Anthropic | 使用 Google Cloud 项目身份和 IAM；通过 Google Cloud Marketplace 计费。 | 这是由 Anthropic 运营、经 Google Cloud 项目接入的 Claude API；Anthropic 处理推理数据，部分支持服务可能在 Google Cloud 以外运行。 |
| **Claude Models on Google Cloud（Google managed）** | Google Cloud Agent Platform | Google Cloud 凭据与 IAM；按 Google Cloud Agent Platform 用量计费。 | Google 运营模型服务并作为数据处理方；调用的是 Agent Platform API，支持的 API、功能和区域要看 Google-managed 专属文档。 |
| **Claude in Microsoft Foundry** | Anthropic 的文档将其归为 Anthropic-operated 集成 | Microsoft Azure 端点；文档列出 Azure API key 或 Entra ID，以及 Marketplace 计费。 | Anthropic 处理推理数据；官方集成页当前标示 Preview。核对具体部署、支持功能和发布状态。 |

表中三个不同的问题要分别查：谁提供云基础设施、谁运营推理服务、谁是推理数据处理方。它们可能不是同一家公司。“云账单”只能说明计费路径，不能单独证明谁运营模型或处理输入输出。数据处理方归纳以 Anthropic 的 [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) 为准；具体项目还要阅读适用服务条款、数据处理附件和云厂商文档。

## 2. 认证、接口和功能也要按具体产品看

- **直接 Claude API** 使用 Claude Console 和 Claude API 文档所描述的认证、端点与请求方式。
- **Anthropic-operated 云集成** 可以通过云账户处理身份和账单，但不因此自动变成云厂商运营的模型 API。Claude Platform on AWS 使用 Claude API 表面；Google Cloud 的 Anthropic-managed 版本也被官方描述为由 Anthropic 运行的 Claude API。
- **云厂商运营的渠道** 则使用对应云服务的端点、凭据和 API 目录。Amazon Bedrock 既有 Bedrock 原生 API，也在当前文档中提供 Anthropic Messages API 路径；Google-managed 版本走 Google Agent Platform API。两者不能仅凭“都支持 Claude”就互换请求代码或功能。
- **相同模型名或相似 Messages 请求格式，不等于功能完全相同。** 各平台的批处理、文件、工具、上下文长度、区域、速率限制和新模型发布时间可能不同。检查官方 Features overview 与每个平台的支持表，并以实际选定的端点和部署为准。

例如，Bedrock 文档按 Opus 4.7 及之后的渠道与较早模型的 API 路径分别提供说明；Google Cloud 文档也把 Anthropic-managed 和 Google-managed 分成两套 API 页面。遇到旧教程时，应先核对它对应的服务、模型代际和文档更新日期。[Bedrock 文档](https://platform.claude.com/docs/en/build-with-claude/claude-in-amazon-bedrock) · [Google Cloud 渠道比较](https://platform.claude.com/docs/en/build-with-claude/claude-models-on-google-cloud/overview)

## 3. 一个容易漏掉的入口：云 Marketplace 也能卖 Claude 产品订阅

**Claude Enterprise 订阅**和**Claude API 接入**是两类产品。官方 AWS 文档特别提醒：通过 AWS Marketplace 采购的 Claude Enterprise 仍是 claude.ai 面向用户的产品，并非 Claude Platform on AWS，也不是 Amazon Bedrock API。看到发票由云厂商出具，不能据此推断调用的是哪个 API 或哪种处理安排。[Claude Platform on AWS：产品区分](https://platform.claude.com/docs/en/build-with-claude/claude-platform-on-aws)

遇到 Marketplace 项目，核对合同和产品页面的正式名称，并确认管理入口是 Claude Console、Claude.ai，还是对应的云服务控制台。

## 4. 选择渠道时按这个顺序核对

1. 我要直接调用 API，还是购买面向人的 Claude 应用？
2. API 渠道的正式产品名是什么？
3. 推理服务由 Anthropic 还是云厂商运营？输入/输出由谁处理？
4. 端点、认证、模型 ID、请求格式和功能支持是否满足应用要求？
5. 地区、数据保留、审计、日志、配额、账单和合同条件是否符合组织要求？
6. 阅读本服务的 Quickstart、Authentication、Feature support、Regions 和 data retention 页面。

可以用问题而不是厂商名来路由：

| 主要条件 | 应优先比较的资料入口 |
| --- | --- |
| 想用 Anthropic 直接提供的 API 和账单 | Claude API overview、Authentication、API and data retention |
| 想通过 AWS 账户接入，但要辨明由谁运营 | 分别阅读 Claude Platform on AWS 与 Amazon Bedrock，逐项比较 |
| 想从 Google Cloud 项目接入 Claude | 先阅读两种 Google Cloud offering 的比较，再选 Anthropic-managed 或 Google-managed 的独立文档 |
| 想在 Azure 身份和账单环境中接入 | Microsoft Foundry 文档，并确认其当前 Preview 状态、端点和功能支持 |
| 只想让员工直接使用 Claude 聊天产品 | 回看第12课的 Claude 产品入口；不要从 API 或模型托管文档开始 |

如果选择要求由特定云厂商运营或担任数据处理方，应在服务架构页、保留政策、地域与合同资料中分别验证；仅看“模型部署在某云”或“账单在某云”都不够。课程梳理帮助确定查证路径，不构成对特定法规或企业合同的合规结论。

## 5. 练习：从线索辨认渠道

1. 服务端向 api.anthropic.com 发请求，在 Claude Console 管理组织和凭据。
2. 团队的 AWS 账单里有 Claude 用量；需要确认 Anthropic 是否运营推理服务。
3. 代码使用 Google Cloud IAM，希望以 Google Agent Platform 提供的模型端点运行。
4. 一张 AWS Marketplace 账单写着 Claude Enterprise，员工通过 claude.ai 使用产品。
5. 组织要求明确核对输入和输出由哪一方处理、数据保留多久、哪些地区可能参与处理。

**参考答案：**

1. 直接 Claude API；查 API overview、Authentication 和 API data retention。
2. 不能只凭 AWS 账单判断。比较 Claude Platform on AWS（Anthropic-operated）与 Amazon Bedrock（AWS-operated），再看实际产品名和端点。
3. 查 Claude Models on Google Cloud（Google managed）的 Agent Platform 文档。不要把它和 Anthropic-managed 版本混为一谈。
4. 这是面向人的 Claude 产品订阅，不是 API 平台；看 claude.ai 产品与计划文档。
5. 按选定的具体服务阅读官方 data retention、地域、合同和云厂商文档；明确记录运营方与数据处理方，不把它们当作同一概念。

## 本课结论

比较 Claude API 渠道时，先认准正式服务名，再分别查推理运营方、认证与计费、API/功能支持、数据处理和保留规则。Claude API 直连、Anthropic 在云上的运营服务、云厂商托管的模型服务，以及通过 Marketplace 购买的 Claude 聊天订阅，可能出现在同一个云生态里，但边界并不相同。

## 范围与时效

- 官方页面核对日期：2026-11-09。
- 课程使用当日页面的产品名称和运营/数据处理说明；可用模型、功能、区域与认证会更新，应以每个平台当日文档为准。
- 本课讲资料路由和责任边界，不包含密钥配置、请求代码、价格比较、法律意见或合规保证。
