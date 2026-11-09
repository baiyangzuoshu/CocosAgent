# 第 11 课：Streaming 与 Background Mode

**目标：** 能区分逐步接收事件的 Streaming 和异步运行任务的 Background Mode，并按交互体验与任务时长选择合适方式。

## 本课问题

如何在模型生成时就显示部分结果？当一个任务可能运行较久时，怎样避免客户端一直等待同一个连接？

## 前置知识

- [第 7 课](../s07_first_responses_request/README.md)：Responses API 的最小请求。
- [第 8 课](../s08_responses_request_response/README.md)：Response 对象和状态。
- [第 10 课](../s10_conversation_state/README.md)：Responses 状态与服务端对话状态。

## 官方资料

- [Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)：查看 SSE 流、事件迭代和增量文本。
- [Background mode](https://developers.openai.com/api/docs/guides/background)：查看异步生成、轮询、取消与保留边界。
- [Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)：查看事件名称和事件数据结构。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查看 `stream` 和 `background` 请求参数。

## 1. 两种机制处理不同的问题

| 机制 | 解决的问题 | 调用后怎样拿到结果 |
| --- | --- | --- |
| Streaming：`stream: true` | 不想等整段输出完成才展示或处理 | 连接上接收 Server-Sent Events（SSE）事件 |
| Background Mode：`background: true` | 任务可能很久，不能依赖一个请求连接一直等 | 获得 Response ID，之后轮询状态并取回结果 |

Streaming 是**结果传输方式**；Background Mode 是**任务运行方式**。它们不是同一个开关，也不完全互斥：后台任务可以同时启用 Streaming，以便边接收事件、边保留稍后恢复的能力。[Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)、[Background mode](https://developers.openai.com/api/docs/guides/background)

## 2. Streaming：逐步处理事件

默认请求会等模型生成完成后，一次性返回完整响应。设置 `stream: true` 后，Responses API 通过 SSE 逐个发送带类型的事件。TypeScript SDK 会返回可异步迭代的事件流：

```ts
const stream = await client.responses.create({
  model: "gpt-6-astra",
  input: "用三句话介绍海洋潮汐。",
  stream: true,
});

for await (const event of stream) {
  if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  } else if (event.type === "response.completed") {
    process.stdout.write("\n生成完成。\n");
  } else if (event.type === "error") {
    console.error("流式请求出错：", event.message);
  }
}
```

`response.output_text.delta` 表示新到达的一段文本；`response.completed` 表示响应完成。事件流还可能包含创建、输出项目、工具调用、拒答、失败等事件。这里的代码只处理文本场景；其他场景要根据事件的 `type` 分支处理。[Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)、[Responses streaming events](https://developers.openai.com/api/reference/resources/responses/streaming-events)

增量片段只是尚未完成的输出。UI 可以边到达边显示，但不要把每个 `delta` 当作完整句子或完整 JSON；需要最终结果时应等待结束事件并检查完整 Response。

## 3. Background Mode：提交任务后查询状态

设置 `background: true` 后，API 会异步运行任务并返回 Response 对象。保存响应 ID，然后在状态仍为 `queued` 或 `in_progress` 时轮询：

```ts
let response = await client.responses.create({
  model: "gpt-6-astra",
  input: "整理一份完整的海洋潮汐入门报告。",
  background: true,
});

while (response.status === "queued" || response.status === "in_progress") {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  response = await client.responses.retrieve(response.id);
}

if (response.status === "completed") {
  console.log(response.output_text);
} else {
  console.log("任务结束状态：", response.status, response.error);
}
```

轮询结束后还要处理 `completed` 以外的终态，例如 `failed`、`cancelled` 或 `incomplete`。应用需要保存 Response ID 和任务归属，以便继续查询；若用户取消或业务超时，也可以按官方接口取消运行中的后台响应。[Background mode](https://developers.openai.com/api/docs/guides/background)

## 4. 选择方式与几个重要边界

- **短交互、希望尽快看到文字：** 使用 Streaming。它会让首段输出更早到达，但不能缩短模型完成整个任务所需的计算时间。
- **长时任务、网络可能中断或请求可能超时：** 使用 Background Mode，保存 ID 后轮询。它改变任务等待和恢复方式，不会让模型本身更快完成推理。
- **只想要一个完整结果再展示：** 普通非流式请求更简单。
- **要后台执行又要收到增量事件：** 可同时设 `background: true` 和 `stream: true`。如果要断线后恢复后台事件流，还需保存事件 `sequence_number` 游标；只有创建时启用了 Streaming 的后台响应才能重新开启流。[Background mode](https://developers.openai.com/api/docs/guides/background)

Streaming 会让部分文本在生成完成前到达，内容审核比完整结果后再检查更难。如果产品必须先审核再展示，可以先缓冲输出，等待完整响应后检查。[Streaming API responses：Moderation risk](https://developers.openai.com/api/docs/guides/streaming-responses)

Background Mode 为轮询和异步运行临时保存响应数据。后台响应之后保留多久取决于 `store` 设置及项目的数据保留策略；Zero Data Retention 等模式有专门行为。上线前应按当前 [Background mode](https://developers.openai.com/api/docs/guides/background) 文档确认，不能把“后台执行”理解为无存储或不留数据。

## 观察练习

给下面三个产品需求选择普通请求、Streaming 或 Background Mode，并说明理由：

| 需求 | 你的选择 |
| --- | --- |
| 聊天界面希望尽快显示回答开头 | 待填写 |
| 一个分析任务可能持续数分钟，用户可以稍后回来查看 | 待填写 |
| 服务端需要拿到完整 JSON 后通过 Schema 校验再入库 | 待填写 |

最后一项可以再问：如果完整 JSON 要在整个生成过程中逐步到达，应用是否应该在 `response.completed` 之前把片段当作最终对象处理？

## 本课检查

完成本课后，能解释：

- Streaming 使用 `stream: true`，返回有类型的 SSE 事件流；Background Mode 使用 `background: true`，通过 Response ID 查询任务状态。
- `response.output_text.delta` 是增量文本，不代表完整响应；后台任务要轮询到终态。
- Streaming 和 Background Mode 解决不同问题，可以同时启用。
- 流式部分输出的审核更难；后台数据保留依赖 `store` 和项目保留策略。

## 简化与边界

- 示例只展示文本输出；多模态事件、流式工具调用和流恢复游标留待专题展开。
- 轮询间隔示例采用 2 秒，生产实现要依据服务行为、负载和重试策略调整。
- API 状态、存储策略和可用模型可能变化，执行前以当前官方文档与项目设置为准。
- 本课没有实际发送 API 请求。
