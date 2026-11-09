# 第 8 课：Responses 请求与返回对象

**目标：** 能读懂一次 Responses API 调用的主要请求字段和返回字段，知道怎样检查输出类型、响应状态和 Token 用量。

## 本课问题

Responses 请求对象里放什么？返回对象怎样表示文本、状态和用量？为什么不能把任意响应都当成一段文本？

## 前置知识

- [第 4 课](../s04_prompt_instructions_roles/README.md)：Prompt 和消息角色。
- [第 7 课](../s07_first_responses_request/README.md)：发送一次最小请求，并通过 SDK 读取 `output_text`。

## 官方资料

- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查阅 Responses 的请求参数与完整返回字段。
- [Text generation](https://developers.openai.com/api/docs/guides/text)：查看 `output` 数组结构，以及不应假设文本总在 `output[0]` 的原因。
- [API error codes](https://developers.openai.com/api/docs/guides/error-codes)：了解 HTTP/API 请求错误与响应对象字段的区别。

## 1. 请求对象：描述本次要做什么

第 7 课的最小请求包含 `model` 和 `input`。在 SDK 中，请求还可以带指令、输出上限或工具等配置：

```ts
const response = await client.responses.create({
  model: "gpt-6-astra",
  instructions: "用简洁的中文回答。",
  input: "什么是闭包？",
  max_output_tokens: 120,
});
```

| 请求字段 | 含义 |
| --- | --- |
| `model` | 选择处理请求的模型 |
| `input` | 提供本次输入，可以是字符串，也可以是由多种内容组成的消息列表 |
| `instructions` | 给本次生成提供较高优先级的行为要求 |
| `max_output_tokens` | 限制生成所用的输出 Token 上限；推理 Token 也计入上限 |
| `tools` | 声明本次模型可以使用的工具；工具执行流程会在后续课程学习 |

这些是请求配置。API 返回的 `status`、`output`、`usage` 则描述创建出的响应，不要把请求参数和响应字段混为一谈。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

## 2. 响应对象：查看身份、状态、输出和用量

Responses 返回对象包含许多字段。入门阶段先关注这些核心字段：

```json
{
  "id": "resp_...",
  "object": "response",
  "created_at": 1741485253,
  "status": "completed",
  "model": "gpt-6-astra",
  "error": null,
  "incomplete_details": null,
  "output": [
    {
      "id": "msg_...",
      "type": "message",
      "status": "completed",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "闭包是函数及其创建时所处词法环境的组合。",
          "annotations": []
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 20,
    "output_tokens": 18,
    "total_tokens": 38
  }
}
```

这是删减后的示意对象：真实响应还可能有其他字段；数值和文本也会随请求变化。

| 字段 | 阅读方式 |
| --- | --- |
| `id` | 这次 Response 的唯一标识，可用于日志和后续 API 操作 |
| `object` | 对象类型；Responses 对象为 `response` |
| `created_at` | 创建时间，Unix 时间戳（秒） |
| `model` | 本次实际使用的模型 ID |
| `status` | 本次 Response 的生成状态 |
| `output` | 输出项目数组；每项可能是消息、工具调用或其他类型 |
| `usage` | 请求和响应的 Token 用量统计 |
| `error` | 模型未能生成 Response 时可能包含错误信息 |
| `incomplete_details` | 响应不完整时说明原因 |

响应 schema、状态和用量字段可在 [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create) 中查阅。

## 3. `output` 是数组，不是“最终文本字段”

最简单的文本调用通常会返回一个 `message`，并在它的 `content` 中包含 `output_text`。但 `output` 也可能有多个项目，其中可能出现工具调用、推理相关项目或其他内容。数组项目的数量和顺序由模型响应决定，不能假设 `output[0]` 一定是最终文本。[Text generation](https://developers.openai.com/api/docs/guides/text)

SDK 提供 `response.output_text` 作为提取文本的便捷属性。若应用需要检查消息项目或不同内容类型，则用 TypeScript 的判别字段逐层查看：

```ts
for (const item of response.output) {
  if (item.type !== "message") continue;

  for (const content of item.content) {
    if (content.type === "output_text") {
      console.log(content.text);
    } else if (content.type === "refusal") {
      console.log("模型拒答：", content.refusal);
    }
  }
}
```

`item.type` 和 `content.type` 表示对象种类。SDK 的 TypeScript 类型可以让编辑器检查每个分支里可用的字段。若响应里有工具调用，它不是可直接显示给用户的自然语言结果；工具执行闭环会在工具调用课程讲解。

## 4. `status` 与 HTTP 状态码处在不同层

- **HTTP 状态码**说明 HTTP/API 请求本身的处理结果。请求认证失败、参数无效或触发限流等情况，通常需要根据 HTTP 错误和错误正文排查。
- **Response `status`**说明生成任务的生命周期。可见状态包括 `queued`、`in_progress`、`completed`、`incomplete`、`failed` 和 `cancelled`。
- **`error` 与 `incomplete_details`**补充响应失败或不完整的原因。

因此，“请求能成功得到一个 Response 对象”不等于“生成一定完整”。例如达到输出 Token 上限时，应查看 `status` 和 `incomplete_details`，不要只判断是否存在 `output`。错误处理、限流与 Request ID 会在第 12 课系统展开。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)、[API error codes](https://developers.openai.com/api/docs/guides/error-codes)

## 5. `usage` 是 Token 统计，不是价格

- `input_tokens`：本次请求计入的输入 Token 数。
- `output_tokens`：本次响应计入的输出 Token 数。
- `total_tokens`：输入与输出 Token 的合计。
- `input_tokens_details` 和 `output_tokens_details`：可提供缓存 Token、推理 Token 等细分信息。

这些字段适合检查请求规模和用量；不能只用 `total_tokens` 推出精确费用。实际价格还取决于所用模型、Token 类别以及当前定价规则。Token 的基础概念见[第 3 课](../s03_tokens_context_window/README.md)。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

## 观察练习

阅读上面的示意 JSON，回答：

1. 哪个值是这次 Response 的 ID？
2. 本次生成是否完成？依据哪个字段判断？
3. 用户可见文本在哪个层级？
4. `total_tokens` 是多少？它是否直接等于费用？
5. 如果 `output` 第一项是工具调用，应用能否直接把该项当作助手最终文本显示？

## 本课检查

完成本课后，能解释：

- `model`、`input`、`instructions` 等属于请求配置，`id`、`status`、`output`、`usage` 属于返回对象。
- Response 状态和 HTTP 请求结果是不同层次的信息。
- `output` 是异构数组；文本消息本身还有 `content` 数组，SDK 的 `output_text` 是便捷读取方式。
- `error` 和 `incomplete_details` 帮助解释失败或不完整响应。
- Token 用量是计量字段，不是金额字段。

## 简化与边界

- 示例只展示文本消息，没有展开推理项目、函数调用、内置工具、结构化输出或流式事件。
- 状态可能随 API 模式和执行过程改变；流式和后台响应会在第 11 课讨论。
- 本课展示的是返回结构示例，没有实际发送 API 请求。
