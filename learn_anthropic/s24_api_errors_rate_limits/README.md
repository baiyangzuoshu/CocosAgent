# 第 24 课：API 错误、重试和速率限制怎样处理？

**目标：** 能根据错误类型判断应修正请求、等待重试、检查账户额度还是调整流量，并从当前文档读取适用限制。

## 本课问题

收到 API 错误时，哪些情况可以重试，哪些要先改请求或账户设置？看到 `429` 是否一定代表“等一会儿再试”？

## 官方资料

- [Claude API errors](https://platform.claude.com/docs/en/api/errors)：HTTP 状态、错误结构、request ID、SDK 异常与重试说明。
- [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)：限流维度、响应头、额度和速率限制的区别。
- [API overview](https://platform.claude.com/docs/en/api/overview)：官方 SDK 的重试、超时和连接管理概览。

核对日期：2026-11-10。本课以 Anthropic 第一方 Claude API 文档为准；Bedrock、Vertex AI、Microsoft Foundry 等渠道可能使用不同状态码、配额和重试策略。限制会随组织、模型、使用层级和平台变化，不把示例额度当成固定值。

## 1. 先读取错误结构和请求标识

Claude API 的错误响应包含顶层 `type: "error"`、`error.type`、`error.message` 和 `request_id`；响应头也提供 `request-id`。官方 SDK 会把错误映射为类型化异常。处理代码应优先按状态码和 SDK 异常类型分流，不要依赖错误文案的精确字符串，因为错误类型和消息以后可以扩充。排查具体请求时保存 request ID，必要时提交给支持团队。[Claude API errors](https://platform.claude.com/docs/en/api/errors)

## 2. 按类别决定下一步

| 状态或类别 | 常见含义 | 通常的处理方式 |
| --- | --- | --- |
| `400 invalid_request_error` | 参数、消息内容或请求格式不符合要求；用户设定的组织或工作区支出上限也可能返回 400。 | 修正字段、格式或业务请求；如错误提示达到自设支出上限，去 Console 检查或调整限额。不要原样循环重试。 |
| `401 authentication_error` | API Key 无效、过期或已撤销；云平台调用还可能是云凭据或签名问题。 | 检查凭据来源、有效期和部署配置，再发起新请求。 |
| `402 billing_error`、`403 permission_error` | 付款或计费状态异常；密钥、组织或工作区无所需权限。 | 检查账单、资源权限和工作区配置。 |
| `404 not_found_error`、`409 conflict_error` | URL/资源 ID 不存在；资源状态冲突或唯一值重复。 | 修正路径和 ID；409 要先解决资源冲突再重试。 |
| `413 request_too_large` | 请求体超出该端点的大小上限。 | 缩小或拆分输入，并核对当前端点限制。 |
| `429 rate_limit_error` | 可能触及请求/Token 速率限制，也可能达到月度支出上限。 | 先看 `retry-after` 和错误详情，再决定等候、降流还是处理支出额度。 |
| `500 api_error`、`529 overloaded_error` | 服务端异常或暂时过载。 | 有界退避后重试；持续失败时用 request ID 排查。 |
| `504 timeout_error` | 请求处理超时；部分长请求可能在响应开始前超时。 | 评估 Streaming 或 Message Batches 等长请求方式，避免无界立即重试。 |

表中的类别帮助定位方向；API Reference 可能增加状态码或错误类型，应保留未知错误的兜底处理。[Claude API errors](https://platform.claude.com/docs/en/api/errors)

## 3. 重试要有边界

当前官方 SDK 会对连接错误、限流和 5xx 等暂时性故障进行指数退避重试，默认最多两次；有 `retry-after` 时遵从该等待时间。SDK 客户端可用 `max_retries` 调整次数或关闭重试。先了解所用语言 SDK 的当前行为，避免在 SDK 已重试的基础上再叠加多层、无上限的循环。[Claude API errors](https://platform.claude.com/docs/en/api/errors)

对 400、401、402、403、404 和 413 这类请求或账户问题，反复发送同样请求通常不能解决原因。409 需要先修复冲突。遇到网络中断或超时，应设置应用侧最大尝试次数和总体等待时间，并记录请求 ID（若已收到）；重试策略不应让用户或后台任务无限等待。这些是应用层的可靠性设计原则，具体副作用仍取决于调用的端点和业务流程。

## 4. `429`：先辨认限流还是额度

Messages API 的速率限制可以分别按每分钟请求数（RPM）、输入 Token 数（ITPM）和输出 Token 数（OTPM）计算，并因模型类别和组织使用层级而异。限制使用持续补充的 Token Bucket 方式，不是每分钟整点清零；因此，平均速率看起来合规时，短时突发也可能触发 429。逐步增加流量并保持稳定节奏，有助于避免加速限制。[Rate limits](https://platform.claude.com/docs/en/api/rate-limits)

响应头 `retry-after` 表示再次尝试前需要等待的秒数，提前重试仍可能失败。`anthropic-ratelimit-requests-*`、`anthropic-ratelimit-input-tokens-*` 和 `anthropic-ratelimit-output-tokens-*` 等响应头可用于观察限制、余量和重置时间；不要把组织当前数值硬编码到应用中。控制台 Usage/Rate limits 页面可查看实际配额，长期需求再评估申请提高限制。

额度错误也可能返回 429。达到使用层级月支出上限时，官方示例中的 `error.details.error_code` 为 `enforced_spend_limit_reached`，且没有 `retry-after`；自动重试也会继续失败，直到额度恢复或限制变更。另一方面，用户自己设定的组织/工作区支出限制通常以 400 `invalid_request_error` 返回。因此，不能只看 HTTP 429；应结合 `error.details`、`retry-after` 和 Console 账单信息判断。[Claude API errors](https://platform.claude.com/docs/en/api/errors)、[Rate limits](https://platform.claude.com/docs/en/api/rate-limits)

## 5. Streaming 需要单独处理错误

非流式请求通常以 HTTP 响应状态判断请求是否成功；SSE 流可能先收到 HTTP 200，之后在事件流中出现错误。此时错误通过流事件发送，不走常规 HTTP 错误响应的处理路径。Streaming 客户端要同时处理连接错误、错误事件和正常的结束事件，不能因为初始状态是 200 就把尚未完成的响应视为成功。[Claude API errors](https://platform.claude.com/docs/en/api/errors)、[Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)

## 6. 一个简单的处理流程

1. 读取 HTTP 状态、`error.type` 和 `request_id`，如果是流请求也检查 SSE 错误事件。
2. 请求或权限问题先改参数、密钥、账单或工作区设置；不要重试未修复的确定性错误。
3. 429 有 `retry-after` 时遵照等待并降低并发或突发速率；无该头时检查是否达到支出上限。
4. 连接错误、500 或 529 使用有上限的退避重试；多次失败后停止并保留 request ID 供诊断。
5. 请求很长或容易受断连影响时，考虑 Streaming 或异步 Message Batches；针对目标平台重新核对行为。

## 练习：该修正、等待，还是检查额度？

某应用遇到三种情况：A. `400 invalid_request_error` 提示字段类型错误；B. `429` 带 `retry-after: 4`；C. `429 rate_limit_error` 没有 `retry-after`，详情显示 `enforced_spend_limit_reached`。分别决定下一步。

**参考答案：** A 修正请求字段后再试；B 等待至少 4 秒，再以受控速率重试，并留意是否仍会触及其他限流维度；C 停止自动重试，检查 Console 支出限额、额度恢复时间或是否需要申请更高上限。对三类情况都记录状态、错误类别和可用的 request ID。

## 本课结论

错误处理的关键是识别故障类别：请求/凭据/权限问题先修复；暂时性服务故障有限退避；速率限制遵从响应头并平滑流量；支出上限则需要检查账户配置。`429` 并不总是等待几秒就能恢复，流式请求也可能在 HTTP 200 后发生错误。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- SDK 默认重试次数、组织限额、模型分组和各云平台行为可能变化，以当前 SDK 和目标平台文档为准。
- Streaming 与批处理见第23课；模型和部署渠道选择见第25课。
