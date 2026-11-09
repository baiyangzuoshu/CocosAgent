# 第 12 课：请求失败、限流与 Request ID

**目标：** 能从 HTTP 状态、错误码和响应头判断请求失败类型，区分可重试的暂时错误与需要修复或账户操作的错误，并记录 Request ID 便于排查。

## 本课问题

请求报错后，怎样知道应该修正请求、检查凭证、等待限流恢复，还是联系支持？哪些错误适合重试？

## 前置知识

- [第 6 课](../s06_projects_keys_authentication/README.md)：Project、API Key 与认证。
- [第 8 课](../s08_responses_request_response/README.md)：响应对象的 `status`、`error` 和 `usage`。
- [第 11 课](../s11_streaming_background/README.md)：Streaming 与 Background Mode。

## 官方资料

- [Error codes](https://developers.openai.com/api/docs/guides/error-codes)：查看 HTTP 错误、SDK 错误类别和处理建议。
- [Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)：查看 RPM/TPM、`Retry-After`、限流头和退避策略。
- [TypeScript and JavaScript SDK](https://developers.openai.com/api/reference/typescript)：查看 SDK 错误对象、默认重试与 Request ID。
- [API Overview](https://developers.openai.com/api/reference/overview)：查看 API 共同行为和请求追踪信息。

## 1. 出错先收集证据，再决定下一步

遇到错误时，不要只看一句人类可读的 `message`。先记录并检查：

1. HTTP 状态码。
2. 响应错误体中的 `error.type`、`error.code` 和 `error.param`（如果有）。
3. 错误说明 `error.message`。
4. `Retry-After` 和限流响应头（如果有）。
5. Request ID、请求时间（含时区）、模型 ID、端点及应用侧追踪 ID。

通常让程序按稳定的 `error.code` 选择处理方式，用 `message` 帮助人理解和定位；不要只靠匹配会变化的错误文案。[Error codes](https://developers.openai.com/api/docs/guides/error-codes)

先分清错误层次：HTTP/API 请求返回非成功状态时，SDK 会抛出错误；如果请求成功创建了 Response，但生成后来失败或未完成，则检查 Response 对象自己的 `status`、`error` 和 `incomplete_details`（见[第 8 课](../s08_responses_request_response/README.md)）。后台任务和流式请求也可能在创建成功后，以终态或事件报告失败。

## 2. 常见错误类别与恢复动作

| HTTP 状态或错误类别 | 常见原因 | 第一动作 |
| --- | --- | --- |
| `400` | 字段缺失、参数无效、格式或大小不符合要求 | 检查 `error.param` 和请求结构，修正后再发 |
| `401` | API Key 无效、撤销，或认证上下文不匹配 | 检查服务端使用的凭证及 Project/Organization |
| `403` | 凭证有效但没有所需权限，或受访问策略限制 | 检查身份、Project 权限和策略；不要反复重试 |
| `404` | 请求的资源或 ID 不存在 | 检查资源 ID、所属 Project 和端点 |
| `429` | 可能是请求/Token 限流，也可能是额度、余额或支出上限 | 先查看 `error.code`；临时限流与账单/额度问题处理不同 |
| `500` | 服务端处理错误 | 可短暂等待并有限重试；若持续发生，检查服务状态并提供请求信息 |
| `503` | 模型临时过载或服务暂时不可用 | 遵循 `Retry-After`（如有），等待后有限重试 |
| 连接错误或超时 | 网络、代理、TLS、连接中断或等待超时 | 检查网络；判断操作结果未知时避免盲目重复产生副作用 |

特别注意：并非所有 `429` 都表示“等一下再试”。`rate_limit_exceeded` 或 `slow_down` 可能需要降低请求速度；`credit_balance_exhausted`、`project_spend_limit_exceeded` 等则需要处理余额或账户限制，重复发送不会恢复额度。[Error codes](https://developers.openai.com/api/docs/guides/error-codes)

## 3. 限流不只看请求次数

不同模型、Project 和组织的速率限制可能不同，常见维度包括：

- **RPM：** 每分钟请求数。
- **TPM：** 每分钟 Token 数。
- **项目级 Token 限制：** 某些响应头会额外报告 Project 的 Token 上限与剩余量。

API 响应可能包含 `x-ratelimit-limit-requests`、`x-ratelimit-remaining-tokens`、`x-ratelimit-reset-requests` 等头。遇到暂时限流时，`Retry-After` 如果存在，代表至少应等待的时间；`slow_down` 还可能表示流量增长过快，即使当下没有耗尽标称 RPM/TPM。[Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)

## 4. 有界重试：等待、退避并降低流量

适合重试的通常是暂时性限流、暂时过载、部分连接问题或服务端问题。推荐的原则是：

1. 如果收到有效的 `Retry-After`，至少等待该时间，不要提前重发。
2. 没有可用等待提示时，逐次增加等待时间，并加入随机抖动，避免许多客户端同时重试。
3. 限制重试次数和总耗时；超过预算后停止并记录错误。
4. 同时降低并发或请求速率，尤其遇到 `slow_down` 时逐步恢复流量。
5. 不要自动重试参数错误、认证/权限问题、余额不足或支出/使用限额错误；先处理根因。
6. 计入 SDK 自带的重试，避免 SDK 与应用各自重试造成请求次数成倍增加。

官方 TypeScript/JavaScript SDK 文档当前说明：连接错误、`408`、`409`、`429` 和 `5xx` 等部分错误默认最多自动重试两次。实际行为应以所安装 SDK 版本和 `maxRetries` 配置为准；需要自主管理重试预算时，关闭 SDK 重试或把它纳入整体上限。失败请求也会消耗限流额度，连续立刻重发不会解决问题。[TypeScript SDK retries](https://developers.openai.com/api/reference/typescript)、[Rate limits](https://developers.openai.com/api/docs/guides/rate-limits)

## 5. 用 Request ID 定位具体请求

API 响应的 `x-request-id` 是 OpenAI 为请求提供的追踪 ID。官方 TypeScript SDK 的成功响应对象上提供 `_request_id`；SDK 抛出的 `APIError` 上提供 `requestID`、`status`、`code` 和 `headers` 等信息：

```ts
import OpenAI from "openai";

const client = new OpenAI();

try {
  const response = await client.responses.create({
    model: "gpt-6-astra",
    input: "用一句话介绍 API。",
  });

  console.log("Request ID:", response._request_id);
  console.log(response.output_text);
} catch (error) {
  if (error instanceof OpenAI.APIConnectionError) {
    console.error("无法连接 API：", error.message);
  } else if (error instanceof OpenAI.APIError) {
    console.error({
      requestID: error.requestID,
      status: error.status,
      code: error.code,
      message: error.message,
    });
  } else {
    throw error;
  }
}
```

排查时把 Request ID、发生时间（含时区）、模型 ID、HTTP 状态和错误码交给负责排查的人或支持团队。Request ID 不是 API Key；仍不要在日志里记录 API Key，也要避免把用户秘密或不必要的敏感输入写入日志。[TypeScript SDK：Request IDs](https://developers.openai.com/api/reference/typescript)

## 6. Streaming 请求的错误边界

Streaming 请求开始前，认证、参数或速率限制等 HTTP 错误会在建立流之前返回；流开始后，失败也可能以事件流中的错误事件出现。如果已经显示了一部分输出，不能不加判断地从头重发，否则用户可能看到重复内容或重复处理结果。[Rate limits：Error mitigation](https://developers.openai.com/api/docs/guides/rate-limits)、[Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)

## 观察练习

判断每种情况应该“修复后重发”“等待并有限重试”还是“先处理账户/权限问题”：

| 观察到的情况 | 你的动作 |
| --- | --- |
| `400`，`error.param` 指向 `input` | 待填写 |
| `401`，API Key 已被撤销 | 待填写 |
| `429`，`error.code` 为 `slow_down`，带 `Retry-After` | 待填写 |
| `429`，`error.code` 为 `project_spend_limit_exceeded` | 待填写 |
| `503`，`error.code` 为 `server_is_overloaded` | 待填写 |

## 本课检查

完成本课后，能解释：

- 诊断时需要结合 HTTP 状态、`error.code`、`error.param`、响应头和 Request ID。
- `429` 可能代表暂时速率限制，也可能代表需要处理的余额、额度或支出上限。
- 暂时错误要遵循 `Retry-After`，否则采用带随机抖动的指数退避，并限制次数和总时长。
- API 错误中的 Request ID 能帮助定位单次请求；成功 SDK 对象和 APIError 都有对应字段。
- SDK 已有自动重试时，应用层必须考虑总重试预算；Streaming 已输出部分内容后不应盲目完整重放。

## 简化与边界

- 状态码和错误码示例是常见情况，不是穷尽清单；按当前 API 响应中的机器可读字段处理。
- Rate limits 会因模型、组织、Project 和配置而变化；不要把示例数值当作固定限额。
- SDK 重试策略会随版本和配置变化；本课记录的是授课时核对到的官方文档行为。
- 本课没有实际发送 API 请求。
