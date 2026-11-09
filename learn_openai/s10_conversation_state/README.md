# 第 10 课：多轮对话怎样保留上下文

**目标：** 能区分手动传入历史、使用 `previous_response_id` 串接响应，以及使用 Conversations API 保存持久对话状态，并知道它们各自的边界。

## 本课问题

新一轮请求怎样让模型看见前文？“保存了对话”是否代表模型拥有无限记忆？

## 前置知识

- [第 7 课](../s07_first_responses_request/README.md)：发出 Responses API 请求。
- [第 8 课](../s08_responses_request_response/README.md)：理解 Response 的 `id`、`output` 和状态。
- [第 3 课](../s03_tokens_context_window/README.md)：Token 与上下文窗口。

## 官方资料

- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)：查看手动历史、Responses 串接和 Conversations API。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查看 `previous_response_id`、`conversation` 和 `instructions` 字段。
- [Text generation](https://developers.openai.com/api/docs/guides/text)：查看 `instructions` 在多轮请求中的适用范围。

## 1. “保留上下文”是让下一次请求拿到前文

模型不会仅仅因为上一次调用过，就自动记住整段历史。每一轮都要明确告诉 API 使用哪段上下文：

1. 应用自己把历史消息和响应项目放进下一次 `input`。
2. 应用传入上一次 Response 的 ID，让 Responses API 串接前一轮。
3. 应用把请求关联到 Conversations API 的 Conversation ID，由服务端对话对象保存消息和响应项目。

这三种方法都在管理“下一轮模型可用的上下文”，差别在于状态由谁传递、保存在哪，以及应用控制历史的程度。[Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)

## 2. 方法一：应用手动传完整历史

应用保存对话记录，并在新请求中发回之前的消息和模型输出：

```ts
const first = await client.responses.create({
  model: "gpt-6-astra",
  input: "我正在设计一个待办工具，请优先用 TypeScript 举例。",
});

const second = await client.responses.create({
  model: "gpt-6-astra",
  input: [
    { role: "user", content: "我正在设计一个待办工具，请优先用 TypeScript 举例。" },
    ...first.output,
    { role: "user", content: "现在给我一个任务类型定义。" },
  ],
});
```

此方式让应用决定保存哪些轮次、如何截短或整理历史。多模态、推理或工具场景中，完整 `output` 可能包含不止普通文本；不要无意间只存 `output_text` 而丢弃后续请求需要的项目。每次请求只会看到这次实际传入的历史。[Conversation state：Manually manage conversation state](https://developers.openai.com/api/docs/guides/conversation-state)

## 3. 方法二：用 `previous_response_id` 串接响应

先取得上一轮 `response.id`，再把它传给下一轮：

```ts
const first = await client.responses.create({
  model: "gpt-6-astra",
  instructions: "请用简洁的中文回答。",
  input: "我正在设计一个待办工具。",
});

const second = await client.responses.create({
  model: "gpt-6-astra",
  previous_response_id: first.id,
  instructions: "请用简洁的中文回答。",
  input: "给我一个任务类型定义。",
});
```

`previous_response_id` 让 API 将前一轮响应上下文接到新请求上；应用不必每次重发完整 transcript。注意：

- 上一轮顶层 `instructions` 不会自动带到下一轮，要继续使用就每次重新传。
- `previous_response_id` 与 `conversation` 不能在同一个请求中一起使用。
- 响应串接便于延续上下文，但不会免除上下文 Token 计算；链中此前的输入 Token 仍会作为输入 Token 计费。

这些字段边界见 [Responses API Reference](https://developers.openai.com/api/reference/resources/responses/methods/create) 和 [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)。

## 4. 方法三：用 Conversations API 保存持久对话

如果对话需要跨会话、设备或任务继续，可以先创建 Conversation，再让 Responses API 的多轮请求都关联同一个 ID：

```ts
const conversation = await client.conversations.create();

const first = await client.responses.create({
  model: "gpt-6-astra",
  conversation: conversation.id,
  input: "我正在设计一个待办工具。",
});

const second = await client.responses.create({
  model: "gpt-6-astra",
  conversation: conversation.id,
  input: "给我一个任务类型定义。",
});
```

Conversation 是有独立 ID 的长时对象，可以存储消息、工具调用、工具结果和其他项目；关联的 Responses API 调用会自动把输入和输出项目加入 Conversation。[Conversation state：Using the Conversations API](https://developers.openai.com/api/docs/guides/conversation-state)

## 5. 选哪种方式：对照状态由谁管理

| 方式 | 上下文怎样到下一轮 | 更适合 |
| --- | --- | --- |
| 手动历史 | 应用保存并重新发送历史项目 | 需要自己选择、删减或改写上下文 |
| `previous_response_id` | 应用传上一轮的 Response ID | 简单延续一条响应链 |
| Conversations API | 应用传 Conversation ID，由对话对象保存项目 | 需要跨会话、设备或任务持久继续 |

无论使用哪种方式，对话存储都不等于无限上下文。模型一次请求仍受上下文窗口限制；历史增长后，应用仍需考虑保留哪些信息、如何压缩或整理。[Conversation state：Managing the context window](https://developers.openai.com/api/docs/guides/conversation-state)

## 6. 存储与用量边界

- Responses 默认会存储 30 天；创建 Response 时可用 `store: false` 关闭这种 Response 对象存储。
- Conversations API 对话对象及其中的项目不受同一个 30 天 TTL 限制。不要把 `store: false` 理解成删除或关闭 Conversation 的持久历史。
- 使用 `previous_response_id` 串接时，链中之前的输入 Token 仍会作为输入 Token 计费。
- 选用持久状态前，应按应用的数据保留需求决定是否创建 Conversation，以及如何管理用户与 Conversation ID 的对应关系。

具体保留策略可能受账户和组织设置影响；以当前官方 [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state) 文档和项目配置为准。

## 观察练习

为一个客服对话选择上下文方案，并说明理由：

1. 单次请求，应用需要自己删掉早期无关轮次。
2. 同一个页面里的简单追问，应用希望直接引用上一轮 Response。
3. 用户今天在手机开启对话，明天在另一台设备继续。

再回答：如果第二轮用了 `previous_response_id`，而第一轮的 `instructions` 是“始终用简洁中文回答”，第二轮是否自动继承这条指令？

## 本课检查

完成本课后，能解释：

- 无状态的新请求不会自动知道前文；应用必须显式提供或关联上下文。
- 手动历史、Response 串接和 Conversation 对象分别由应用或 API 管理不同部分的状态。
- `previous_response_id` 与 `conversation` 不能用于同一次 Response 请求。
- 串接时上一轮的顶层 `instructions` 不会自动延续；需要时每轮重发。
- 持久保存的对话仍受模型上下文窗口限制；历史输入仍计入 Token 用量。

## 简化与边界

- 本课代码展示基本文字对话，不展开工具调用、流式、后台任务和上下文压缩。
- Conversation 的持久保留与 Responses 默认 30 天存储是不同机制；实际数据控制以当前组织设置和官方文档为准。
- 示例使用当前官方文档中的 `gpt-6-astra`；模型可用性和命名可能变化。
- 本课没有实际发送 API 请求。
