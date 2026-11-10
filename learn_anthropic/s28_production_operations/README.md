# 第 28 课：生产应用如何管理密钥、数据、成本与可观测性？

**目标：** 能为 Claude 生产接入确定合适的身份凭证与工作区，核对数据留存范围，监测成本和速率，并在满足隐私要求的前提下排查请求问题。

## 本课问题

把 API Key 放进服务的环境变量，是否就完成了生产准备？发生成本飙升、请求变慢或用户数据进入日志时，应用团队能否定位问题并采取措施？

## 官方资料

- [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)：API Key、服务账号、Workload Identity Federation 和 App Attest。
- [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)：API 数据保留、Zero Data Retention（ZDR）、HIPAA 准备和平台数据处理角色。
- [Usage and Cost Analytics API](https://platform.claude.com/docs/en/manage-claude/usage-cost-analytics-api)：按模型、工作区、API Key、调用者和时间段汇总用量与费用。
- [OpenTelemetry tracing for the Claude API](https://platform.claude.com/docs/en/manage-claude/opentelemetry)：用 OTel 跟踪 Messages 请求、工具调用和会话，并选择元数据或完整内容模式。
- [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)：请求、输入/输出 Token 限制、支出上限和响应头。

核对日期：2026-11-10。密钥选项、数据留存与适用功能、分析 API 状态和观测平台配置都可能变化；上线前按使用的平台、模型、合同和组织设置重新确认。

## 1. 把生产准备分成四条运行线

生产运行需要同时回答四个问题：

| 运行线 | 核心问题 | 需要保留的依据 |
| --- | --- | --- |
| 凭证与身份 | 哪个服务或用户在调用？凭证泄露后如何限制、轮换和撤销？ | Key 类型、服务账号或身份联邦规则、工作区范围、过期设置。 |
| 数据与留存 | 请求、响应、文件、工具结果和追踪数据由谁处理、保存多久？ | 平台、功能资格、组织数据保留设置及第三方观测服务的保留规则。 |
| 成本与配额 | 哪些工作负载产生费用或触及限额？谁收到预算告警？ | 模型、工作区、Key/调用者维度的用量与成本趋势，以及预算和速率限制。 |
| 可观测性 | 请求为何失败或变慢？能否关联应用功能、工具和 API 请求？ | 脱敏的请求标识、HTTP/停止状态、延迟、Token 用量、工具和重试信息。 |

这些控制要能区分环境与工作负载。第27课的最小工具权限管理的是 Agent 能做什么；本课的工作区、凭证和成本归属管理的是哪些服务在什么范围内运行、如何计量和追踪。

## 2. 为工作负载选合适的凭证

Anthropic 当前文档区分个人 API Key、服务账号 Key、Workload Identity Federation（WIF）和 App Attest。共享或无人值守的生产服务不要依赖某位员工的个人 Key；身份联邦可用受信任身份提供方签发的短期身份换取短期 Claude API Token，减少环境中的长期静态密钥。[Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)

| 场景 | 可先评估的身份方式 | 上线检查 |
| --- | --- | --- |
| 本地开发或个人脚本 | 个人 Key | 放入本机秘密存储或受控环境变量，不提交到源码或样例仓库。 |
| 共享服务、CI/CD、后台任务 | 服务账号 Key；若已有受支持的云/集群身份，评估 WIF | Key 尽量绑定专用工作区，设定到期时间并存入秘密管理器；定期轮换，怀疑泄露时立即禁用或删除。WIF 的身份提供方和信任规则也需要严格限制。 |
| 分发给终端用户的 iOS/macOS App | App Attest（文档覆盖的场景） | 确认平台支持、令牌权限与过期方式；不要把长期 API Key 嵌入公开客户端。 |

当前认证指南将 Workspace API Key 标为旧式做法，新集成优先使用身份关联的个人/服务账号 Key 或 WIF。按工作负载单独建身份和工作区，有利于撤销单个集成、追踪归属和减少权限范围。密钥到期和轮换也需要监控，避免服务在生产环境里突然收到认证失败。[Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)

## 3. 明确哪些数据会被处理或留下

数据盘点不应只看 Messages 请求文本；还要列出附件、文件名、模型响应、工具输入/输出、错误日志、分析字段和 OTel 追踪。按产品功能确认每一类数据在 Anthropic、云平台和第三方工具中的处理者、用途及留存政策。

Anthropic 当前 API 留存说明称，提示和回答默认不会留存用于对话内容存储；特定模型或功能可能有留存例外，保留的数据未经明确许可不会用于模型训练。留存行为会因 API 功能和接入平台而异；数据留存页还提供 ZDR 与 HIPAA 准备安排及功能资格表。ZDR 是组织级安排，需要单独启用，不能推断所有 API 功能或第三方集成都自动符合；例如需要保存状态的 Managed Agents 会话有自己的会话留存行为。Amazon Bedrock 或 Google Cloud 的部分接入由云服务商作为数据处理者，其相应控制需查看该平台的文档。[API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

上线前可以按数据流逐项确认：

1. 是否只发送完成任务所需的个人、业务和内部数据；测试环境是否使用安全样本？
2. 目标模型、API 功能、云平台和合同是否都属于所需留存或合规安排的覆盖范围？
3. 附件、工具、MCP 服务、日志和会话是否使用不同的保存与删除规则？
4. 谁能查看请求内容、导出使用报告或访问第三方观测平台？保存期结束后如何删除？

## 4. 把用量、成本和预算连起来

组织级 Usage 与 Cost Analytics 可以按模型、工作区、API Key、服务层级、调用者等维度汇总 Token/请求及费用，适合费用归属、使用趋势和异常消耗分析。通过为不同环境或服务设置工作区和身份，报表才能回答“哪个应用、模型或 Key 在消耗”。控制台的 Usage/Cost 页面可用于日常查看，具体 Admin API 访问范围按角色与认证方案配置。[Usage and Cost Analytics API](https://platform.claude.com/docs/en/manage-claude/usage-cost-analytics-api)

核对日文档将新版 Usage and Cost Analytics API 标为 Beta，并说明数据通常几小时更新、最长可能需要约一天，月结数值也可能在之后修订。因此，它适合历史分析和成本归属，不应当作拦截单次超支的实时闸门。为快速发现异常，应同时看应用侧每次响应的 Token 用量、请求量、模型与成本估算，并设置组织/工作区支出上限和告警。分析 API 的版本状态、时间范围和数据新鲜度以当前文档为准。[Usage and Cost Analytics API](https://platform.claude.com/docs/en/manage-claude/usage-cost-analytics-api)

成本上限与速率限制是两类控制：支出限额防止费用超过预算；RPM、ITPM、OTPM 等速率限制约束短期请求和 Token 吞吐。监控应同时观察用量趋势、响应头、429/错误率和当前支出，不要只盯一张费用总表。[Rate limits](https://platform.claude.com/docs/en/api/rate-limits)

## 5. 用追踪定位问题，同时保护内容

OpenTelemetry 可将 API/SDK 请求与应用自己的 Trace 关联，记录模型请求、工具调用、Token 和延迟等 span，帮助排查失败、定位慢环节并理解真实流量。当前文档把 Claude API tracing 标为 Beta，说明 API tracing 与 SDK tracing 的功能覆盖和云平台支持不同，部署时需查当前可用范围。[OpenTelemetry tracing for the Claude API](https://platform.claude.com/docs/en/manage-claude/opentelemetry)

当前 OTel 内容模式默认是 **metadata only**：记录标识、时间、状态、Token 统计以及选择的名称/描述，不包含完整提示与回答。**Full content** 会把提示、响应和工具结果等完整内容送到所选观测平台；数据之后按该平台自己的访问和留存规则保存。启用前需要确认敏感数据策略、平台权限、保留期和删除方式。给每个应用请求保留安全的关联 ID，便于串接延迟、HTTP 错误、停止原因、工具执行和用量；避免把 API Key 或不必要的用户数据写入日志。[OpenTelemetry tracing for the Claude API](https://platform.claude.com/docs/en/manage-claude/opentelemetry)

## 6. 上线前的运行检查

1. 使用生产专用服务身份；Key 不进入代码库、浏览器或可公开下载的应用包。
2. Key 绑定适当工作区，设置到期和轮换流程；有合适的身份提供方时评估 WIF。
3. 明确提示、文件、工具结果和追踪数据的处理方、留存、访问控制和删除方式。
4. 按模型、环境和工作负载监控 Token、成本、延迟、错误率与限流；配置预算阈值和升级联系人。
5. OTel 从元数据模式开始；只有确有排障需要且通过隐私审查时才开放完整内容。
6. 演练 Key 泄露/轮换、成本告警、速率限制、观测平台不可用和数据删除流程。

## 练习：一个后台客服 Agent 准备上线

该 Agent 在云平台运行，需要查询订单、草拟回复并在人工确认后发送邮件。请列出凭证、工作区、成本和追踪方面的四项准备，并指出一个需要额外确认的数据问题。

**参考答案：** 使用专用服务账号或受支持的 WIF 身份，不用员工个人 Key；Key/身份限定到客服工作区和所需资源；按工作区与模型监控 Token、成本、延迟和失败，并设支出告警；用 OTel 元数据关联应用请求与工具调用，发送邮件动作仍由第27课所述的授权与人工确认门禁控制。额外确认邮件正文、订单数据及追踪内容是否落入目标数据保留安排，以及观测平台是否会保存完整提示和响应。

## 本课结论

生产运营应将凭证、数据、费用和观测视为一套相互关联的控制：用可追踪且可撤销的身份运行服务，知道每类数据到哪里以及保存多久，按工作负载归集用量并设置预算边界，同时让排障所需信息不超出组织允许记录的内容。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- WIF、App Attest、ZDR/HIPAA 功能资格、分析 API 状态和 OTel 支持范围按目标平台与当前组织条件复核。
- API 错误和速率限制见第24课；模型及平台选择见第25课；工具权限和副作用门禁见第27课。
