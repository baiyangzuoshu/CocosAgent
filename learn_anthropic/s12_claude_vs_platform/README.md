# 第 12 课：面向用户的 Claude 产品与 Claude Platform 有什么区别？

**目标：** 能按使用者、交互方式、控制权与费用入口，在 Claude 应用、Claude Platform 和第三方云平台之间选择合适的资料入口。

## 本课问题

我想直接用 Claude 做工作，还是想把 Claude 集成进自己的网站、游戏或服务？这两种用法分别从哪里开始，谁负责应用逻辑和运行环境？

## 官方资料

- [Claude 可用界面说明](https://support.claude.com/en/articles/8114487-what-interfaces-can-i-use-to-access-claude)：列出当前用户界面和开发者/API 入口。
- [Claude 产品与计划帮助中心](https://support.claude.com/en/articles/8325606-what-is-the-pro-plan)：说明面向个人用户的 Claude chat plan；页面明确指出 Pro 计划不包含 Claude Console 的 API 使用。
- [Claude Platform Docs](https://platform.claude.com/docs/en/home)：API、SDK、Console、Messages、Managed Agents 及从构建到运维的开发者文档。
- [Claude API overview](https://platform.claude.com/docs/en/api/overview)：API、认证、Console、工作区与云平台接入概览。
- [Get your Claude API key](https://platform.claude.com/docs/en/get-api-key)：在 Console 管理 API key 的官方步骤；本课只用它区分入口，第15课再详读密钥和认证。

核对日期：2026-11-09。产品形态、套餐权益、API 功能和云平台支持可能变化，本课不固定记录价格或完整产品清单。

## 1. 一句话区分

- **Claude 产品（例如 claude.ai 和 Claude 应用）：** 人直接使用 Anthropic 提供的交互界面与功能。
- **Claude Platform：** 开发者通过 Console、API、SDK 和相关基础设施，把 Claude 接入自己构建的应用或服务。

两者都可以让人使用 Claude，但提供给用户的界面、控制范围、计费方式和可用功能不应默认相同。

## 2. 谁在控制什么？

| 维度 | Claude 产品 | Claude Platform |
| --- | --- | --- |
| 主要使用者 | 直接与 Claude 对话或完成工作的人、团队 | 构建应用的开发者、产品团队和组织 |
| 常见入口 | claude.ai、桌面或移动应用等用户界面；当前具体入口看帮助中心 | Claude Platform 文档、Claude Console、API、SDK |
| 交互方式 | 通过 Anthropic 提供的聊天或产品功能提交任务并查看结果 | 应用代码发送请求、读取响应；可选直接 Messages API 或文档所列的托管 Agent 能力 |
| 应用控制 | Anthropic 负责其产品界面、功能和默认运行方式；用户在产品提供的选项内操作 | 开发者负责自己的产品流程、用户界面、上下文、工具接线和数据处理；具体模型运行能力依所选 API 功能而定 |
| 账户与用量 | 由 Claude 产品账户和适用计划管理 | 由 Claude Console 的组织、工作区、凭据与 API 用量/账单机制管理 |
| 更适合的问题 | “我怎样直接使用 Claude？” | “我怎样在自己的应用中调用或管理 Claude？” |

开发者直连 Messages API 时，文档要求通过 Console 账户和凭据访问 API；Platform 也提供面向托管 Agent 的开发能力，因此它不只是一个 API 参数列表。具体功能、认证和控制边界要以所选 API 的文档为准。[Claude Platform Docs](https://platform.claude.com/docs/en/home) · [API overview](https://platform.claude.com/docs/en/api/overview)

## 3. 两个容易混淆的点

### Claude 产品订阅不等于 API 用量

Claude 帮助中心说明，Pro 是 Claude chat experience 的付费计划，并明确写明 Pro 不包含通过 Claude Console 使用 API 的额度。需要同时使用产品和 API 时，应分别核对相应入口、计划与用量规则；价格和计划权益以当日帮助中心为准。[Pro 计划说明](https://support.claude.com/en/articles/8325606-what-is-the-pro-plan)

这不表示两个入口一定需要不同的登录身份；本课要区分的是产品权益和 API 消耗，不推断登录账户能否共用或组织如何设置账单。

### 同一型号不代表每个入口行为完全一致

模型可能出现在 Claude 产品和 API 等多个入口，但实际功能、默认指令、工具和防护配置可能不同。Anthropic 的公开评估曾分别报告直接 API（无额外指令）和 claude.ai（带产品 system prompt）的结果；比较表现时要保留这些配置条件。[Transparency Hub 的模型评估示例](https://www.anthropic.com/transparency) · [第10课：System Card 与 Model Report](../s10_system_cards_model_reports/README.md)

因此，“某模型做到了什么”还要问：是在哪个产品或 API 配置下？有无产品提示、工具、访问控制或额外防护？

## 4. 快速路由

```text
我想直接跟 Claude 完成一项工作
  → Claude 产品入口与帮助中心

我想让自己的应用调用 Claude
  → Claude Platform Quickstart / API docs / Console

我想用已有云账户接入 Claude
  → 对应云平台文档，核实它与 Claude API 的功能、认证和账单差异
```

Claude Platform 文档将 Amazon Bedrock、Google Cloud 和 Microsoft Foundry 等列作其他云平台入口；这类方案的认证、功能可用性和账单由具体渠道说明，详见第14课。不要把“Claude 可通过某云使用”简化为“就是直接 Claude API”。[API overview：Claude API 与云平台](https://platform.claude.com/docs/en/api/overview)

## 5. 例子：游戏里的 NPC

如果开发者只想手动试问 NPC 台词，可以先在 Claude 产品界面检查提示词效果。这个过程适合快速探索，但不会自动把模型接进游戏。

如果 NPC 要在游戏里读取玩家背包并生成建议，开发者需要研究 Claude Platform：游戏服务准备允许发送的上下文，调用 API，再决定是否执行工具或读取游戏数据。模型不会因为用户在 Claude 产品里问过同一问题，就自动获得游戏账户、背包数据库或游戏内权限。

若开发者选择 AWS、Google Cloud 或 Microsoft 的 Claude 接入渠道，还要根据所选平台核对凭据、功能支持、数据处理和账单路径；这些属于第14课的范围。

## 6. 练习：选对入口

1. “我想把一份 PDF 上传给 Claude，总结后继续追问。”
2. “我希望游戏服务器按玩家状态调用 Claude，为 NPC 生成回应。”
3. “公司想在 AWS 现有账号里采购并接入 Claude。”
4. “我买了 Claude Pro，能否把这个订阅当成 API 额度？”

**参考答案：** 1 从 Claude 产品帮助中心查看当前文件功能和限制；2 从 Claude Platform Quickstart、API 文档和 Console 开始，并由应用控制可发送的数据和工具；3 查 AWS 对应 Claude 服务的当前官方文档，并比较它与直接 Claude API 的差别；4 不能直接这样假设，帮助中心指出 Pro 不包含 Console API 使用，需分别核对计划权益与 API 用量。

## 本课结论

直接使用 Claude 产品，重点查用户界面、功能和计划；把 Claude 集成到自己的应用，重点查 Claude Platform 的 API、SDK、Console 与管理文档；通过云平台接入，则按该平台的文档核对功能和责任边界。三个入口可能使用 Claude 模型，但不等于同一套交互、权限或账单。

## 范围与时效

- 本课依据 Anthropic 当前 Claude 帮助中心和 Claude Platform 文档，核对日期为 2026-11-09。
- 页面列出的产品界面、计划权益与 API 能力会变化；本课不提供价格快照，也不替代具体地区的计划或平台条款。
- 本课区分使用入口，不评价任何具体产品是否适合特定业务，也不展开 API 密钥管理、云平台配置或完整产品清单。
