# 第 4 课：Prompt、指令和消息角色怎样影响模型行为

**目标：** 能把应用规则、用户任务、背景资料和输出要求分开放清楚，并知道消息角色如何表达指令优先级。

## 本课问题

为什么同一个模型面对不同的 Prompt 会有不同表现？把要求写在 `developer` 还是 `user` 消息里，有什么区别？

## 前置知识

- [第 2 课](../s02_text_generation_flow/README.md)：输入和上下文会影响模型生成的输出。
- [第 3 课](../s03_tokens_context_window/README.md)：指令、历史和背景都会占用输入上下文。

## 官方资料

- [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)：组织开发者指令、上下文、例子和消息格式。
- [Prompting](https://developers.openai.com/api/docs/guides/prompting)：Prompt 的基本概念，以及如何区分常驻的语气/角色要求和单次任务。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：Responses API 的 `instructions`、`input` 和消息角色说明。
- [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses?api-mode=responses)：Chat Completions 的消息怎样映射到 Responses API。

## 1. Prompt 不只是最后一句问题

Prompt 是模型本次生成时收到的指令和上下文。它可以包含应用规则、用户的任务、相关背景、例子和输出格式。只给一句“写一句台词”，模型不知道台词服务于什么场景，也不知道长度、语气或事实边界。

在 Responses API 中，可以把应用层的稳定规则放在顶层 `instructions`，把本轮任务放在 `input`。简单字符串 `input` 等价于一个用户消息；也可以传入带不同 `role` 的消息列表。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)、[Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses?api-mode=responses)

## 2. 区分“消息角色”和“内容里写的身份”

这两个概念都可能被叫作“角色”，但含义不同：

| 概念 | 例子 | 表达什么 |
| --- | --- | --- |
| 消息角色 `developer` | `{ role: "developer", content: "..." }` | 这条指令来自应用开发者，优先级高于用户消息 |
| 消息角色 `user` | `{ role: "user", content: "..." }` | 用户提供本次请求、输入和配置 |
| 消息角色 `assistant` | 模型返回的消息 | 这是模型生成的内容或上一轮回答 |
| Prompt 中的身份描述 | “你是奇幻 RPG 的 NPC 台词编剧” | 希望模型采用的工作身份或表达方式 |

官方文档说明，`developer` 指令优先于 `user` 指令；`system` 或 `developer` 消息也高于 `user` 消息。可以把 `developer` 内容理解为应用的规则，把 `user` 内容理解为在这些规则下要处理的具体输入。[Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)、[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

消息角色描述来源和优先级；“你是台词编剧”这样的句子只是内容中的文字。两者不能互相替代。

## 3. 用几个明确部分组成 Prompt

先把要求整理为这些部分，再决定放在哪个字段：

1. **任务：** 这次要完成什么？
2. **身份/目标：** 模型在这项功能里承担什么职责？
3. **背景：** 完成任务所需的地点、人物、数据或资料是什么？
4. **约束：** 哪些事实不能编造，长度、语气或内容边界是什么？
5. **输出格式：** 要一句话、列表、JSON，还是其他结构？
6. **例子（可选）：** 如果风格难以描述，提供少量输入和期望输出作为示范。

OpenAI 的 Prompt engineering 指南展示了 `Identity`、`Instructions`、`Examples` 和 `Context` 等区块，并建议用 Markdown 标题、列表或 XML 标签标明不同内容的边界。具体结构可以随任务调整；标题本身不是模型必须遵循的特殊语法。[Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering)

## 4. NPC 台词例子

模糊要求：

```text
写一句欢迎台词。
```

它没有告诉模型场景、人物、语气和输出边界。把常驻规则和本轮任务分开后，可以写成：

```ts
const response = await client.responses.create({
  model: "MODEL_ID",
  instructions: `# 身份
你为奇幻 RPG 撰写简洁、自然的 NPC 台词。

# 规则
- 只输出一句简体中文台词。
- 语气友好、克制。
- 不添加输入中没有的世界设定。`,
  input: `# 任务
为初次到访的旅人写一句欢迎语。

# 场景
雪夜，村口，守夜人正在值守。`,
});

console.log(response.output_text);
```

可能的结果是：“雪夜路滑，进村喝口热汤吧。”这里 `instructions` 定义应用希望保持的职责和规则，`input` 带入本轮变化的任务与场景。实际输出会因模型和生成过程而异；“只输出一句”是对模型的要求，不是应用层的硬校验。

## 观察练习

请把“写一句欢迎台词”改写成一个更清楚的请求，并指出：

- 哪些内容应该是每次都适用的应用规则，适合放进 `instructions` 或 `developer` 消息？
- 哪些内容只属于当前场景，适合放进 `input` 或 `user` 消息？
- 你会怎样说明输出的语气和格式？

## 本课检查

完成本课后，能说清楚：

- Prompt 包含模型本次生成所需的指令和上下文，不只是用户最后一句话。
- 消息角色表达来源与指令优先级；内容里的身份描述只是 Prompt 文本。
- `developer` 消息承载应用规则，`user` 消息提供本次任务，`assistant` 消息是模型输出。
- 清晰 Prompt 要说明目标、背景、约束和输出形式；例子可以补充难以描述的模式。

## 简化与边界

- 不同模型和任务需要的提示细节不同；本课的分区方法是起点，不是固定模板。
- 消息优先级影响指令冲突时模型应优先遵循哪一类内容，不保证模型每次都完美服从。需要严格格式时，后续学习 Structured Outputs；权限与副作用也必须由应用程序控制。
- Responses API 的顶层 `instructions` 用于当前请求；通过 `previous_response_id` 延续时，上一轮的顶层 instructions 不会自动带到下一轮。对话状态会在第 10 课展开。[Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses?api-mode=responses)
