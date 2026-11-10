# 第 29 课：如何跟踪 API 版本、模型更新和弃用？

**目标：** 能区分 API 版本、SDK 版本、模型 ID 与托管平台的变化，找到官方更新和弃用通知，并在变更前安排兼容性检查与迁移。

## 本课问题

SDK 更新是否等于 API 更新？固定模型 ID 是否代表服务行为永远不变？看到某个模型即将退役时，怎样确认哪些生产服务受影响？

## 官方资料

- [API Versions](https://platform.claude.com/docs/en/api/versioning)：`anthropic-version` 请求头、版本历史和 API 兼容规则。
- [Migrating to API version 2026-10-21](https://platform.claude.com/docs/en/api/migration-2026-10-21)：当前版本迁移示例、SDK 对应版本、破坏性变更与测试步骤。
- [Claude Platform release notes](https://platform.claude.com/docs/en/release-notes/overview)：API 与平台更新记录。
- [Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)：模型 ID、固定快照、旧式别名及平台 ID 格式。
- [Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)：模型生命周期、替代建议、退休日期、通知和用量审计方法。
- [Model migration guides](https://platform.claude.com/docs/en/about-claude/models/migration-guide)：不同模型之间的迁移说明。
- [Models overview](https://platform.claude.com/docs/en/models/overview)：当前模型及不同平台的可用 ID。

核对日期：2026-11-10。版本记录、模型状态和退休日期会更新；下文中的 `2026-10-21` 是本次查阅时 API Versions 页面列出的最新 API 版本，不应当作固定常量。

## 1. 先分清四条变化线

| 变化对象 | 它决定什么 | 更新时要核对什么 |
| --- | --- | --- |
| API 版本 | 请求字段、响应结构和 API 行为；直接调用时通过 `anthropic-version` 请求头指定，SDK 通常会自动设置。 | 版本历史、迁移指南、破坏性变更，以及代码是否依赖特定请求字段或响应值。 |
| SDK 版本 | 客户端包提供的类型、辅助功能和默认请求行为。SDK 主版本发布时对应当时的 API 版本，因此升级 SDK 可能同时改变请求使用的 API 版本。 | 发布说明、升级指南、SDK 实际发送的 API 版本，以及应用是否需要同步改代码。 |
| 模型 ID | 请求使用哪个模型快照；每个 ID 有自己的生命周期。 | ID 是固定快照还是旧式便捷别名、目标任务表现、替代模型和退休安排。 |
| 托管平台 | 哪些模型 ID、API 版本和功能可用，以及谁安排模型生命周期。 | Claude API、Anthropic 管理的云端服务、Amazon Bedrock 或 Google Cloud 的对应文档与支持矩阵。 |

**关键区别：** API 版本与模型版本互不替代。更新模型 ID 不会自动处理 API 字段变更；升级 SDK 也不代表模型已切换。每次变更都要记录应用最终实际使用的 API 版本、SDK 包版本、模型 ID 和平台。

## 2. 固定版本仍需要兼容性检查

Anthropic 的 API 版本规则会保留已有输入参数和输出参数，但同一版本下仍可能增加可选输入、输出值或枚举值，也可能改变特定错误出现的条件。因此，客户端要能容忍文档允许的新增响应字段和新事件类型，并对未知枚举或流式事件设置明确的处理路径，不要把某个错误条件或输出集合当作封闭不变的全集。[API Versions](https://platform.claude.com/docs/en/api/versioning)

新 API 版本可能包含需要改代码的变化。例如，本次查阅时的迁移指南列出从 `2023-06-01` 迁移到 `2026-10-21` 时移除了 Messages API 的 `temperature`、`top_p` 和 `top_k` 请求参数；若应用继续发送这些参数，新版本请求会返回 400。升级步骤要求先切换版本、处理受影响的代码，再在发布前对新版本进行测试。[版本历史](https://platform.claude.com/docs/en/api/versioning)、[2026-10-21 迁移指南](https://platform.claude.com/docs/en/api/migration-2026-10-21)

SDK 主版本也可能影响 API 版本。迁移指南指出，SDK 请求使用与其主版本发布时对应的 API 版本；不用 SDK 直接调用时，则由应用自己设置 `anthropic-version`。这就是为什么变更清单要分别写 SDK 和 API 版本，并检查它们是否按预期配套。[迁移指南](https://platform.claude.com/docs/en/api/migration-2026-10-21)

模型 ID 也有不同含义：每个 ID 对应固定模型快照；Claude 4.6 代及之后的无日期 ID 是该版本的固定 ID，而较早模型在 Claude API 上可能有指向该小版本最新日期快照的便捷别名。模型权重固定不代表服务行为绝对不变，路由、安全分类器和采样等服务基础设施更新仍可能造成细微差异。每个模型 ID 都有独立的弃用和退休安排。[Model IDs and versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)

## 3. 看懂模型生命周期和平台边界

| 状态 | 官方文档中的含义 | 应对动作 |
| --- | --- | --- |
| Active | 正常支持并推荐使用。 | 持续评估任务适配性与质量。 |
| Legacy | 不再更新，未来可能弃用。 | 纳入迁移规划并留意状态变化。 |
| Deprecated | 仍能调用，但不再推荐；文档给出替代模型和退休日期。 | 在退休日期前选型、验证和迁移。 |
| Retired | 不再提供服务，调用会失败。 | 已不可作为可用回退；事前迁移并完成切换。 |

Anthropic 管理的平台日期适用于 Claude API、Anthropic 管理的 AWS/GCP 服务和 Microsoft Foundry。Amazon Bedrock 与 Google Cloud 的合作伙伴管理服务自行设定退休时间表，模型状态与日期可能不同。以应用真正使用的平台页面为准，不能拿一张表推断所有渠道的可用期。[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)

官方文档说明，针对有即将退休模型的活跃部署会发出邮件和文档通知；公开发布模型至少提前 60 天通知。通知是线索，不是内部资产清单：仍应通过 Console Usage 导出按 API Key 和模型汇总的 CSV，核对调用来源，再结合代码配置查出具体服务和负责人。[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)

## 4. 建一份可维护的调用清单

每个生产工作负载至少记录以下信息：

| 字段 | 示例内容 |
| --- | --- |
| 服务、环境与负责人 | `客服摘要 / production / 客服平台组` |
| 托管平台与区域 | 以实际 API 或云平台配置为准 |
| 模型 ID | 保存配置中的确切值，不只记产品系列名 |
| API 版本 | `anthropic-version` 的实际值；使用 SDK 时确认该 SDK 主版本对应的值 |
| SDK / 客户端版本 | 包名和锁定的版本号，或直接调用的客户端实现版本 |
| 依赖的字段与能力 | 特殊请求参数、响应枚举、流式事件、工具和其他依赖行为 |
| 验证与回退信息 | 评估样本、最近检查日期、替代方案、上线/回滚负责人 |

模型弃用时，可先导出 Console 用量报告，按 Key 和模型定位旧模型调用；报告负责找出使用位置，代码仓库和内部服务目录负责把它映射到具体应用。[Model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations)

## 5. 把更新变成可重复的迁移流程

1. **发现变化：** 查看 API Release Notes、API Versions、模型弃用页与模型迁移指南；关注 Anthropic 对受影响客户发送的邮件。将发现日期、来源、变化对象和计划日期写入清单。
2. **定位影响：** 对照每个服务的平台、模型 ID、API 版本、SDK 版本、请求参数、响应解析和所需功能。弃用通知出现后，用 Console 导出报告核对真实用量。
3. **阅读迁移说明：** API 变更看对应版本的 migration guide；模型变更看具体模型迁移指南，并复核新旧模型在目标平台的可用性、ID 格式和生命周期。
4. **验证兼容性：** 用第26课建立的代表性评估集，在测试环境检查任务质量、结构化输出、工具行为、错误率、延迟和成本。对 API 字段变更还要测试异常响应与未知枚举/事件的处理。
5. **分阶段发布：** 先将 SDK/API/模型变更分开或明确记录组合关系，再通过小流量或内部环境上线；观察错误和产品质量，保留可执行的回退方案。
6. **赶在退休前完成：** 不把退休日当作切换日；留出评估、修复、灰度和问题处理的时间。Retired 模型请求会失败，因此退休后不能依赖它作回滚目标。
7. **关账留档：** 更新锁文件、部署配置、变更记录和内部调用清单，记录已验证的平台、API 版本、SDK 版本、模型 ID 与核对日期。

## 练习：旧版集成准备升级

某生产服务通过 Claude API 调用一款早期模型的便捷别名，使用 SDK，并把 API 版本固定在 `2023-06-01`。团队收到模型退役通知，同时准备评估 API 版本 `2026-10-21`。请列出需要区分的变化项、要查看的官方资料，以及发布前的核对步骤。

**参考答案：** 将模型迁移和 API 迁移视为两项工作；记录当前模型 ID、SDK 包/主版本、SDK 对应或应用设置的 `anthropic-version`，并确认目标平台。查模型弃用页和具体模型迁移指南，使用 Console Usage CSV 找出受影响的 API Key 与服务；查 API Versions、2026-10-21 迁移指南和 Release Notes，确认代码是否发送已移除的采样参数等破坏性变化。选择替代模型后，以代表性评估集分别验证模型输出与新 API/SDK 行为，再分阶段发布、监控质量和错误，并确保在退休日前完成切换。具体迁移步骤仍以目标平台和当时的官方页面为准。

## 本课结论

让变更可控，先要知道每个服务实际使用哪个平台、模型 ID、API 版本和 SDK 版本，再沿着 Release Notes、版本迁移指南、模型生命周期与通知逐层查找影响。把官方通知和用量审计映射到内部调用清单，并在退休前完成代表性评估和分阶段迁移，才能避免旧配置在生产中突然失效。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- `2026-10-21` 是本次查阅时 API Versions 页面列出的最新版本；不同平台支持范围可能不同，特别是合作伙伴管理的平台。
- 课程不固定列出某个模型当前的状态或退休日期；请按模型 ID 和实际平台查阅最新生命周期页面。
- 第24课介绍 API 错误和速率限制，第25课介绍模型与平台选择，第26课建立应用评估，第28课讨论生产运行与可观测性。
